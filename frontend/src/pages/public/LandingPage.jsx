import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getPublicSubscriptionPlans } from "../../services/publicApi";

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
};

const LandingPage = () => {
  const [plans, setPlans] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  const navigate = useNavigate();

  useEffect(() => {
    getPublicSubscriptionPlans()
      .then((res) => setPlans(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const handleSubscribeClick = (planId) => {
    navigate(`/login?planId=${planId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🔥</span>
            <span className="font-bold text-lg text-gray-900">
              FireGuard AI
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-700">
            <button
              onClick={() => scrollToSection("home")}
              className="hover:text-primary-600"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="hover:text-primary-600"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-primary-600"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="hover:text-primary-600"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="hover:text-primary-600"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="hover:text-primary-600"
            >
              Contact
            </button>
          </nav>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle dark mode"
            >
              {darkMode ? "☾" : "☀"}
            </button>
            <NavLink
              to="/login"
              className="text-sm font-medium text-gray-700 hover:text-primary-600"
            >
              Login
            </NavLink>
            <NavLink
              to="/register"
              className="text-sm font-medium px-4 py-2 rounded-full bg-primary-600 text-white hover:bg-primary-700"
            >
              Get Started
            </NavLink>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section
          id="home"
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
        >
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Spatiotemporal AI for{" "}
                <span className="text-amber-400">Fire & Smoke</span>{" "}
                Surveillance
              </h1>
              <p className="mt-4 text-lg text-slate-200">
                Detect fires in seconds, not minutes. FireGuard AI fuses CCTV,
                edge AI, and sensor data to deliver real-time, low‑false‑alarm
                monitoring for mission‑critical environments.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => scrollToSection("pricing")}
                  className="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
                >
                  View Plans
                </button>
                <button
                  onClick={() => scrollToSection("features")}
                  className="px-6 py-3 rounded-full border border-slate-500 text-slate-100 hover:bg-slate-800"
                >
                  How It Works
                </button>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white">
                    Industries We Protect
                  </p>
                  <p>Hospitals · Warehouses · Factories · Schools</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Key Benefits</p>
                  <p>
                    Sub‑2s detection · Fewer false alarms · Multi‑tenant SaaS
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
                <li>✓ Real-time fire & smoke confidence (%)</li>
                <li>✓ Alert lifecycle & operator response tracking</li>
                <li>✓ Edge-ready model for Raspberry Pi & CCTV</li>
              </ul>
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                About FireGuard AI
              </h2>
              <p className="mt-4 text-gray-700">
                FireGuard AI is a spatiotemporal disaster resilience framework
                that continuously analyzes CCTV feeds and field sensors to
                detect early signs of fire and smoke. Designed for distributed,
                multi-organization deployments, it brings datacenter-grade
                monitoring to hospitals, warehouses, factories, and campuses.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-semibold text-gray-900">Edge AI</p>
                <p className="mt-1 text-gray-600">
                  3D CNN + Transformer optimized for real-time inference on edge
                  devices.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-semibold text-gray-900">Multi-tenant SaaS</p>
                <p className="mt-1 text-gray-600">
                  Isolated dashboards for each organization with central admin
                  control.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-semibold text-gray-900">
                  Sensor Fusion Ready
                </p>
                <p className="mt-1 text-gray-600">
                  Integrates CCTV, temperature, and gas sensors into one alert
                  pipeline.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-semibold text-gray-900">Ops Friendly</p>
                <p className="mt-1 text-gray-600">
                  Audit logs, alert history, and reporting for compliance and
                  analysis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 bg-gray-50 dark:bg-gray-950">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center">
              Key Features
            </h2>
            <div className="mt-10 grid md:grid-cols-3 gap-6">
              <div className="card">
                <h3 className="font-semibold text-lg mb-2">
                  Spatiotemporal AI Engine
                </h3>
                <p className="text-sm text-gray-600">
                  3D CNN + lightweight Transformer with temporal validation and
                  confidence smoothing for reliable detection.
                </p>
              </div>
              <div className="card">
                <h3 className="font-semibold text-lg mb-2">
                  Intelligent Alert Lifecycle
                </h3>
                <p className="text-sm text-gray-600">
                  Structured states (ACTIVE, ACKNOWLEDGED, RESOLVED,
                  FALSE_ALARM) with email, Socket.io, and audit trail.
                </p>
              </div>
              <div className="card">
                <h3 className="font-semibold text-lg mb-2">
                  Role-Based Dashboards
                </h3>
                <p className="text-sm text-gray-600">
                  Super Admin, Organization Admin, and Operator workflows with
                  strict RBAC and subscription-aware access.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center">
              How It Works
            </h2>
            <div className="mt-10 grid md:grid-cols-4 gap-6 text-sm">
              <div className="card">
                <p className="font-semibold text-gray-900 mb-1">1. Ingest</p>
                <p className="text-gray-600">
                  Connect CCTV streams and edge devices (Raspberry Pi, sensors).
                </p>
              </div>
              <div className="card">
                <p className="font-semibold text-gray-900 mb-1">2. Analyze</p>
                <p className="text-gray-600">
                  Run spatiotemporal AI + sensor fusion in near real time.
                </p>
              </div>
              <div className="card">
                <p className="font-semibold text-gray-900 mb-1">3. Alert</p>
                <p className="text-gray-600">
                  Trigger structured alerts only when confidence and consistency
                  criteria pass.
                </p>
              </div>
              <div className="card">
                <p className="font-semibold text-gray-900 mb-1">4. Respond</p>
                <p className="text-gray-600">
                  Operators acknowledge, resolve, or mark false alarms with full
                  audit trail.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center">
              Flexible Subscription Plans
            </h2>
            <p className="mt-3 text-center text-gray-300">
              Plans are fully managed in the Super Admin console and loaded
              dynamically.
            </p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan._id}
                  className="card bg-slate-800 border border-slate-700"
                >
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    {plan.description || plan.slug}
                  </p>
                  <p className="mt-4 text-3xl font-bold">
                    {Number(plan.price || 0).toFixed(0)}{" "}
                    {plan.currency || "USD"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Billed{" "}
                    {plan.billingCycle === "yearly" ? "yearly" : "monthly"} ·{" "}
                    {plan.durationMonths} month term
                  </p>
                  <ul className="mt-4 text-sm text-slate-200 space-y-1">
                    <li>Max cameras: {plan.maxCameras}</li>
                    <li>Max operators: {plan.maxOperators}</li>
                    <li>Alert retention: {plan.alertRetentionDays} days</li>
                    <li>Storage: {plan.storageLimit} GB</li>
                    <li>Support: {plan.supportPriority}</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSubscribeClick(plan._id)}
                    className="mt-6 w-full px-4 py-2 rounded-full bg-amber-500 text-slate-900 font-semibold hover:bg-amber-600"
                  >
                    Subscribe
                  </button>
                </div>
              ))}
              {plans.length === 0 && (
                <p className="text-center text-slate-300 col-span-full">
                  Subscription plans are not configured yet. Please contact the
                  system administrator.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center">
              Contact Us
            </h2>
            <p className="mt-3 text-center text-gray-600">
              Have questions about deployments, pilots, or academic
              partnerships? Drop us a message.
            </p>
            <form className="mt-8 grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  id="contact-full-name"
                  name="fullName"
                  type="text"
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                />
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  placeholder="Work email"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                />
              </div>
              <input
                id="contact-organization"
                name="organization"
                type="text"
                placeholder="Organization"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              />
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder="Tell us about your environment and requirements..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-6 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-4">
        <div className="max-w-6xl mx-auto px-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            © {new Date().getFullYear()} FireGuard AI. All rights reserved.
          </span>
          <span>Built with MERN + TensorFlow.js</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
