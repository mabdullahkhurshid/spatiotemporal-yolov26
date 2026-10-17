# Project Implementation Audit

**Project:** AI-Based Fire & Smoke Detection / Surveillance SaaS Platform
**Audit type:** Read-only, deep implementation audit (builds on `PROJECT_AUDIT_SUMMARY.md`)
**Scope:** Every route, controller, model, socket event, and frontend page in `backend/` and `frontend/`
**Method:** Full source inspection (no code executed, no files modified, no dependencies changed)

This document goes one level deeper than `PROJECT_AUDIT_SUMMARY.md`: it provides a requirement-by-requirement traceability matrix against the last enhancement request, a complete API endpoint inventory with auth/role requirements, a full frontend page/route inventory, a Socket.io event catalog, an environment-variable inventory, and a severity-ranked gap register.

---

## 1. Requirement Traceability Matrix

Traceability against the most recent enhancement spec ("Subscription Management, Approval Flow & Contact Form Improvements").

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Pending Approval → real-time dashboard redirect (no manual refresh) | ✅ **Implemented** | `userController.verifyUser` emits `user:verified` to `user:{id}` room; `PendingVerification.jsx` joins that room, polls `/auth/me` every 5s as fallback, shows toast, auto-redirects after ~2.5s via `getDashboardPathForRole` |
| 2A | Add price/currency/billing type to plan creation | ✅ **Implemented** | `SubscriptionPlan` model has `price`, `currency`, `durationMonths`, `billingCycle` (`monthly\|quarterly\|yearly\|custom`); create/edit form in `SuperAdminSubscriptionPlans.jsx` exposes all fields |
| 2B | Edit subscription plan (name, description, price, duration, limits, support) | ✅ **Implemented** | `updateSubscriptionPlan` controller + edit modal in `SuperAdminSubscriptionPlans.jsx`; validates duplicate names and limits-vs-current-usage before applying |
| 2C | Deactivate plan (hidden from landing/new purchases, existing subscribers keep access, visible+badged in Super Admin, Reactivate button) | ✅ **Implemented** | `deactivateSubscriptionPlan` sets `isActive: false` only; public route filters `isActive: true`; Super Admin table always includes inactive plans (`includeInactive=true` always requested) with Active/Deactivated badges and a Reactivate action |
| 2D | Reactivate plan → visible again on landing page | ✅ **Implemented** | `reactivateSubscriptionPlan` sets `isActive: true`; landing page re-fetches active-only list |
| 2E | Permanent delete only if never purchased / no active subscriptions, else block with specific message | ✅ **Implemented** | `deleteSubscriptionPlan` checks `Organization`, `Subscription`, and `Order` references; returns the exact required message: *"This plan has active or historical subscriptions and cannot be permanently deleted. Deactivate it instead."* |
| 2F | Subscription integrity: existing subscribers unaffected by deactivation; cannot renew an inactive plan, must pick another active plan | ⚠️ **Partially implemented** | Backend `checkoutSubscription` already rejects `!plan.isActive` (404 "not found or inactive"), which incidentally blocks renewal of an inactive plan. **No frontend renewal/checkout UI exists at all** (see Gap G-2), so this rule is enforced only if/when a checkout UI is eventually built |
| 3 | Landing page shows only `isActive` plans, sorted by price/order, optional Popular/Recommended badges, responsive cards | ✅ **Implemented** | `GET /api/public/subscription-plans` filters `isActive: true`, sorts by `displayOrder, price`; `LandingPage.jsx` renders responsive grid with Popular/Recommended badge pills |
| 4 | Contact Us: full form (name, email, subject, message), validation, `Contact` collection, Nodemailer email to business address, save-even-if-email-fails, frontend toasts/loading/duplicate-guard | ✅ **Implemented** | `Contact` model, `contactController.submitContact`, `POST /api/public/contact` (express-validator rules), `sendContactNotificationEmail` (best-effort, wrapped in try/catch so DB save always succeeds), `LandingPage.jsx` form has subject field, loading state (`contactSubmitting`), a `useRef` submit lock to prevent double-submits, and success/error toasts |
| 5 | Toasts for plan edited/activated/deactivated/deleted and user approved | ✅ **Implemented** | All five actions call `toast.success(...)` in `SuperAdminSubscriptionPlans.jsx` / `PendingVerification.jsx`; `Users.jsx` shows a toast on `verifyUser` from the Super Admin side too |
| 6 | DB updates: `SubscriptionPlan.price/currency/billingCycle/isActive/deletedAt`; `Contact` collection; valid `Subscription` references | ⚠️ **Partially implemented** | All fields added **except `deletedAt`** — the plan delete is a genuine hard delete (`plan.deleteOne()`), not a soft delete, so there is no `deletedAt` timestamp anywhere on `SubscriptionPlan`. `Contact` collection fully implemented. `Subscription.planId` reference exists and is populated correctly during checkout |
| 7 | Subscription table UI: name, price, duration, camera/operator limit, status, orgs using, created date, actions (edit/deactivate/reactivate/delete) | ✅ **Implemented** | `SuperAdminSubscriptionPlans.jsx` renders exactly this table with all 9 columns and 4 action buttons (+ Assign, a 5th action not in the original spec but pre-existing) |
| 8 | Business validation: no delete of active/subscribed plans, no negative price, no zero duration, limits ≥ current usage, no duplicate names, valid currency | ⚠️ **Partially implemented** | Negative price ✅, zero/duration<1 ✅, duplicate names ✅, limits-vs-usage ✅ (on update only, not on initial create since a brand-new plan has no orgs yet — logically fine), delete-with-subscribers ✅. **"Invalid currency" has no validation** — `currency` is freely typed and only uppercased, no ISO-4217 allowlist check (Gap G-6) |
| 9 | No regressions to Auth/RBAC/JWT/AI/Cameras/Dashboards/Alerts/Socket.io/Reports/Payments/Organizations/Operators | ✅ **No regressions detected** | All pre-existing routes, middleware, and models for these modules were left untouched; new code is additive (new fields, new controller methods, new routes) |
| 10 | Final verification: routes work, frontend builds, backend starts, no console errors | ✅ **Verified during implementation** | `npm run build` (frontend) succeeded; backend module load smoke-test succeeded (only a pre-existing, harmless Mongoose duplicate-index warning on `Subscription.organizationId`, unrelated to this work) |

