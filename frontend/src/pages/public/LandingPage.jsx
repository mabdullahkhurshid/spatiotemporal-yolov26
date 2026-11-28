import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Factory,
  HeartPulse,
  Radar,
  School,
  Send,
  Server,
  ShieldCheck,
  Truck,
  Video,
  Warehouse,
  Workflow,
} from 'lucide-react';
import { getPublicSubscriptionPlans, submitContactMessage } from '../../services/publicApi';
import PlanCardGrid from '../../components/plans/PlanCardGrid';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import ProductPreview from '../../components/marketing/ProductPreview';
import Button from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { getDashboardPathForRole, getPendingPlanId, isMarketingViewAllowed, isPortalUser, storePendingPlanId } from '../../utils/roleRoutes';

const INDUSTRIES = [
  { icon: Warehouse, label: 'Warehouses' },
  { icon: Factory, label: 'Manufacturing' },
  { icon: HeartPulse, label: 'Hospitals' },
  { icon: School, label: 'Campuses' },
  { icon: Server, label: 'Data centres' },
  { icon: Truck, label: 'Logistics hubs' },
];

const STEPS = [
  { icon: Video, title: 'Connect cameras', body: 'Add the RTSP or MJPEG streams you already record. No new hardware.' },
  { icon: Radar, title: 'AI watches every frame', body: 'A YOLO model scans each feed for fire and smoke, around the clock.' },
  { icon: ShieldCheck, title: 'Detections are confirmed', body: 'An alert is raised only when consecutive frames agree, cutting false alarms.' },
  { icon: BellRing, title: 'Your team responds', body: 'The right people are notified instantly, acknowledge, and record the outcome.' },
];

const SectionHeading = ({ eyebrow, title, body, center = false }) => (
  <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
    <p className="text-sm font-medium text-fg-subtle">{eyebrow}</p>
    <h2 className="mt-2 text-2xl font-medium text-fg sm:text-3xl">{title}</h2>
    {body && <p className="mt-3 text-base text-fg-muted">{body}</p>}
  </div>
);

