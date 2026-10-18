import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import { SITE_NAV } from './siteNav';

const SiteFooter = ({ onNavigate }) => (
  <footer className="border-t border-line bg-surface">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
      <div className="max-w-sm">
        <Logo />
        <p className="mt-3 text-sm text-fg-muted">
          Real-time fire and smoke detection on the cameras you already have, with an alert workflow your team can rely on.
        </p>
      </div>
      <nav aria-label="Footer — product">
        <p className="eyebrow">Product</p>
        <ul className="mt-3 space-y-2 text-sm">
          {SITE_NAV.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.(item.id);
                }}
                className="text-fg-muted hover:text-fg"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Footer — account">
        <p className="eyebrow">Account</p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link to="/login" className="text-fg-muted hover:text-fg">
              Sign in
            </Link>
          </li>
          <li>
            <Link to="/register" className="text-fg-muted hover:text-fg">
              Create an account
            </Link>
          </li>
          <li>
            <Link to="/forgot-password" className="text-fg-muted hover:text-fg">
              Reset password
            </Link>
          </li>
        </ul>
      </nav>
    </div>
    <div className="border-t border-line">
      <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-fg-subtle sm:px-6">© {new Date().getFullYear()} FireGuard AI. All rights reserved.</p>
    </div>
  </footer>
);

export default SiteFooter;
