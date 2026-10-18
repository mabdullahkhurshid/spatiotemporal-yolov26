import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import Logo from '../ui/Logo';

const POINTS = [
  'Fire and smoke detected on the cameras you already have',
  'Alerts confirmed across frames before anyone is paged',
  'Acknowledge, resolve and record every incident',
];

/**
 * Shared frame for sign-in, registration and password pages:
 * the form on the left, a brand panel on large screens.
 */
const AuthLayout = ({ title, description, children, footer }) => (
  <div className="flex min-h-screen bg-surface">
    <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-[46%] lg:px-14">
      <Link to="/" className="self-start rounded-md" aria-label="FireGuard AI home">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-2 text-sm text-fg-muted">{description}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-center text-sm text-fg-muted">{footer}</div>}
      </main>
      <p className="text-center text-xs text-fg-subtle lg:text-left">© {new Date().getFullYear()} FireGuard AI</p>
    </div>

    <aside aria-hidden="true" className="relative hidden flex-1 overflow-hidden bg-[#0B111D] lg:flex lg:items-center lg:justify-center">
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative max-w-md px-12">
        <p className="text-3xl font-semibold leading-tight tracking-tight text-white">Every camera, watched. Every alert, owned.</p>
        <ul className="mt-8 space-y-4">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm text-white/75">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-critical" />
            <p className="text-sm font-medium text-white">Battery Storage · High</p>
            <span className="ml-auto text-xs text-white/50">just now</span>
          </div>
          <p className="mt-1 pl-5 text-xs text-white/55">Fire 88% · Smoke 62% · confirmed over 3 frames</p>
        </div>
      </div>
    </aside>
  </div>
);

export default AuthLayout;
