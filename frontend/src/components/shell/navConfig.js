import {
  LayoutDashboard,
  Bell,
  Video,
  BarChart3,
  Users,
  Home,
  CreditCard,
  Package,
  LifeBuoy,
  Building2,
  UserCog,
  Receipt,
  Layers,
} from 'lucide-react';

/**
 * Navigation per role. Routes are the existing ones; only grouping and labels are new.
 * `alerts: true` marks the item that shows the live active-alert count.
 */
export const NAV = {
  org_admin: [
    {
      label: 'Monitor',
      items: [
        { to: '/orgadmin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/orgadmin/alerts', label: 'Alerts', icon: Bell, alerts: true },
        { to: '/orgadmin/cameras', label: 'Cameras', icon: Video },
        { to: '/orgadmin/reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Manage',
      items: [{ to: '/orgadmin/operators', label: 'Operators', icon: Users }],
    },
    {
      label: 'Account',
      items: [
        { to: '/customer/dashboard', label: 'Account home', icon: Home },
        { to: '/customer/subscription', label: 'Subscription', icon: CreditCard, also: ['/orgadmin/subscription'] },
        { to: '/customer/plans', label: 'Plans', icon: Package, also: ['/customer/subscribe', '/customer/downgrade-prep'] },
        { to: '/customer/help', label: 'Help & support', icon: LifeBuoy },
      ],
    },
  ],
  customer: [
    {
      label: 'Account',
      items: [
        { to: '/customer/dashboard', label: 'Home', icon: Home },
        { to: '/customer/plans', label: 'Plans', icon: Package, also: ['/customer/subscribe'] },
        { to: '/customer/subscription', label: 'Subscription', icon: CreditCard },
        { to: '/customer/help', label: 'Help & support', icon: LifeBuoy },
      ],
    },
  ],
  operator: [
    {
      label: 'Monitor',
      items: [
        { to: '/operator/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/operator/alerts', label: 'Alerts', icon: Bell, alerts: true },
        { to: '/operator/cameras', label: 'Live cameras', icon: Video },
      ],
    },
  ],
  super_admin: [
    {
      label: 'Platform',
      items: [
        { to: '/superadmin/dashboard', label: 'Overview', icon: LayoutDashboard },
        { to: '/superadmin/organizations', label: 'Organizations', icon: Building2 },
        { to: '/superadmin/users', label: 'Users', icon: UserCog },
        { to: '/superadmin/alerts', label: 'Alerts', icon: Bell, alerts: true },
      ],
    },
    {
      label: 'Billing',
      items: [
        { to: '/superadmin/subscription-plans', label: 'Plans', icon: Layers },
        { to: '/superadmin/orders', label: 'Orders', icon: Receipt },
      ],
    },
  ],
};

export const ROLE_LABEL = {
  super_admin: 'Super admin',
  org_admin: 'Organization admin',
  operator: 'Operator',
  customer: 'Customer',
};

export const ALERTS_PATH = {
  org_admin: '/orgadmin/alerts',
  operator: '/operator/alerts',
  super_admin: '/superadmin/alerts',
};

// Pages that are not in the sidebar but still need a breadcrumb.
const EXTRA_TITLES = [
  ['/customer/profile/edit', 'Account', 'Edit profile'],
  ['/customer/profile', 'Account', 'Profile'],
  ['/customer/settings', 'Account', 'Settings'],
  ['/customer/help/contact', 'Help & support', 'Contact support'],
  ['/customer/subscribe', 'Plans', 'Checkout'],
  ['/customer/downgrade-prep', 'Plans', 'Reduce cameras'],
  ['/orgadmin/subscription', 'Account', 'Subscription'],
];

/** Breadcrumb for the current path: { section, title }. */
export const pageMetaFor = (role, pathname) => {
  for (const [prefix, section, title] of EXTRA_TITLES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return { section, title };
  }
  for (const group of NAV[role] || []) {
    for (const item of group.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return { section: group.label, title: item.label };
    }
  }
  return { section: null, title: '' };
};

export const isNavItemActive = (item, pathname) =>
  [item.to, ...(item.also || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