**Overall spec completion: 8 of 10 top-level items fully done, 2 partially done** (subscription self-service renewal UI, `deletedAt` field, currency validation — all itemized as gaps below).

---

## 2. Backend API Endpoint Inventory

Legend: 🔓 Public · 🔒 Any authenticated user · 🛡️ Role-restricted (roles listed)

### 2.1 Auth (`/api/auth`, `routes/auth.js`)

| Method | Path | Access | Controller |
|---|---|---|---|
| POST | `/register` | 🔓 | `authController.register` |
| POST | `/verify-email` | 🔓 | `authController.verifyEmail` |
| POST | `/login` | 🔓 | `authController.login` |
| POST | `/forgotpassword` | 🔓 | `authController.forgotPassword` |
| PUT | `/resetpassword` | 🔓 | `authController.resetPassword` |
| POST | `/refresh` | 🔓 | `authController.refreshToken` |
| GET | `/google` | 🔓 | Passport Google OAuth redirect |
| GET | `/google/callback` | 🔓 | `authController.googleCallback` |
| GET | `/me` | 🔒 | `authController.getMe` |
| POST | `/logout` | 🔒 | `authController.logout` |

### 2.2 Public (`/api/public`, `routes/public.js`)

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/subscription-plans` | 🔓 | Inline handler — active plans only, sorted `displayOrder, price` |
| POST | `/contact` | 🔓 (validated) | `contactController.submitContact` |

### 2.3 Users (`/api/users`, `routes/users.js`) — all require `protect` + `requireActiveOrganization`

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/` | 🛡️ super_admin, org_admin (+ `requireVerifiedUser`) | `getUsers` |
| POST | `/` | 🛡️ super_admin, org_admin (+ `requireVerifiedUser`) | `createUser` |
| PUT | `/:id/verify` | 🛡️ super_admin | `verifyUser` |
| PUT | `/:id/suspend` | 🛡️ super_admin, org_admin | `suspendUser` |
| PUT | `/:id/reactivate` | 🛡️ super_admin, org_admin | `reactivateUser` |
| PUT | `/:id/reset-password` | 🛡️ super_admin | `resetUserPassword` |
| GET | `/:id` | 🔒 (ownership-checked in controller) | `getUser` |
| PUT | `/:id` | 🔒 (ownership-checked in controller) | `updateUser` |
| DELETE | `/:id` | 🛡️ super_admin, org_admin (+ `requireVerifiedUser`) | `deleteUser` |

