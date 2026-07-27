# Current Iteration

**Iteration:** Customer Portal (Account Home)  
**Started:** 2026-07-26  
**Status:** Phase 9.5 complete — Customer Portal iteration finished

## Current Step

**Phase 9 complete** — awaiting next iteration instruction

## Phase 9 Overview

| Phase | Name | Status |
|-------|------|--------|
| **9.1** | Portal Shell & Routing | **Complete** |
| **9.2** | Plans & Subscribe in Portal | **Complete** |
| **9.3** | Subscription & Dashboard Data | **Complete** |
| **9.4** | Profile, Dropdown, Settings, Help | **Complete** |
| **9.5** | Polish & Regression | **Complete** |

---

## Completed — Phase 9.1

- [x] Task 9.1.1: `CustomerLayout`, `CustomerSidebar`, `CustomerHeader`
- [x] Task 9.1.2: `Dashboard.jsx` stub
- [x] Task 9.1.3: `App.jsx` routes + legacy redirects
- [x] Task 9.1.4: `roleRoutes.js` portal paths (`customer` + `org_admin` → `/customer/dashboard`)
- [x] Task 9.1.5: Auth redirects via updated `getDashboardPathForRole`
- [x] Task 9.1.6: `LandingPage.jsx` portal redirect; customer header removed
- [x] Task 9.1.7: `ProtectedRoute` allows `customer` + `org_admin` on `/customer/*`

## Completed — Phase 9.2

- [x] Task 9.2.1: Extract `PlanCardGrid` / `PlanCard` (+ shared `planFormatting.js`)
- [x] Task 9.2.2: `PlansPage.jsx` at `/customer/plans`
- [x] Task 9.2.3: Subscribe routes under `/customer/subscribe` and `/customer/subscribe/:planId` (polished)
- [x] Task 9.2.4: Post-checkout → `/customer/subscription?success=1`
- [x] Task 9.2.5: `planId` flow via `getPostAuthRedirectPath` (Login, Register, OAuth, landing, dashboard)
- [x] Task 9.2.6: Backend single-org checkout guard in `subscriptionController.js`

## Completed — Phase 9.3

- [x] Task 9.3.1: `GET /api/users/me/account-summary`
- [x] Task 9.3.2: `customerApi.js` — `getAccountSummary()`
- [x] Task 9.3.3: `SubscriptionPage.jsx` — plan, org, dates, role, usage, order history
- [x] Task 9.3.4: Dashboard post-purchase cards (subscription summary + org + Open Org Dashboard CTA)
- [x] Task 9.3.5: Expiry / suspended org status display

## Completed — Phase 9.4

- [x] Task 9.4.1: Redesign `ProfileViewPage` / `ProfileEditPage` (Facebook-style cover + avatar via `ProfileHero`)
- [x] Task 9.4.2: Enhance `CustomerProfileMenu` — grouped items, View/Edit Profile, Settings, Help, Open Org Dashboard, Logout
- [x] Task 9.4.3: `SettingsPage.jsx` — account info, Google set-password link, forgot-password link, theme toggle
- [x] Task 9.4.4: `HelpPage.jsx` + `frontend/src/data/faq.js` (accordion FAQ)
- [x] Task 9.4.5: Portal access via `isPortalUser` on subscribe (org_admin redirected); profile pages allow org_admin
- [x] Task 9.4.6: Org admin `Header` / `Sidebar` — “Account” link to `/customer/dashboard`

## Phase 9.4 Validation

- [x] `npm run build` (frontend) succeeded
- [x] Backend modules load without errors

## Phase 9.4 Change Report

### New files

- `frontend/src/components/profile/ProfileHero.jsx` — Facebook-style cover banner + overlapping avatar
- `frontend/src/data/faq.js` — FAQ categories and items for Help page

### Modified files

- `frontend/src/pages/customer/ProfileViewPage.jsx` — hero layout, About section, org admin CTA
- `frontend/src/pages/customer/ProfileEditPage.jsx` — hero layout with inline photo edit
- `frontend/src/components/CustomerProfileMenu.jsx` — grouped menu, escape/outside close, danger logout styling
- `frontend/src/pages/customer/SettingsPage.jsx` — account, password, appearance (theme via `localStorage.theme`)
- `frontend/src/pages/customer/HelpPage.jsx` — FAQ accordion + contact CTA
- `frontend/src/pages/customer/SubscribePage.jsx` — `isPortalUser` guard (org_admin → dashboard)
- `frontend/src/components/Sidebar.jsx` — org admin “Account” nav link
- `frontend/src/components/Header.jsx` — org admin “Account” header link

---

## Phase 9.5 — Polish & Regression

- [x] Task 9.5.1: Unify theme key (`localStorage.theme`) across landing, portal, admin
- [x] Task 9.5.2: Mobile sidebar drawer, skeletons, empty states
- [x] Task 9.5.3: `npm run build` + backend smoke test
- [x] Task 9.5.4: Update `REGRESSION_CHECKLIST.md`, `ARCHITECTURE_DECISIONS.md` (ADR-003)

## Phase 9.5 Validation

- [x] `npm run build` (frontend) succeeded
- [x] Backend modules load without errors

## Phase 9.5 Change Report

### New files

- `frontend/src/utils/theme.js` — shared theme init, persistence (`localStorage.theme`), legacy `darkMode` migration
- `frontend/src/components/ui/PortalSkeletons.jsx` — dashboard, subscription, plans, settings loading skeletons

### Modified files

- `frontend/index.html` — inline theme script to prevent flash of wrong theme
- `frontend/src/main.jsx` — call `initTheme()` on boot
- `frontend/src/components/Header.jsx` — admin header uses unified `theme` key
- `frontend/src/pages/public/LandingPage.jsx` — uses shared theme utilities
- `frontend/src/pages/customer/SettingsPage.jsx` — uses shared theme utilities + skeleton
- `frontend/src/layouts/CustomerLayout.jsx` — menu toggle wired to header
- `frontend/src/components/CustomerHeader.jsx` — mobile menu button in header
- `frontend/src/components/CustomerSidebar.jsx` — drawer-only sidebar (toggle moved to header)
- `frontend/src/pages/customer/Dashboard.jsx` — loading skeleton
- `frontend/src/pages/customer/SubscriptionPage.jsx` — loading skeleton
- `frontend/src/components/plans/PlanCardGrid.jsx` — plan card skeletons + dashed empty state

---

## Change Log

| Date | Step | Summary |
|------|------|---------|
| 2026-07-26 | Phase 9.1 | Customer portal shell, routing, landing redirect, legacy path redirects, build passed |
| 2026-07-26 | Phase 9.2 | PlanCard extraction, PlansPage, subscribe flow in portal, post-checkout redirect, planId auth flow, checkout guard, build passed |
| 2026-07-26 | Phase 9.3 | Account summary API, SubscriptionPage, Dashboard data cards, expiry/suspended banners, build passed |
| 2026-07-26 | Phase 9.4 | Profile hero redesign, settings/help pages, profile menu polish, org admin Account links, build passed |
| 2026-07-26 | Phase 9.5 | Unified theme key, portal skeletons/empty states, mobile drawer polish, build passed |
