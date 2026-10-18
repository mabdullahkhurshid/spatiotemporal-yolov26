import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import Logo from '../ui/Logo';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import { getInitialDarkMode, setTheme, subscribeToThemeChanges } from '../../utils/theme';
import { cn } from '../../utils/cn';
import { SITE_NAV } from './siteNav';

/** Public site header. `onNavigate(id)` scrolls to a section on the landing page. */
const SiteHeader = ({ onNavigate, accountHref, accountLabel }) => {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(getInitialDarkMode);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => subscribeToThemeChanges(setDark), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id) => {
    setOpen(false);
    onNavigate?.(id);
  };

  return (
    <header className={cn('sticky top-0 z-40 border-b transition-colors', scrolled || open ? 'border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80' : 'border-transparent bg-surface')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-md" aria-label="FireGuard AI home">
          <Logo />
        </Link>

        <nav aria-label="Site" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SITE_NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(item.id);
                  }}
                  className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <IconButton icon={dark ? Sun : Moon} label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(!dark)} />
          {accountHref ? (
            <Button as={Link} to={accountHref} size="sm" className="hidden sm:inline-flex">
              {accountLabel}
            </Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button as={Link} to="/register" size="sm" className="hidden sm:inline-flex">
                Get started
              </Button>
            </>
          )}
          <IconButton icon={open ? X : Menu} label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((v) => !v)} className="md:hidden" />
        </div>
      </div>

      {open && (
        <div id="site-menu" className="animate-fade-in border-t border-line bg-surface px-4 pb-4 pt-2 md:hidden">
          <ul className="space-y-1">
            {SITE_NAV.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => go(item.id)} className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-fg hover:bg-surface-2">
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
            {accountHref ? (
              <Button as={Link} to={accountHref} className="col-span-2">
                {accountLabel}
              </Button>
            ) : (
              <>
                <Button as={Link} to="/login" variant="secondary">
                  Sign in
                </Button>
                <Button as={Link} to="/register">
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
