# Automatic Purchase-to-Org-Admin Flow — Implementation Master Plan

**Project:** AI-Based Fire & Smoke Detection / Surveillance SaaS Platform  
**Last updated:** 2026-07-26

## Goal

Replace the Super Admin approval gate with a self-service path: register as a normal customer → purchase a plan → become Organization Admin with immediate dashboard access, while leaving all unrelated modules untouched.

## Architecture

Introduce a `customer` role for pre-purchase users, reuse the existing simulated checkout backend (`POST /api/subscriptions/checkout`), and remove all `isVerified` / pending-approval dependencies from the self-service path. Org Admin capabilities, operator management, cameras, alerts, Socket.io, and Super Admin authority stay as they are.

## Global Constraints

- Landing page marketing sections, pricing cards, and contact form: **unchanged**
- Plan-click registration entry: **unchanged** (preserve `/login?planId=...` flow)
- No payment gateway, no purchase form validation at this stage
- Role change to `org_admin` **only after purchase**, never at registration
- Operators creatable **only** by Organization Admin
- Super Admin retains suspend/delete/restrict powers; approval is **not required** anywhere in self-service flow
- Minimum diff only — no broad refactors

---

## Phase 1 — Data Model & Role Foundation

### Task 1.1: Add `customer` role
- `backend/models/User.js` — extend role enum
- `frontend/src/utils/roleRoutes.js` — customer → `/`
- `frontend/src/App.jsx` — routing for customer

### Task 1.2: Registration backend — customer-only signup
- `backend/controllers/authController.js` — no org creation at register; `role: customer`, `isVerified: true`

### Task 1.3: Registration frontend
- `frontend/src/pages/auth/Register.jsx` — stop sending organization; auto-login after OTP; preserve `planId` in sessionStorage

---

## Phase 2 — Remove Pending Approval Completely

### Task 2.1: Backend — bypass verification gate
- `backend/middleware/auth.js`, `userController.js`, `subscriptionController.js`

### Task 2.2: Frontend — remove pending approval UX
- `App.jsx`, remove `/pending-verification`, socket approval listeners

### Task 2.3: Login rules for customers
- `authController.js` login — allow customer without org

---

## Phase 3 — Customer Landing Experience

### Task 3.1: Customer profile menu on landing header
- `CustomerProfileMenu.jsx`, minimal `LandingPage.jsx` header change

### Task 3.1b: Wire `planId` through auth flow
- `Login.jsx`, `Register.jsx`, `LandingPage.jsx`

---

## Phase 4 — Purchase Flow (No Payment Gateway)

### Task 4.1: Purchase modal component
- `PurchasePlanModal.jsx`, `subscriptionApi.js`

### Task 4.2: Enhance checkout response
- `subscriptionController.js` — customer role, ACTIVE org, return tokens

---

## Phase 5 — Org Admin Subscription Visibility

### Task 5.1: Subscription info page
- `orgadmin/Subscription.jsx`, `GET /api/subscriptions/me`, optional history endpoint

---

## Phase 6 — Operator Management Enhancements

### Task 6.1: Operator welcome email
- `emailService.js`, `userController.js`

### Task 6.2: Operator CRUD UI + API gaps
- `Operators.jsx`, operator edit/deactivate/hard-delete

---

## Phase 7 — Super Admin Organization Hierarchy View

### Task 7.1: Enrich organizations API
- `organizationController.js` — admin + operatorCount

### Task 7.2: Hierarchy UI
- `SuperAdminOrganizations.jsx` — drill-down on click

---

## Phase 8 — Cleanup & Regression Safety

- Remove dead approval dependencies
- Route guard matrix validation
- `npm run build` + backend smoke test

---

## Phase 9 — Customer Portal (Account Home)

**Goal:** Move customers off the marketing landing page into a dedicated `/customer/*` portal that remains the account home after purchase. One organization per email. Org dashboard is optional; user returns to portal via Account link and avatar dropdown.

**Constraints:**
- No multiple org creation from the same email
- Landing marketing content unchanged for guests
- No payment gateway, no schema migrations
- Portal accessible to `customer` (pre-purchase) and `org_admin` (post-purchase)
- Operators and super_admin unchanged

### Phase 9.1 — Portal Shell & Routing

**Task 9.1.1:** `CustomerLayout`, `CustomerSidebar`, `CustomerHeader`
**Task 9.1.2:** `Dashboard.jsx` stub (welcome + pre-purchase empty state)
**Task 9.1.3:** `App.jsx` — mount `/customer/*` routes; legacy redirects (`/profile`, `/subscribe`)
**Task 9.1.4:** `roleRoutes.js` — `customer` and `org_admin` → `/customer/dashboard`
**Task 9.1.5:** `Login.jsx`, `Register.jsx`, `OAuthCallback.jsx` — portal redirects
**Task 9.1.6:** `LandingPage.jsx` — remove customer header; redirect authenticated customers/org_admins to portal
**Task 9.1.7:** `ProtectedRoute` — allow `customer` + `org_admin` on `/customer/*`

