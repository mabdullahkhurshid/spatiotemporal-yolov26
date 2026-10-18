import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, CreditCard, Lock, MapPin, Package, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState, Notice, Skeleton } from '../../components/ui/Feedback';
import { Field, Input } from '../../components/ui/Field';
import { cn } from '../../utils/cn';
import { getPublicSubscriptionPlans } from "../../services/publicApi";
import { getAccountSummary } from "../../services/customerApi";
import { checkoutSubscription } from "../../services/subscriptionApi";
import { setUser } from "../../store/slices/authSlice";
import { clearPendingPlanId, getPendingPlanId, isPortalUser } from "../../utils/roleRoutes";
import { socketService } from "../../services/socketService";
import { setAccessToken } from "../../services/tokenStore";
import {
  ACTIVE_SUBSCRIPTION_MESSAGE,
  CHECKOUT_MODE,
  deriveCheckoutMode,
  isCapacityCheckoutError,
  isSuspendedCheckoutError,
} from "../../utils/checkoutMode";

import { billingCycleLabel } from "../../utils/planFormatting";
import { formatCurrency } from "../../utils/format";

const formatDuration = (months) => {
  const value = Number(months);
  if (!Number.isFinite(value) || value < 1) return "—";
  if (value === 1) return "1 month";
  if (value === 12) return "1 year";
  return `${value} months`;
};

const normalizeUser = (user) => {
  if (!user) return null;
  const id = user._id || user.id;
  return { ...user, _id: id, id };
};

const emptyForm = (user) => ({
  organizationName: "",
  phone: user?.phone || "",
  billingName: user?.name || "",
  billingEmail: user?.email || "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "USA",
  cardNumber: "4242 4242 4242 4242",
  cardExpiry: "12/28",
  cardCvc: "123",
  cardName: user?.name || "",
});