/* Small product visuals for the feature rows. */
const FramesVisual = () => (
  <div className="rounded-xl border border-line bg-surface p-5" aria-hidden="true">
    <p className="text-xs font-medium text-fg-muted">Loading Dock A · last 4 frames</p>
    <div className="mt-4 grid grid-cols-4 gap-2">
      {[
        { fire: 38, hit: false },
        { fire: 81, hit: true },
        { fire: 88, hit: true },
        { fire: 92, hit: true },
      ].map((f, i) => (
        <div key={i} className={`rounded-md border p-2.5 ${f.hit ? 'border-critical-line bg-critical-soft' : 'border-line bg-surface-2'}`}>
          <div className="relative h-12 rounded bg-[#0A0F18]">
            {f.hit && <span className="absolute bottom-1 left-1/2 h-6 w-7 -translate-x-1/2 rounded-sm border-2 border-[#EF4444]" />}
          </div>
          <p className="tabular mt-2 text-center text-xs font-medium text-fg">{f.fire}%</p>
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-fg">
      <CheckCircle2 size={14} className="text-success" />
      Confirmed over 3 consecutive frames — alert raised
    </div>
  </div>
);

const TimelineVisual = () => (
  <div className="rounded-xl border border-line bg-surface p-5" aria-hidden="true">
    <ol className="relative space-y-5 border-l border-line pl-5">
      {[
        { dot: 'bg-critical', title: 'Detected', meta: '09:41 · Fire 92% · Loading Dock A' },
        { dot: 'bg-warning', title: 'Acknowledged by Ali Raza', meta: '09:42 · "Heading to dock A"' },
        { dot: 'bg-success', title: 'Resolved — fire extinguished', meta: '09:55 · Closed by Maria Khan' },
      ].map((s) => (
        <li key={s.title} className="relative">
          <span className={`absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${s.dot}`} />
          <p className="text-sm font-medium text-fg">{s.title}</p>
          <p className="text-xs text-fg-muted">{s.meta}</p>
        </li>
      ))}
    </ol>
  </div>
);

const AccessVisual = () => (
  <div className="space-y-2.5 rounded-xl border border-line bg-surface p-5" aria-hidden="true">
    {[
      { role: 'Organization admin', scope: 'All cameras · operators · reports · billing' },
      { role: 'Operator', scope: 'Only the cameras assigned to them' },
      { role: 'Platform admin', scope: 'Organizations, plans and orders' },
    ].map((r) => (
      <div key={r.role} className="flex items-center justify-between gap-3 rounded-md border border-line px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{r.role}</p>
          <p className="truncate text-xs text-fg-muted">{r.scope}</p>
        </div>
        <ShieldCheck size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
      </div>
    ))}
  </div>
);

const FEATURES = [
  {
    eyebrow: 'Detection',
    title: 'Confirmed detections, not noise',
    body: 'Steam, welding and sunlight shouldn’t wake anyone up. FireGuard requires fire or smoke to persist across consecutive frames before it raises an alert.',
    points: ['Fire and smoke classified separately', 'Temporal confirmation and cooldown', 'Live boxes drawn over the camera feed'],
    visual: <FramesVisual />,
  },
  {
    eyebrow: 'Response',
    title: 'A workflow, not just a siren',
    body: 'Every alert has an owner and an outcome. Operators acknowledge, resolve with what happened, or mark a false alarm — and the full history is kept.',
    points: ['Acknowledge → resolve lifecycle', 'Outcome and notes on every alert', 'Email and in-app notifications'],
    visual: <TimelineVisual />,
  },
  {
    eyebrow: 'Access',
    title: 'Everyone sees exactly what they should',
    body: 'Each organization is isolated. Admins manage cameras and people; operators only see the cameras they’re responsible for.',
    points: ['Role-based access for every page', 'Per-camera operator assignment', 'Separate data for every organization'],
    visual: <AccessVisual />,
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const isPortalAccount = isAuthenticated && isPortalUser(user?.role);

  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const contactSubmitLock = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoadingPlans(true);
        setPlansError('');
        const response = await getPublicSubscriptionPlans();
        if (!isMounted) return;
        const fetched = response?.data?.data;
        setPlans(Array.isArray(fetched) ? fetched : []);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load subscription plans:', error);
        setPlans([]);
        setPlansError('Plans could not be loaded right now. Please try again later.');
      } finally {
        if (isMounted) setIsLoadingPlans(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Portal users belong in their account unless they explicitly chose to browse the site.
  useEffect(() => {
    if (!isPortalAccount) return;
    if (getPendingPlanId()) {
      navigate('/customer/dashboard', { replace: true });
      return;
    }
    if (isMarketingViewAllowed()) return;
    navigate('/customer/dashboard', { replace: true });
  }, [isPortalAccount, navigate]);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (!hash) return undefined;
    const timer = window.setTimeout(() => scrollToSection(hash), 150);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubscribeClick = (planId) => {
    if (!planId) return;
    storePendingPlanId(planId);
    if (isPortalAccount) {
      navigate('/customer/dashboard');
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
      name: String(formData.get('fullName') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      subject: String(formData.get('subject') || '').trim() || 'General inquiry',
      message: String(formData.get('message') || '').trim(),
      organization: String(formData.get('organization') || '').trim() || undefined,
    };
    contactSubmitLock.current = true;
    setContactSubmitting(true);
    try {
      await submitContactMessage(payload);
      toast.success('Message sent — we’ll be in touch shortly.');
      setContactSent(true);
      form.reset();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setContactSubmitting(false);
      contactSubmitLock.current = false;
    }
  };

  const accountHref = isAuthenticated && user ? getDashboardPathForRole(user.role) : null;

  return (
    <div className="min-h-screen bg-surface">
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium shadow-overlay focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <SiteHeader onNavigate={scrollToSection} accountHref={accountHref} accountLabel="Go to your account" />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0B111D] text-white">
          <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pb-28 pt-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-32 lg:pt-24">
            <div>
              <h1 className="text-4xl font-medium leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-[3.5rem]">
                See fire before
                <br />
                the alarm does
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
                FireGuard AI watches your camera feeds around the clock, confirms fire and smoke across consecutive frames, and puts a clear alert in front of the right people within seconds.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" iconRight={ArrowRight} onClick={() => scrollToSection('pricing')}>
                  See plans
                </Button>
                <Button size="lg" variant="ghost" onClick={() => scrollToSection('how-it-works')} className="text-white/85 ring-1 ring-inset ring-white/20 hover:bg-white/10 hover:text-white">
                  How it works
                </Button>
              </div>
            </div>
            <div className="pb-12 lg:pb-0">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Industries */}
        <section aria-label="Industries" className="border-b border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-9 sm:px-6 lg:flex-row lg:justify-between">
            <p className="text-sm font-medium text-fg-muted">Built for sites where minutes matter</p>
            <ul className="flex flex-wrap justify-center gap-x-7 gap-y-3">
              {INDUSTRIES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-medium text-fg-subtle">
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Product */}
        <section id="product" className="scroll-mt-16 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              center
              eyebrow="Product"
              title="From the first flicker to a closed incident"
              body="Detection is only half the job. FireGuard covers what happens next, so every alert is seen, owned and resolved."
            />
            <div className="mt-16 space-y-20">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={i % 2 ? 'lg:order-2' : ''}>
                    <p className="text-sm font-medium text-fg-subtle">{f.eyebrow}</p>
                    <h3 className="mt-2 text-xl font-medium text-fg sm:text-2xl">{f.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-fg-muted">{f.body}</p>
                    <ul className="mt-5 space-y-2.5">
                      {f.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-sm text-fg">
                          <Check size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={i % 2 ? 'lg:order-1' : ''}>
                    <div className="rounded-2xl bg-canvas p-4 sm:p-8">{f.visual}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-y border-line bg-canvas py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading center eyebrow="How it works" title="Up and running on the cameras you have" />
            <ol className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-line-strong lg:block" />
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="relative text-center">
                  <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-fg-muted shadow-xs">
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="tabular mt-4 font-mono text-xs text-fg-subtle">Step {i + 1}</p>
                  <h3 className="mt-1 text-base font-medium text-fg">{title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-fg-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              center
              eyebrow="Pricing"
              title="Simple plans that scale with your sites"
              body="Every plan includes real-time detection, the alert workflow and reports. Pick by the number of cameras and operators."
            />
            <div className="mt-12">
              <PlanCardGrid plans={plans} isLoading={isLoadingPlans} error={plansError} onSubscribe={handleSubscribeClick} subscribeLabel="Get started" />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-16 border-t border-line bg-canvas py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <SectionHeading eyebrow="Contact" title="Talk to us about your site" body="Planning a deployment, a pilot or an academic partnership? Tell us about your cameras and we’ll help you choose the right setup." />
              <ul className="mt-8 space-y-4">
                {[
                  { icon: Workflow, title: 'We review your setup', body: 'Camera types, site layout and how your team responds today.' },
                  { icon: Send, title: 'You hear back by email', body: 'Usually within one business day.' },
                ].map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-fg-subtle">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-fg">{title}</p>
                      <p className="text-sm text-fg-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleContactSubmit} className="rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-7" noValidate>
              {contactSent && (
                <p role="status" className="mb-5 flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success-fg">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Thanks — your message has been sent.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input name="fullName" autoComplete="name" maxLength={120} />
                </Field>
                <Field label="Work email" required>
                  <Input name="email" type="email" autoComplete="email" />
                </Field>
                <Field label="Organization" optional>
                  <Input name="organization" autoComplete="organization" maxLength={200} />
                </Field>
                <Field label="Subject" required>
                  <Input name="subject" maxLength={200} placeholder="e.g. Warehouse pilot" />
                </Field>
                <Field label="Message" required hint="At least 10 characters." className="sm:col-span-2">
                  <Textarea name="message" rows={5} minLength={10} maxLength={5000} placeholder="Tell us about your site and cameras" />
                </Field>
              </div>
              <Button type="submit" size="lg" icon={Send} loading={contactSubmitting} className="mt-5 w-full sm:w-auto">
                Send message
              </Button>
            </form>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="bg-[#0B111D] text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-medium">Start monitoring this week</h2>
              <p className="mt-2 text-white/65">Create an account, choose a plan and connect your first camera in minutes.</p>
            </div>
            <div className="flex gap-3">
              <Button as={Link} to="/register" size="lg" iconRight={ArrowRight}>
                Create account
              </Button>
              <Button as={Link} to="/login" size="lg" variant="ghost" className="text-white/85 ring-1 ring-inset ring-white/20 hover:bg-white/10 hover:text-white">
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onNavigate={scrollToSection} />
    </div>
  );
};

export default LandingPage;
