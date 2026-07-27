export const FAQ_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        id: 'register',
        question: 'How do I create an account?',
        answer:
          'Click Get Started on the marketing site or choose a plan. Register with your email (OTP verification required) or sign in with Google. New accounts start as customers with access to the account portal.',
      },
      {
        id: 'purchase',
        question: 'How do I purchase a subscription?',
        answer:
          'From the portal, open Plans, pick a plan, and complete checkout. After purchase you become an Organization Admin with one organization tied to your email. You can manage operations from the org dashboard or stay in the account portal.',
      },
      {
        id: 'org-dashboard',
        question: 'What is the difference between the account portal and org dashboard?',
        answer:
          'The account portal (/customer/*) is your personal account home — profile, subscription, and plans. The org dashboard is for day-to-day operations: cameras, alerts, and operators. Use Open Org Dashboard from the profile menu when you need operational tools.',
      },
    ],
  },
  {
    id: 'subscription',
    title: 'Subscription & Billing',
    items: [
      {
        id: 'one-org',
        question: 'Can I create multiple organizations with one email?',
        answer:
          'No. Each email account can own one organization. If you already have an active subscription, checkout is blocked to prevent duplicate organizations.',
      },
      {
        id: 'expiry',
        question: 'What happens when my subscription expires?',
        answer:
          'Your portal dashboard and subscription page show expiry warnings. Contact support or review available plans to renew. A suspended organization may restrict org dashboard access until resolved.',
      },
      {
        id: 'payment',
        question: 'Is payment real at this stage?',
        answer:
          'Checkout is simulated for development. No real payment gateway is connected yet. Complete the form to activate your plan and organization immediately.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Security',
    items: [
      {
        id: 'profile',
        question: 'How do I update my profile?',
        answer:
          'Open your avatar menu → Edit Profile. You can change your name, phone, and profile photo. Email cannot be changed from the portal.',
      },
      {
        id: 'google-password',
        question: 'I signed in with Google. Can I also use a password?',
        answer:
          'Yes. Go to Settings → Password and use Set Password to add email/password sign-in. You can continue using Google sign-in as well.',
      },
      {
        id: 'forgot-password',
        question: 'I forgot my password. What should I do?',
        answer:
          'Use Forgot Password on the login page. A reset link will be sent to your email if an account exists. Google-only accounts should set a password first from Settings.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      {
        id: 'contact',
        question: 'How do I contact support?',
        answer:
          'Open Help in the account portal and use Contact Support to send a message. Include your account email and a brief description of your issue.',
      },
      {
        id: 'operators',
        question: 'Who can add operators to my organization?',
        answer:
          'Only Organization Admins can create and manage operators from the org dashboard under Operators. Operators monitor cameras and alerts assigned to them.',
      },
    ],
  },
];

export const getAllFaqItems = () =>
  FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({ ...item, category: category.title })),
  );