### Phase 9.2 — Plans & Subscribe in Portal

**Task 9.2.1:** Extract `PlanCardGrid` / `PlanCard` from `LandingPage.jsx`
**Task 9.2.2:** `PlansPage.jsx` at `/customer/plans`
**Task 9.2.3:** Move subscribe routes to `/customer/subscribe` and `/customer/subscribe/:planId`
**Task 9.2.4:** Post-checkout redirect → `/customer/subscription?success=1` (not org dashboard)
**Task 9.2.5:** `planId` flow from landing → portal subscribe
**Task 9.2.6:** Backend — block duplicate org / active subscription checkout for same account

### Phase 9.3 — Subscription & Dashboard Data

**Task 9.3.1:** `GET /api/users/me/account-summary` (user + org + subscription summary)
**Task 9.3.2:** `customerApi.js` — `getAccountSummary()`
**Task 9.3.3:** `SubscriptionPage.jsx` — plan, org, dates, role, usage, order history
**Task 9.3.4:** Dashboard post-purchase cards (subscription summary + org + Open Org Dashboard CTA)
**Task 9.3.5:** Expiry / suspended org status display

### Phase 9.4 — Profile, Dropdown, Settings, Help

**Task 9.4.1:** Redesign `ProfileViewPage` / `ProfileEditPage` (Facebook-style cover + avatar)
**Task 9.4.2:** Enhance `CustomerProfileMenu` — View/Edit Profile, Settings, Help, Open Org Dashboard, Logout
**Task 9.4.3:** `SettingsPage.jsx` — account, password/Google set-password link, theme
**Task 9.4.4:** `HelpPage.jsx` + `frontend/src/data/faq.js`
**Task 9.4.5:** Remove `role === 'customer'` guards on profile/subscribe pages where org_admin needs access
**Task 9.4.6:** Org admin `Header` / `Sidebar` — “Account” link back to `/customer/dashboard`

### Phase 9.5 — Polish & Regression

**Task 9.5.1:** Unify theme key (`localStorage.theme`) across landing, portal, admin
**Task 9.5.2:** Mobile sidebar drawer, skeletons, empty states
**Task 9.5.3:** `npm run build` + backend smoke test
**Task 9.5.4:** Update `REGRESSION_CHECKLIST.md`, `ARCHITECTURE_DECISIONS.md` (ADR-003)

---

## File Touch Summary

| File | Phase |
|---|---|
| `backend/models/User.js` | 1 |
| `backend/controllers/authController.js` | 1, 2 |
| `backend/controllers/subscriptionController.js` | 2, 4 |
| `backend/controllers/userController.js` | 2, 6 |
| `backend/controllers/organizationController.js` | 7 |
| `backend/middleware/auth.js` | 2 |
| `backend/services/emailService.js` | 6 |
| `frontend/src/App.jsx` | 1, 2 |
| `frontend/src/pages/auth/Register.jsx` | 1, 3 |
| `frontend/src/pages/auth/Login.jsx` | 3 |
| `frontend/src/pages/public/LandingPage.jsx` | 3, 4 |
| `frontend/src/components/CustomerProfileMenu.jsx` | 3 |
| `frontend/src/components/PurchasePlanModal.jsx` | 4 |
| `frontend/src/pages/orgadmin/Subscription.jsx` | 5 |
| `frontend/src/pages/orgadmin/Operators.jsx` | 6 |
| `frontend/src/pages/superadmin/Organizations.jsx` | 7 |
| `frontend/src/utils/roleRoutes.js` | 1, 9 |
| `frontend/src/layouts/CustomerLayout.jsx` | 9 |
| `frontend/src/components/CustomerSidebar.jsx` | 9 |
| `frontend/src/components/CustomerHeader.jsx` | 9 |
| `frontend/src/pages/customer/Dashboard.jsx` | 9 |
| `frontend/src/pages/customer/PlansPage.jsx` | 9 |
| `frontend/src/pages/customer/SubscriptionPage.jsx` | 9 |
| `frontend/src/pages/customer/SettingsPage.jsx` | 9 |
| `frontend/src/pages/customer/HelpPage.jsx` | 9 |
| `frontend/src/services/customerApi.js` | 9 |
| `backend/controllers/userController.js` | 6, 9 |

## Out of Scope

Payment gateway, landing content redesign, camera/AI/alert changes, Orders module completion, Reports stub, schema migrations unless explicitly authorized, **multiple organizations per email**.
