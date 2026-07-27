import { useEffect, useState } from "react";
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
import { checkoutSubscription } from "../../services/subscriptionApi";
import { setUser } from "../../store/slices/authSlice";
import { clearPendingPlanId, getPendingPlanId, isPortalUser } from "../../utils/roleRoutes";
import { socketService } from "../../services/socketService";

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
  const [selectedPlanId, setSelectedPlanId] = useState(routePlanId || "");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm(user));

  useEffect(() => {
    if (!isAuthenticated || !isPortalUser(user?.role)) {
      navigate("/login", { replace: true });
      return;
    }

    if (user?.role !== "customer") {
      navigate("/customer/dashboard", { replace: true });
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

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(String(planId));
    navigate(`/customer/subscribe/${encodeURIComponent(planId)}`, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedPlanId) {
      toast.error("Please select a subscription plan");
      return;
    }

    setSubmitting(true);

    try {
      const response = await checkoutSubscription({
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
      });

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
        response.data.message || "Subscription activated successfully",
      );
      navigate("/customer/subscription?success=1");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to complete purchase. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {loadingPlans ? (
        <div className="card animate-pulse h-96" />
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
                disabled={submitting || !selectedPlanId}
                className="btn-primary disabled:opacity-50 min-w-[140px]"
              >
                {submitting ? "Processing..." : "Complete Purchase"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SubscribePage;