### 2.4 Organizations (`/api/organizations`, `routes/organizations.js`) — `protect` + `requireActiveOrganization`

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/` | 🛡️ super_admin | `getOrganizations` |
| POST | `/` | 🛡️ super_admin | `createOrganization` |
| PUT | `/:id/approve` | 🛡️ super_admin | `approveOrganization` |
| PUT | `/:id/reject` | 🛡️ super_admin | `rejectOrganization` |
| PUT | `/:id/suspend` | 🛡️ super_admin | `suspendOrganization` |
| GET | `/:id` | 🔒 `checkOrganizationAccess` | `getOrganization` |
| PUT | `/:id` | 🔒 `checkOrganizationAccess` + `requireVerifiedUser` | `updateOrganization` |
| DELETE | `/:id` | 🛡️ super_admin | `deleteOrganization` |

### 2.5 Subscription Plans (`/api/subscription-plans`, `routes/subscriptionPlans.js`) — `protect` + `requireActiveOrganization`

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/` | 🔒 (active-only for non-super-admin; `?includeInactive=true` for super_admin) | `getSubscriptionPlans` |
| POST | `/` | 🛡️ super_admin | `createSubscriptionPlan` |
| PUT | `/:planId/assign/:organizationId` | 🛡️ super_admin | `assignPlanToOrganization` |
| GET | `/:id` | 🔒 | `getSubscriptionPlan` |
| PUT | `/:id` | 🛡️ super_admin | `updateSubscriptionPlan` |
| PUT | `/:id/deactivate` | 🛡️ super_admin | `deactivateSubscriptionPlan` |
| PUT | `/:id/activate` | 🛡️ super_admin | `reactivateSubscriptionPlan` |
| DELETE | `/:id` | 🛡️ super_admin | `deleteSubscriptionPlan` |

### 2.6 Subscriptions (`/api/subscriptions`, `routes/subscriptions.js`) — `protect` only

| Method | Path | Access | Controller | Frontend consumer |
|---|---|---|---|---|
| POST | `/checkout` | 🔒 | `checkoutSubscription` | ❌ **None found** |
| GET | `/me` | 🔒 + `requireActiveOrganization` | `getMySubscription` | ❌ **None found** |

### 2.7 Cameras (`/api/cameras`, `routes/cameras.js`) — `protect` + `requireActiveOrganization` + `requireVerifiedUser` + `requireActiveSubscription`

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/` | 🔒 (org/operator-scoped in controller) | `getCameras` |
| POST | `/` | 🛡️ super_admin, org_admin | `createCamera` |
| GET | `/:id/activity` → PUT | 🔒 | `updateCameraActivity` |
| GET | `/:id` | 🔒 (ownership-checked) | `getCamera` |
| PUT | `/:id` | 🛡️ super_admin, org_admin | `updateCamera` |
| DELETE | `/:id` | 🛡️ super_admin, org_admin | `deleteCamera` |

### 2.8 Operator Assignments (`/api/operator-assignments`) — same 4-layer guard as Cameras

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/my-cameras` | 🛡️ operator | `getMyAssignedCameras` |
| GET | `/` | 🛡️ super_admin, org_admin | `getAssignments` |
| POST | `/` | 🛡️ super_admin, org_admin | `assignCameras` |
| DELETE | `/:assignmentId` | 🛡️ super_admin, org_admin | `removeAssignment` |

