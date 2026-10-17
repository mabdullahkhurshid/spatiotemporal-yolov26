import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import {
  Building2,
  CreditCard,
  MapPin,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { getPublicSubscriptionPlans } from "../../services/publicApi";
import { getAccountSummary } from "../../services/customerApi";
import { checkoutSubscription } from "../../services/subscriptionApi";
import { setUser } from "../../store/slices/authSlice";
import { clearPendingPlanId, getPendingPlanId, isPortalUser } from "../../utils/roleRoutes";
import { socketService } from "../../services/socketService";
import {
  ACTIVE_SUBSCRIPTION_MESSAGE,
  CHECKOUT_MODE,
  deriveCheckoutMode,
  isCapacityCheckoutError,
  isSuspendedCheckoutError,
} from "../../utils/checkoutMode";

import { billingCycleLabel, formatPrice } from "../../utils/planFormatting";

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

      const { accessToken, refreshToken, user: updatedUser } = response.data;

      if (accessToken) localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);

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

  const submitLabel = isRenewal ? "Renew Subscription" : "Complete Purchase";
  const organization = accountSummary?.organization;

  if (pageLoading || isBlocked) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="card animate-pulse h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {planNotAvailable ? (
        <div className="card max-w-lg mx-auto text-center py-10 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Plan not available
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This plan is inactive or no longer offered. Choose another plan to
            continue.
          </p>
          <Link to="/customer/plans" className="btn-primary inline-flex">
            Browse Plans
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                Choose Plan
              </h2>

              {plans.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No plans available.{" "}
                  <Link to="/customer/plans" className="text-primary-600 hover:underline">
                    Browse plans
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {plans.map((plan) => {
                    const isSelected = String(plan._id) === String(selectedPlanId);

                    return (
                      <button
                        key={plan._id}
                        type="button"
                        onClick={() => handlePlanSelect(plan._id)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors ${
                          isSelected
                            ? "border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30"
                            : "border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700"
                        }`}
                      >
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {plan.name}
                        </p>
                        <p className="text-lg font-bold text-primary-600 dark:text-amber-400 mt-1">
                          {formatPrice(plan.price, plan.currency)}
                          <span className="text-xs font-normal text-gray-500 ml-1">
                            / {billingCycleLabel(plan.billingCycle)}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDuration(plan.durationMonths)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isRenewal && organization && (
              <div className="card space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Organization
                </h2>
                <p className="font-semibold text-gray-900 dark:text-white">{organization.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Mail size={16} className="shrink-0" />
                  {organization.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your existing organization will be renewed on this plan.
                </p>
              </div>
            )}

            {selectedPlan && (
              <div className="card bg-gradient-to-br from-primary-600 to-primary-700 text-white border-0">
                <p className="text-xs uppercase tracking-wide opacity-80 mb-1">
                  Order Summary
                </p>
                <p className="text-xl font-bold">{selectedPlan.name}</p>
                <p className="text-3xl font-bold mt-2">
                  {formatPrice(selectedPlan.price, selectedPlan.currency)}
                </p>
                <p className="text-sm opacity-90 mt-2">
                  Billed {billingCycleLabel(selectedPlan.billingCycle)} ·{" "}
                  {formatDuration(selectedPlan.durationMonths)}
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {!isRenewal && (
              <>
                <section className="card space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Building2 size={20} className="text-primary-600" />
                    Organization Details
                  </h2>

                  <div>
                    <label htmlFor="org-name" className="block text-sm font-medium mb-2">
                      Organization Name
                    </label>
                    <input
                      id="org-name"
                      type="text"
                      value={form.organizationName}
                      onChange={handleChange("organizationName")}
                      className="input-field"
                      placeholder="Company or team name"
                    />
                  </div>

                  <div>
                    <label htmlFor="org-phone" className="block text-sm font-medium mb-2">
                      Organization Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        id="org-phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange("phone")}
                        className="input-field pl-10"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </section>

                <section className="card space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin size={20} className="text-primary-600" />
                    Organization Address
                  </h2>

                  <div>
                    <label htmlFor="street" className="block text-sm font-medium mb-2">
                      Street Address
                    </label>
                    <input
                      id="street"
                      type="text"
                      value={form.street}
                      onChange={handleChange("street")}
                      className="input-field"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium mb-2">
                        City
                      </label>
                      <input
                        id="city"
                        type="text"
                        value={form.city}
                        onChange={handleChange("city")}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium mb-2">
                        State / Province
                      </label>
                      <input
                        id="state"
                        type="text"
                        value={form.state}
                        onChange={handleChange("state")}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="zip" className="block text-sm font-medium mb-2">
                        ZIP / Postal Code
                      </label>
                      <input
                        id="zip"
                        type="text"
                        value={form.zipCode}
                        onChange={handleChange("zipCode")}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="country" className="block text-sm font-medium mb-2">
                        Country
                      </label>
                      <input
                        id="country"
                        type="text"
                        value={form.country}
                        onChange={handleChange("country")}
                        className="input-field"
                      />
                    </div>
                  </div>
                </section>
              </>
            )}

            <section className="card space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <User size={20} className="text-primary-600" />
                Billing Contact
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="billing-name" className="block text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    id="billing-name"
                    type="text"
                    value={form.billingName}
                    onChange={handleChange("billingName")}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="billing-email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      id="billing-email"
                      type="email"
                      value={form.billingEmail}
                      readOnly
                      className="input-field pl-10 bg-gray-100 dark:bg-gray-800"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="card space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard size={20} className="text-primary-600" />
                Payment Details
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  (simulated — not charged)
                </span>
              </h2>

              <div>
                <label htmlFor="card-number" className="block text-sm font-medium mb-2">
                  Card Number
                </label>
                <input
                  id="card-number"
                  type="text"
                  value={form.cardNumber}
                  onChange={handleChange("cardNumber")}
                  className="input-field"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="card-expiry" className="block text-sm font-medium mb-2">
                    Expiry
                  </label>
                  <input
                    id="card-expiry"
                    type="text"
                    value={form.cardExpiry}
                    onChange={handleChange("cardExpiry")}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="card-cvc" className="block text-sm font-medium mb-2">
                    CVC
                  </label>
                  <input
                    id="card-cvc"
                    type="text"
                    value={form.cardCvc}
                    onChange={handleChange("cardCvc")}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="card-name" className="block text-sm font-medium mb-2">
                    Name on Card
                  </label>
                  <input
                    id="card-name"
                    type="text"
                    value={form.cardName}
                    onChange={handleChange("cardName")}
                    className="input-field"
                  />
                </div>
              </div>
            </section>

            {capacityPlanId && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
                <p className="text-amber-900 dark:text-amber-100">
                  This plan does not fit your current camera or operator usage.
                  Remove resources or pick a larger plan before checkout.
                </p>
                <Link
                  to={`/customer/downgrade-prep?planId=${encodeURIComponent(capacityPlanId)}`}
                  className="inline-flex mt-3 text-primary-600 dark:text-primary-400 font-medium hover:underline"
                >
                  Manage cameras & usage
                </Link>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/customer/plans"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Back to Plans
              </Link>
              <Link
                to="/customer/dashboard"
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedPlanId || !selectedPlan}
                className="btn-primary disabled:opacity-50 min-w-[140px]"
              >
                {submitting ? "Processing..." : submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SubscribePage;
