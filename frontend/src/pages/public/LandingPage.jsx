import { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getPublicSubscriptionPlans, submitContactMessage } from "../../services/publicApi";
import PlanCardGrid from "../../components/plans/PlanCardGrid";
import {
  getPendingPlanId,
  storePendingPlanId,
  isPortalUser,
  isMarketingViewAllowed,
} from "../../utils/roleRoutes";
import {
  applyDarkMode,
  getInitialDarkMode,
  setTheme,
  subscribeToSystemTheme,
} from "../../utils/theme";

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "pricing", label: "Pricing" },
  { id: "contact", label: "Contact" },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const isPortalAccount = isAuthenticated && isPortalUser(user?.role);

  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [contactSubmitting, setContactSubmitting] = useState(false);
  const contactSubmitLock = useRef(false);

  /*
   * Fetch subscription plans.
   *
   * The "isMounted" flag prevents state updates if the user leaves
   * this page before the API request finishes.
   */
  useEffect(() => {
    let isMounted = true;

    const fetchPlans = async () => {
      try {
        setIsLoadingPlans(true);
        setPlansError("");

        const response = await getPublicSubscriptionPlans();

        if (!isMounted) return;

        const fetchedPlans = response?.data?.data;

        setPlans(Array.isArray(fetchedPlans) ? fetchedPlans : []);
      } catch (error) {
        if (!isMounted) return;

        console.error("Failed to load subscription plans:", error);

        setPlans([]);
        setPlansError(
          "Unable to load subscription plans right now. Please try again later.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  /*
   * Portal users belong on the account portal by default, but may browse
   * the marketing site when they explicitly choose it from the portal sidebar.
   */
  useEffect(() => {
    if (!isPortalAccount) return;

    const pendingPlanId = getPendingPlanId();
    if (pendingPlanId) {
      navigate("/customer/dashboard", { replace: true });
      return;
    }

    if (isMarketingViewAllowed()) return;

    navigate("/customer/dashboard", { replace: true });
  }, [isPortalAccount, navigate]);

  /*
   * Apply dark/light class to the root element.
   *
   * We intentionally do not save the theme here.
   * The preference is saved only when the user manually changes it.
   */
  useEffect(() => {
    applyDarkMode(darkMode);
  }, [darkMode]);

  useEffect(() => subscribeToSystemTheme(setDarkMode), []);

  const toggleDarkMode = () => {
    setDarkMode((currentMode) => {
      const nextMode = !currentMode;
      setTheme(nextMode);
      return nextMode;
    });
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const hash = window.location.hash?.replace("#", "");
    if (!hash) return undefined;

    const timer = window.setTimeout(() => scrollToSection(hash), 150);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubscribeClick = (planId) => {
    if (!planId) return;

    storePendingPlanId(planId);

    if (isPortalAccount) {
      navigate("/customer/dashboard");
      return;
    }

    navigate(`/login?planId=${encodeURIComponent(planId)}`);
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();

    if (contactSubmitLock.current) return;

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("fullName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      subject: String(formData.get("subject") || "").trim() || "General inquiry",
      message: String(formData.get("message") || "").trim(),
      organization: String(formData.get("organization") || "").trim() || undefined,
    };

    contactSubmitLock.current = true;
    setContactSubmitting(true);

    try {
      await submitContactMessage(payload);
      toast.success("Your message has been sent successfully.");
      form.reset();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send message. Please try again.",
      );
    } finally {
      setContactSubmitting(false);
      contactSubmitLock.current = false;
    }
  };

  const cardClassName =
    "rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              type="button"
              onClick={() => scrollToSection("home")}
              className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Go to homepage"
            >
              <span className="text-2xl" aria-hidden="true">
                🔥
              </span>

              <span className="font-bold text-lg text-gray-900 dark:text-white">
                FireGuard AI
              </span>
            </button>

            {/* Desktop Navigation */}
            <nav
              className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700 dark:text-gray-300"
              aria-label="Main navigation"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className="hover:text-primary-600 dark:hover:text-amber-400 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                aria-pressed={darkMode}
              >
                <span aria-hidden="true">{darkMode ? "☾" : "☀"}</span>
              </button>

              <NavLink
                to="/login"
                className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-amber-400 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Login
              </NavLink>

              <NavLink
                to="/register"
                className="text-sm font-medium px-4 py-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:ring-offset-gray-900"
              >
                Get Started
              </NavLink>

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                aria-label={
                  mobileMenuOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                }
                aria-expanded={mobileMenuOpen}
              >
                <span aria-hidden="true">{mobileMenuOpen ? "✕" : "☰"}</span>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav
              className="md:hidden mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-amber-400"
                  >
                    {item.label}
                  </button>
                ))}

                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="sm:hidden px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Login
                </NavLink>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          id="home"
          className="scroll-mt-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
        >
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Spatiotemporal AI for{" "}
                <span className="text-amber-400">Fire &amp; Smoke</span>{" "}
                Surveillance
              </h1>

              <p className="mt-4 text-lg text-slate-200">
                Detect fires in seconds, not minutes. FireGuard AI fuses CCTV,
                edge AI, and sensor data to deliver real-time, low-false-alarm
                monitoring for mission-critical environments.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => scrollToSection("pricing")}
                  className="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  View Plans
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection("how-it-works")}
                  className="px-6 py-3 rounded-full border border-slate-500 text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  How It Works
                </button>
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white">
                    Industries We Protect
                  </p>
                  <p>Hospitals · Warehouses · Factories · Schools</p>
                </div>

                <div>
                  <p className="font-semibold text-white">Key Benefits</p>
                  <p>
                    Sub-2s detection · Fewer false alarms · Multi-tenant SaaS
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 md:p-6 shadow-xl">
              <p className="text-sm text-slate-300 mb-3">
                Live AI Monitoring (Demo)
              </p>

              <div className="aspect-video rounded-xl bg-black flex items-center justify-center text-slate-500 text-sm border border-slate-700">
                Live CCTV + AI overlay preview
              </div>

              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>✓ Real-time fire &amp; smoke confidence (%)</li>
                <li>✓ Alert lifecycle &amp; operator response tracking</li>
                <li>✓ Edge-ready model for Raspberry Pi &amp; CCTV</li>
              </ul>
            </div>
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          className="scroll-mt-20 py-16 bg-white dark:bg-gray-900"
        >
          <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                About FireGuard AI
              </h2>

              <p className="mt-4 text-gray-700 dark:text-gray-300">
                FireGuard AI is a spatiotemporal disaster resilience framework
                that continuously analyzes CCTV feeds and field sensors to
                detect early signs of fire and smoke. Designed for distributed,
                multi-organization deployments, it brings datacenter-grade
                monitoring to hospitals, warehouses, factories, and campuses.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {[
                {
                  title: "Edge AI",
                  description:
                    "YOLOv26 ONNX inference on CPU with temporal incident tracking across CCTV frames.",
                },
                {
                  title: "Multi-tenant SaaS",
                  description:
                    "Isolated dashboards for each organization with central admin control.",
                },
                {
                  title: "Sensor Fusion Ready",
                  description:
                    "Integrates CCTV, temperature, and gas sensors into one alert pipeline.",
                },
                {
                  title: "Ops Friendly",
                  description:
                    "Audit logs, alert history, and reporting for compliance and analysis.",
                },
              ].map((item) => (
                <div key={item.title} className={cardClassName}>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {item.title}
                  </p>

                  <p className="mt-1 text-gray-600 dark:text-gray-300">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 py-16 bg-gray-50 dark:bg-gray-950"
        >
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">
              Key Features
            </h2>

            <div className="mt-10 grid md:grid-cols-3 gap-6">
              <div className={cardClassName}>
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                  Spatiotemporal AI Engine
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  YOLOv26 object detection with spatiotemporal incident
                  validation, bounding-box overlays, and confidence smoothing
                  for reliable fire and smoke alerts.
                </p>
              </div>

              <div className={cardClassName}>
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                  Intelligent Alert Lifecycle
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Structured states (ACTIVE, ACKNOWLEDGED, RESOLVED,
                  FALSE_ALARM) with email, Socket.io, and audit trail.
                </p>
              </div>

              <div className={cardClassName}>
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                  Role-Based Dashboards
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Super Admin, Organization Admin, and Operator workflows with
                  strict RBAC and subscription-aware access.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 py-16 bg-white dark:bg-gray-900"
        >
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">
              How It Works
            </h2>

            <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              {[
                {
                  title: "1. Ingest",
                  description:
                    "Connect CCTV streams and edge devices such as Raspberry Pi and sensors.",
                },
                {
                  title: "2. Analyze",
                  description:
                    "Run the YOLOv26 inference worker on streams with optional sensor hooks in near real time.",
                },
                {
                  title: "3. Alert",
                  description:
                    "Trigger structured alerts only when confidence and consistency criteria pass.",
                },
                {
                  title: "4. Respond",
                  description:
                    "Operators acknowledge, resolve, or mark false alarms with a full audit trail.",
                },
              ].map((step) => (
                <div key={step.title} className={cardClassName}>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">
                    {step.title}
                  </p>

                  <p className="text-gray-600 dark:text-gray-300">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 py-16 bg-gray-900 text-white"
        >
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center">
              Flexible Subscription Plans
            </h2>

            <p className="mt-3 text-center text-gray-300">
              Plans are fully managed in the Super Admin console and loaded
              dynamically.
            </p>

            <PlanCardGrid
              plans={plans}
              isLoading={isLoadingPlans}
              error={plansError}
              variant="landing"
              onSubscribe={handleSubscribeClick}
              className="mt-10"
            />
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="scroll-mt-20 py-16 bg-white dark:bg-gray-900"
        >
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">
              Contact Us
            </h2>

            <p className="mt-3 text-center text-gray-600 dark:text-gray-300">
              Have questions about deployments, pilots, or academic
              partnerships? Drop us a message.
            </p>

            <form
              className="mt-8 grid gap-4"
              onSubmit={handleContactSubmit}
              noValidate={false}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="contact-full-name"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Full name
                  </label>

                  <input
                    id="contact-full-name"
                    name="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor="contact-email"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Work email
                  </label>

                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="contact-organization"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Organization
                </label>

                <input
                  id="contact-organization"
                  name="organization"
                  type="text"
                  autoComplete="organization"
                  placeholder="Your organization"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="contact-subject"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Subject
                </label>

                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="How can we help?"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="contact-message"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Message
                </label>

                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  minLength={10}
                  placeholder="Tell us about your environment and requirements..."
                  className="w-full resize-y rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={contactSubmitting}
                  className="px-6 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {contactSubmitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row gap-2 sm:justify-between text-center sm:text-left text-xs text-gray-500 dark:text-gray-400">
          <span>
            © {new Date().getFullYear()} FireGuard AI. All rights reserved.
          </span>

          <span>Built with MERN + Python YOLOv26 (ONNX)</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