const SubscribePage = () => {
  const { planId: routePlanId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [accountSummary, setAccountSummary] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(routePlanId || "");
  const [submitting, setSubmitting] = useState(false);
  const [capacityPlanId, setCapacityPlanId] = useState("");
  const [form, setForm] = useState(emptyForm(user));

  const checkoutMode = useMemo(
    () => deriveCheckoutMode(accountSummary),
    [accountSummary],
  );

  const isRenewal = checkoutMode === CHECKOUT_MODE.RENEWAL;
  const pageLoading = loadingPlans || loadingSummary;
  const isBlocked =
    checkoutMode === CHECKOUT_MODE.BLOCKED_ACTIVE ||
    checkoutMode === CHECKOUT_MODE.BLOCKED_SUSPENDED;

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(user?.role)) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate, user?.role]);

  useEffect(() => {
    const pending = getPendingPlanId();
    if (pending && !routePlanId) {
      setSelectedPlanId(pending);
      clearPendingPlanId();
      navigate(`/customer/subscribe/${encodeURIComponent(pending)}`, { replace: true });
    } else if (routePlanId) {
      setSelectedPlanId(routePlanId);
    }
  }, [routePlanId, navigate]);

  useEffect(() => {
    let isMounted = true;

    const fetchPlans = async () => {
      try {
        const response = await getPublicSubscriptionPlans();
        if (isMounted) {
          setPlans(Array.isArray(response?.data?.data) ? response.data.data : []);
        }
      } catch {
        if (isMounted) setPlans([]);
      } finally {
        if (isMounted) setLoadingPlans(false);
      }
    };

    fetchPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchSummary = async () => {
      try {
        const response = await getAccountSummary();
        if (isMounted) {
          setAccountSummary(response.data?.data ?? null);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(
            error.response?.data?.message || "Failed to load account details",
          );
          setAccountSummary(null);
        }
      } finally {
        if (isMounted) setLoadingSummary(false);
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (loadingSummary) {
      return;
    }

    if (checkoutMode === CHECKOUT_MODE.BLOCKED_ACTIVE) {
      toast.error(ACTIVE_SUBSCRIPTION_MESSAGE);
      navigate("/customer/subscription", { replace: true });
      return;
    }

    if (checkoutMode === CHECKOUT_MODE.BLOCKED_SUSPENDED) {
      toast.error("Your organization is suspended. Please contact support.");
      navigate("/customer/subscription", { replace: true });
    }
  }, [checkoutMode, loadingSummary, navigate]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      phone: current.phone || user?.phone || "",
      billingName: current.billingName || user?.name || "",
      billingEmail: user?.email || "",
      cardName: current.cardName || user?.name || "",
    }));
  }, [user]);

  const selectedPlan = plans.find(
    (plan) => String(plan._id) === String(selectedPlanId),
  );

  const planNotAvailable =
    !pageLoading &&
    Boolean(selectedPlanId) &&
    plans.length > 0 &&
    !selectedPlan;

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handlePlanSelect = (planId) => {
    setCapacityPlanId("");
    setSelectedPlanId(String(planId));
    navigate(`/customer/subscribe/${encodeURIComponent(planId)}`, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedPlanId || pageLoading || isBlocked) {
      return;
    }

    if (!selectedPlan) {
      toast.error("Please select a valid subscription plan");
      return;
    }

    setSubmitting(true);
    setCapacityPlanId("");

    const payload = isRenewal
      ? { planId: selectedPlanId }
      : {
          planId: selectedPlanId,
          organizationName: form.organizationName,
          phone: form.phone,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            country: form.country,
          },
        };

    try {
      const response = await checkoutSubscription(payload);

      const { accessToken, user: updatedUser } = response.data;

      // The refresh session (httpOnly cookie) is unchanged; only the access token is renewed.
      if (accessToken) setAccessToken(accessToken);

      const normalizedUser = normalizeUser(updatedUser);
      if (normalizedUser) {
        localStorage.setItem("user", JSON.stringify(normalizedUser));
        dispatch(setUser(normalizedUser));
      }

      clearPendingPlanId();
      if (accessToken) socketService.connect(accessToken);

      toast.success(
        response.data.message ||
          (isRenewal
            ? "Subscription renewed successfully"
            : "Subscription activated successfully"),
      );

      if (isRenewal) {
        navigate("/customer/subscription?success=1&renewed=1");
      } else {
        navigate("/customer/subscription?success=1");
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Failed to complete purchase. Please try again.";
      const status = error.response?.status;

      if (status === 400 && message === ACTIVE_SUBSCRIPTION_MESSAGE) {
        toast.error(message);
        navigate("/customer/subscription", { replace: true });
        return;
      }

      if (status === 403 && isSuspendedCheckoutError(message)) {
        toast.error(message);
        navigate("/customer/subscription", { replace: true });
        return;
      }

      if (status === 400 && isCapacityCheckoutError(message)) {
        toast.error(message);
        setCapacityPlanId(selectedPlanId);
        return;
      }

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = isRenewal ? 'Renew subscription' : 'Complete purchase';
  const organization = accountSummary?.organization;

  if (pageLoading || isBlocked) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (planNotAvailable) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={Package}
          title="This plan is no longer available"
          description="It may have been retired. Choose another plan to continue."
          action={
            <Button as={Link} to="/customer/plans">
              Browse plans
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={isRenewal ? 'Renew your subscription' : 'Checkout'}
        description={
          isRenewal
            ? `Renewing ${organization?.name || 'your organization'}. Cameras and operators stay in place.`
            : 'Create your organization and start monitoring. You can add cameras right after purchase.'
        }
      />

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {!isRenewal && (
            <Card>
              <CardHeader title="Organization" description="The organization you'll manage. You become its administrator." icon={Building2} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Organization name" required className="sm:col-span-2">
                  <Input value={form.organizationName} onChange={handleChange('organizationName')} placeholder="Northwind Logistics — Karachi DC" autoComplete="organization" />
                </Field>
                <Field label="Phone" optional>
                  <Input type="tel" value={form.phone} onChange={handleChange('phone')} placeholder="+92 300 1234567" autoComplete="tel" />
                </Field>
              </CardBody>
            </Card>
          )}

          {!isRenewal && (
            <Card>
              <CardHeader title="Site address" description="Where your cameras are installed." icon={MapPin} />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Field label="Street address" optional className="sm:col-span-2">
                  <Input value={form.street} onChange={handleChange('street')} autoComplete="street-address" />
                </Field>
                <Field label="City" optional>
                  <Input value={form.city} onChange={handleChange('city')} autoComplete="address-level2" />
                </Field>
                <Field label="State / province" optional>
                  <Input value={form.state} onChange={handleChange('state')} autoComplete="address-level1" />
                </Field>
                <Field label="Postal code" optional>
                  <Input value={form.zipCode} onChange={handleChange('zipCode')} autoComplete="postal-code" />
                </Field>
                <Field label="Country" optional>
                  <Input value={form.country} onChange={handleChange('country')} autoComplete="country-name" />
                </Field>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Billing contact" icon={User} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={form.billingName} onChange={handleChange('billingName')} autoComplete="name" />
              </Field>
              <Field label="Email" hint="Receipts are sent to your account email.">
                <Input type="email" value={form.billingEmail} readOnly className="bg-surface-2 text-fg-muted" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment" icon={CreditCard} actions={<Badge tone="info">Demo mode</Badge>} />
            <CardBody className="space-y-4">
              <Notice tone="info" icon={Lock}>
                Payments are simulated in this deployment — no card is charged. The fields are pre-filled with a test card.
              </Notice>
              <Field label="Card number">
                <Input value={form.cardNumber} onChange={handleChange('cardNumber')} inputMode="numeric" autoComplete="cc-number" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Expiry">
                  <Input value={form.cardExpiry} onChange={handleChange('cardExpiry')} placeholder="MM/YY" autoComplete="cc-exp" />
                </Field>
                <Field label="CVC">
                  <Input value={form.cardCvc} onChange={handleChange('cardCvc')} inputMode="numeric" autoComplete="cc-csc" />
                </Field>
                <Field label="Name on card">
                  <Input value={form.cardName} onChange={handleChange('cardName')} autoComplete="cc-name" />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader title="Order summary" />
            <CardBody className="space-y-5">
              {plans.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  No plans are available.{' '}
                  <Link to="/customer/plans" className="link">
                    Browse plans
                  </Link>
                </p>
              ) : (
                <fieldset>
                  <legend className="label">Plan</legend>
                  <div className="space-y-2">
                    {plans.map((plan) => {
                      const selected = String(plan._id) === String(selectedPlanId);
                      return (
                        <label
                          key={plan._id}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                            selected ? 'border-brand-500 bg-info-soft' : 'border-line-strong hover:bg-surface-2'
                          )}
                        >
                          <input type="radio" name="plan" checked={selected} onChange={() => handlePlanSelect(plan._id)} className="h-4 w-4 accent-brand-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-fg">{plan.name}</span>
                            <span className="block text-xs text-fg-muted">
                              {plan.maxCameras} cameras · {formatDuration(plan.durationMonths)}
                            </span>
                          </span>
                          <span className="tabular text-sm font-semibold text-fg">{formatCurrency(plan.price, plan.currency)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {selectedPlan && (
                <dl className="space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">{selectedPlan.name} plan</dt>
                    <dd className="tabular text-fg">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">Term</dt>
                    <dd className="text-fg">
                      {formatDuration(selectedPlan.durationMonths)}, billed {billingCycleLabel(selectedPlan.billingCycle)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
                    <dt className="font-semibold text-fg">Due today</dt>
                    <dd className="tabular font-semibold text-fg">{formatCurrency(selectedPlan.price, selectedPlan.currency)}</dd>
                  </div>
                </dl>
              )}

              {capacityPlanId && (
                <Notice
                  tone="warning"
                  title="This plan can't hold your current setup"
                  action={
                    <Button as={Link} to={`/customer/downgrade-prep?planId=${encodeURIComponent(capacityPlanId)}`} size="sm" variant="secondary">
                      Reduce usage
                    </Button>
                  }
                >
                  Remove cameras or operators, or pick a larger plan.
                </Notice>
              )}

              <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!selectedPlanId || !selectedPlan}>
                {submitLabel}
              </Button>
              <p className="text-center text-xs text-fg-subtle">
                {isRenewal ? 'A new term starts today.' : 'Your term starts today. You can renew or change plans when it ends.'}
              </p>
            </CardBody>
          </Card>
          <Button as={Link} to="/customer/plans" variant="ghost" icon={ArrowLeft} className="w-full">
            Back to plans
          </Button>
        </aside>
      </form>
    </div>
  );
};

export default SubscribePage;