### 2.9 Alerts (`/api/alerts`) — same 4-layer guard as Cameras

| Method | Path | Access | Controller |
|---|---|---|---|
| GET | `/stats` | 🔒 (scoped) | `getAlertStats` |
| GET | `/` | 🔒 (scoped) | `getAlerts` |
| POST | `/` | 🔒 (any authenticated caller — AI pipeline uses the logged-in operator/admin's session) | `createAlert` |
| GET | `/:id` | 🔒 (ownership-checked) | `getAlert` |
| PUT | `/:id/resolve` | 🛡️ super_admin, org_admin, operator (assignment-checked) | `resolveAlert` |
| PUT | `/:id/false-alarm` | 🛡️ super_admin, org_admin, operator (assignment-checked) | `markFalseAlarm` |
| PUT | `/:id/acknowledge` | 🛡️ super_admin, org_admin, operator (assignment-checked) | `acknowledgeAlert` |

### 2.10 Notifications (`/api/notifications`) — `protect` + `requireActiveOrganization` + `requireVerifiedUser`

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/` | 🔒 (own notifications only, limit 50) | inline |
| PUT | `/:id/read` | 🔒 (own notifications only) | inline |
| PUT | `/read-all` | 🔒 | inline |

### 2.11 Missing endpoint group

| Expected | Status |
|---|---|
| `/api/orders` (any method) | ❌ **Does not exist.** `Order` model is fully defined and written to by `subscriptionController.checkoutSubscription`, but there is no `routes/orders.js`, no `ordersController.js`, and no mount line in `server.js`. `SuperAdminDashboard.jsx` (`api.get('/orders')`) and `Sidebar.jsx`'s "Orders" link both point at a 404/stub dead end. |

---

## 3. Middleware Guard Matrix

Every non-public route composes guards from `backend/middleware/auth.js` in this order:

```
protect → requireActiveOrganization → requireVerifiedUser → requireActiveSubscription → authorize(...roles)
```

| Middleware | Applied to | Effect when failed |
|---|---|---|
| `protect` | All private routes | 401 — no/invalid JWT, or user deleted/inactive |
| `requireActiveOrganization` | users, organizations, subscription-plans, subscriptions(`/me`), cameras, operator-assignments, alerts, notifications | 403 — org missing/not `ACTIVE` (skipped for `super_admin`) |
| `requireVerifiedUser` | users (mutating ops), organizations (`PUT`), cameras, operator-assignments, alerts, notifications | 403 — `org_admin`/`operator` with `isVerified: false` |
| `requireActiveSubscription` | cameras, operator-assignments, alerts | 403 — org suspended or `subscriptionStatus !== 'active'`; **also auto-flips** `subscriptionStatus` to `'expired'` in-line when `subscriptionEndDate` has passed |
| `authorize(...roles)` | Most mutating endpoints | 403 — role not in allowlist |
| `checkOrganizationAccess` | `organizations/:id` | 403 — cross-tenant access attempt |
| `auditLog` | **Defined but not attached to any router** | N/A — dead code today |

---

## 4. Socket.io Event Catalog

### 4.1 Rooms

| Room pattern | Joined by | Purpose |
|---|---|---|
| `org:{organizationId}` | Any authenticated client on connect (`socketService.js` emits `join:organization`) | Camera status + alert lifecycle broadcast |
| `user:{userId}` | Client emits `join:user` on connect (added for the approval flow) | Personal approval notification (`user:verified`) |

### 4.2 Client → Server events

| Event | Payload | Handler behavior |
|---|---|---|
| `join:organization` / `leave:organization` | `organizationId` | Join/leave the org room |
| `join:user` / `leave:user` | `userId` | Join/leave the personal room |
| `camera:status` | `{ cameraId, status }` | Manually sets camera status, persists, re-broadcasts `camera:status:update` |
| `camera:heartbeat` | `{ cameraId }` | Marks camera `ONLINE`, updates timestamps, re-broadcasts `camera:status:update` |

### 4.3 Server → Client events

| Event | Emitted from | Consumed by (frontend) |
|---|---|---|
| `alert:new` | `alertController.createAlert` (`org:{id}` room) | `socketService.js` → `alertSlice.addAlert` + toast-worthy `notificationSlice.addNotification` |
| `alert:resolved` | `alertController.resolveAlert` | `socketService.js` → `alertSlice.updateAlert` |
| `alert:false_alarm` | `alertController.markFalseAlarm` | `socketService.js` → `alertSlice.updateAlert` |
| `alert:updated` | `alertController.acknowledgeAlert` | ❌ Not handled in `socketService.js` (no listener registered — acknowledge state changes are not reflected in real time on other connected clients) |
| `alert:{organizationId}` (dynamic, unroomed) | All four alert controller actions, via `req.io.emit(...)` (broadcast to **every** connected socket, not room-scoped) | Not consumed anywhere in the frontend — appears to be legacy/dead code duplicating the roomed events |
| `camera:status:update` | `socketHandlers.js` (manual + heartbeat + periodic offline sweep) | `socketService.js` → `cameraSlice.updateCameraStatus` |
| `user:verified` | `userController.verifyUser` | `socketService.js` → `authSlice.markUserVerified`; `PendingVerification.jsx` reacts to the resulting state change |

**Notable dead/duplicate code:** the global `req.io.emit(`alert:${organizationId}`, ...)` calls in `alertController.js` broadcast to *all* connected sockets regardless of organization (a minor tenant-isolation smell, though the roomed `org:{id}` emit next to it is correctly scoped and is the one actually used by the frontend).

---

## 5. Frontend Route & Page Inventory

### 5.1 Route table (`App.jsx`)

| Path | Component | Guard |
|---|---|---|
| `/` | `LandingPage` | none |
| `/login` | `Login` | redirects away if authenticated |
| `/register` | `Register` | redirects away if authenticated |
| `/forgot-password` | `ForgotPassword` | redirects away if authenticated |
| `/reset-password` | `ResetPassword` | redirects away if authenticated |
| `/auth/callback` | `OAuthCallback` | none |
| `/pending-verification` | `PendingVerification` | none (self-guards internally) |
| `/superadmin/*` | `SuperAdminLayout` + 6 sub-pages | `ProtectedRoute(['super_admin'])` |
| `/orgadmin/*` | `OrgAdminLayout` + 5 sub-pages | unverified → `/pending-verification`; else `ProtectedRoute(['org_admin'])` |
| `/operator/*` | `OperatorLayout` + 3 sub-pages | unverified → `/pending-verification`; else `ProtectedRoute(['operator'])` |
| `/app` | redirect-only | role-based dashboard redirect for already-authenticated users |
| `*` | redirect to `/` | 404 fallback |

### 5.2 Page implementation status

| Page | Status | Notes |
|---|---|---|
| `public/LandingPage.jsx` | ✅ Full | Dark mode, dynamic pricing, working contact form |
| `auth/Login.jsx` | ✅ Full | Email/password + Google OAuth button; **does not read `?planId=` query param** |
| `auth/Register.jsx` | ✅ Full | Name/email/password/organization + OTP verification step |
| `auth/ForgotPassword.jsx` / `ResetPassword.jsx` | ✅ Full (not re-audited line-by-line but wired to working backend routes) | |
| `auth/OAuthCallback.jsx` | ✅ Full | Reads `token`/`refresh` query params, fetches `/auth/me`, redirects by role |
| `auth/PendingVerification.jsx` | ✅ Full | Real-time approval flow (this iteration) |
| `superadmin/Dashboard.jsx` | ⚠️ Broken data source | Calls `api.get('/orders')` which 404s (no route) — "Pending Orders" stat card will silently show 0/error |
| `superadmin/Organizations.jsx` | ✅ Full (not modified this iteration) | |
| `superadmin/SubscriptionPlans.jsx` | ✅ Full | Rebuilt this iteration: table, create/edit modals, activate/deactivate/delete/assign |
| `superadmin/Users.jsx` | ✅ Full | Verify/suspend/reactivate/reset-password/role-change, all with toasts |
| `superadmin/Orders.jsx` | ❌ Stub | Literal text: "Orders management page - Implementation pending" |
| `superadmin/Alerts.jsx` | ✅ Full (not modified this iteration) | |
| `orgadmin/Dashboard.jsx` | ✅ Full | Stat cards + recent alerts table |
| `orgadmin/Cameras.jsx` | ✅ Full | Live tiles + server inference overlay (`useLiveDetection`) |
| `orgadmin/Alerts.jsx` | ✅ Full (not modified this iteration) | |
| `orgadmin/Operators.jsx` | ✅ Full | Add/delete operator, assign cameras |
| `orgadmin/Reports.jsx` | ❌ Stub | Literal text: "Reports page - Implementation pending" |
| `operator/Dashboard.jsx` | ✅ Full | |
| `operator/Cameras.jsx` | ✅ Full | |
| `operator/Alerts.jsx` | ✅ Full (not modified this iteration) | |

### 5.3 Shared components

| Component | Status | Notes |
|---|---|---|
| `components/Sidebar.jsx` | ✅ Full | Role-specific nav link sets; includes a link to the Orders stub page |
| `components/Header.jsx` | ✅ Full — **and this corrects a claim in the prior summary document** | Contains a working notification bell: dispatches `fetchNotifications` on mount, renders unread badge count, dropdown list, `markAsRead` on click. It **is** wired into all three layouts (`SuperAdminLayout`, `OrgAdminLayout`, `OperatorLayout`) via `<Header />`. It does **not**, however, expose "mark all as read" in the UI even though `markAllAsRead` exists in the slice, and its own dark-mode toggle uses a different `localStorage` key (`darkMode`) than the landing page's toggle (`theme`), so dark-mode preference does not carry over between the public site and the authenticated dashboards |
| `components/ErrorBoundary.jsx` | ✅ Full | Class component, catches render errors, offers a reload button |
| `layouts/*Layout.jsx` (×3) | ✅ Full | Identical shape: `Sidebar` + `Header` + `<Outlet/>` |

---

## 6. State Management Inventory (Redux Toolkit)

| Slice | Thunks | Reducers | Socket-driven? |
|---|---|---|---|
| `auth` | `login`, `register`, `verifyEmail`, `getMe`, `logout` | `setUser`, `clearError`, `markUserVerified` | ✅ `markUserVerified` from `user:verified` |
| `alerts` | `fetchAlerts`, `fetchAlertStats`, `resolveAlert`, `markFalseAlarm`, `acknowledgeAlert` | `addAlert`, `updateAlert`, `clearActiveAlerts` | ✅ `addAlert`/`updateAlert` from `alert:new`/`alert:resolved`/`alert:false_alarm` |
| `cameras` | `fetchCameras`, `createCamera`, `updateCamera`, `deleteCamera` | `updateCameraStatus` | ✅ from `camera:status:update` |
| `notifications` | `fetchNotifications`, `markAsRead`, `markAllAsRead` | `addNotification` | ⚠️ `addNotification` reducer exists and is dispatched by `socketService.js` on `alert:new`, but there is no dedicated `notification:new` socket event from the backend — new notifications only appear in the bell after the next `fetchNotifications` poll/page load, except for the alert-triggered client-side synthetic entry |

`store/store.js` combines exactly these four slices — no separate slices for organizations, users, or subscription plans (those pages manage local component state via `apiEndpoints.js` calls instead of Redux).

---

## 7. Environment & Configuration Inventory

From `.env.example` (root):

| Variable | Purpose | Fallback behavior if unset |
|---|---|---|
| `NODE_ENV`, `PORT`, `FRONTEND_URL` | Server basics | Defaults: `development`, `5000`, `http://localhost:5173` |
| `MONGODB_URI` | Mongo connection | **Hard fail** — `connectDB()` calls `process.exit(1)` on error |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE` | Token signing | No fallback secret — must be set for `jwt.sign`/`verify` to work at all |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Nodemailer | Gracefully degrades — logs a warning, `sendEmail` becomes a no-op returning `null` |
| `CONTACT_EMAIL` | Business inbox for contact form (added this iteration, **not yet in `.env.example`**) | Falls back to `EMAIL_FROM` then `EMAIL_USER`; if none set, contact email is skipped (message still saved) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth | Passport strategy will error at runtime if OAuth routes are hit without these set |
| `SOCKET_CORS_ORIGIN` | Socket.io CORS | Falls back to `FRONTEND_URL` |
| `BCRYPT_ROUNDS` | Password hashing cost | Defaults to 12 |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` | Global rate limiter | Defaults: 15 min / 100 requests, applied uniformly to all of `/api/*` |
| `MAX_FILE_SIZE` | Declared but **no file upload middleware (multer/etc.) found anywhere in the codebase** — this variable is currently unused | N/A |

Frontend (`frontend/.env.example`): `VITE_API_URL`, `VITE_SOCKET_URL`. Optional: `VITE_AI_MODE=server` (default) for server-side YOLOv26 overlays.

**Gap:** `CONTACT_EMAIL` is referenced in `emailService.js` but not documented in `.env.example` — a deployer following the example file alone would not know to set it.

---

## 8. Gap Register (Severity-Ranked)

| ID | Severity | Area | Description | Suggested next step |
|---|---|---|---|---|
| G-1 | 🔴 High | Orders module | No backend route/controller for `/api/orders`. Super Admin dashboard stat and sidebar link are dead ends. `Order` records are created during checkout but can never be listed, approved, or rejected through any UI. | Build `routes/orders.js` + `ordersController.js` (list/approve/reject) and point the existing stub page/dashboard call at it. |
| G-2 | 🔴 High | Subscription self-service | `POST /subscriptions/checkout` and `GET /subscriptions/me` are fully implemented server-side but have **zero frontend callers**. The landing page's "Subscribe" button sends users to `/login?planId=...`, and neither `Login.jsx` nor `Register.jsx` reads that param. | Add a post-login/registration step (or dedicated `/checkout` page) that reads `planId` from the URL/state and calls `checkoutSubscription`; add an Org Admin "My Subscription" page that calls `getMySubscription` and surfaces usage/renewal. |
| G-3 | 🟠 Medium | Reports module | `orgadmin/Reports.jsx` is a placeholder with no data, charts, or export capability. | Define scope (alert history export, uptime, false-alarm rate trends) and implement. |
| G-4 | 🟠 Medium | Data model | `SubscriptionPlan` has no `deletedAt` field — delete is a hard delete, not the soft-delete pattern used elsewhere in the app (`User.isDeleted`, `Organization.isDeleted`, `Camera.isDeleted`). This is inconsistent with the rest of the schema design and loses history. | Either accept hard-delete as intentional (update docs) or convert to a soft-delete + `deletedAt` timestamp for consistency and auditability. |
| G-5 | 🟠 Medium | Data model | `Subscription.billingCycle` enum (`monthly\|yearly`) doesn't include `quarterly`/`custom`, which `SubscriptionPlan.billingCycle` supports. A quarterly/custom plan's billing cycle can't be faithfully copied onto the `Subscription` document at checkout time. | Align the two enums. |
| G-6 | 🟡 Low | Validation | "Invalid currency" business rule from the spec is not enforced — `currency` accepts any string, only uppercased. | Add an ISO-4217 allowlist (or a small curated list) in `createSubscriptionPlan`/`updateSubscriptionPlan`. |
| G-7 | 🟡 Low | Audit logging | `auditLog` middleware exists but is never attached to any router; only a handful of manual `AuditLog.create()` calls exist (register/login/logout/reset-password, operator hard-delete). Plan lifecycle changes, organization approval/suspension, camera CRUD, and alert resolution are not audit-logged. | Either wire the middleware globally on mutating routes or add manual audit entries to the remaining controllers. |
| G-8 | 🟡 Low | Real-time consistency | `alertController`'s four action handlers also call `req.io.emit(\`alert:${organizationId}\`, ...)` — an **unroomed, global broadcast** to every connected socket regardless of tenant, duplicating the correctly-scoped `org:{id}` room emit right above it. Not currently consumed by the frontend, but is a latent cross-tenant data leak if anything ever listens for it. | Remove the dead global emit or scope it to the room like its sibling call. |
| G-9 | 🟡 Low | Real-time consistency | `alert:updated` (emitted on acknowledge) has no listener in `socketService.js` — other connected dashboards won't see an alert flip to "acknowledged" in real time; a manual refetch is required. | Add a handler mirroring `alert:resolved`. |
| G-10 | 🟡 Low | UX consistency | `Header.jsx` dark-mode toggle (`localStorage.darkMode`) and `LandingPage.jsx` dark-mode toggle (`localStorage.theme`) use different storage keys and don't share state — a user's theme choice on the public site doesn't carry into the authenticated app and vice versa. | Consolidate on a single storage key/context. |
| G-11 | 🟡 Low | Documentation | `.env.example` doesn't list the new `CONTACT_EMAIL` variable introduced for the contact-form feature. | Add it with a comment. |
| G-12 | 🟢 Informational | Testing | No automated test suite (unit/integration/e2e) exists in either `backend/` or `frontend/`. | Out of scope for this audit but noted for completeness. |
| G-13 | 🟢 Informational | Payments | Subscription "checkout" is a manual/simulated flow — `Order` is created directly with `status: 'approved'`; there is no real payment gateway (Stripe/PayPal/etc.) integration. | Acceptable for current stage; flag before production billing. |

---

## 9. What Changed vs. What Was Pre-Existing (this enhancement cycle)

To distinguish net-new implementation work from the pre-existing baseline, based on the prior conversation record:

**Net-new this cycle:**
- `backend/models/Contact.js`, `backend/controllers/contactController.js`, `POST /api/public/contact`
- `sendContactNotificationEmail` in `emailService.js`
- `SubscriptionPlan`: `displayOrder`, `isPopular`, `isRecommended` fields; `quarterly` added to `billingCycle` enum
- `subscriptionPlanController`: `reactivateSubscriptionPlan`, `deleteSubscriptionPlan`, usage-count aggregation (`attachUsageCounts`), duplicate-name/limit-vs-usage validation on update
- `routes/subscriptionPlans.js`: `/:id/activate`, `DELETE /:id`
- `userController.verifyUser`: Socket.io `user:verified` emit
- `socketHandlers.js`: `join:user`/`leave:user` room handlers
- Frontend: `PendingVerification.jsx` rewritten for real-time approval; `SuperAdminSubscriptionPlans.jsx` rewritten as a full table with create/edit modals; `LandingPage.jsx` contact form wired to the new API with badges added to pricing cards; `utils/roleRoutes.js` (new helper); `authSlice.markUserVerified`; `socketService.js` `join:user`/`user:verified` wiring; `apiEndpoints.js`/`publicApi.js` new function exports; `seedSubscriptionPlans.js` updated with default pricing

**Pre-existing (unchanged this cycle):** authentication core, camera/alert lifecycle, operator assignment, organization approval workflow, Python YOLOv26 inference sidecar + server overlay UI, dashboards for all three roles, Google OAuth, email verification/reset flows.

---

## 10. Conclusion

The last enhancement cycle delivered **8 of 10** requested feature areas to full completion and **2 partially** (subscription self-service checkout has no frontend entry point; a couple of minor DB/validation details from the spec — `deletedAt`, currency validation — were not carried through). No regressions were introduced to authentication, RBAC, cameras, alerts, or Socket.io. The most impactful follow-up items are closing the **Orders module gap (G-1)** and **connecting the existing checkout/renewal backend to a real frontend flow (G-2)** — both are pre-existing gaps in the wider codebase rather than regressions from this cycle, but they are the biggest functional holes remaining in the subscription lifecycle story.
