# Project Audit Summary

**Project:** AI-Based Fire & Smoke Detection / Surveillance SaaS Platform
**Stack:** MERN (MongoDB, Express, React, Node.js) + Socket.io + TensorFlow.js
**Audit type:** Read-only static analysis of the current repository state
**Scope:** `backend/`, `frontend/`, `ml/`, root config files

> This document is a factual snapshot of what exists in the codebase today. No code was changed to produce it.

---

## 1. Repository Structure

```
Starter/
├── backend/                   # Express + MongoDB API server
│   ├── config/database.js     # Mongoose connection
│   ├── controllers/           # 11 controllers (business logic)
│   ├── middleware/            # auth, validation, error handling
│   ├── models/                # 11 Mongoose schemas
│   ├── routes/                # 10 route modules mounted in server.js
│   ├── scripts/               # createSuperAdmin, seedSubscriptionPlans, clearOperatorsAndOrgAdmins
│   ├── services/               # emailService (Nodemailer), oauthService (Passport Google)
│   ├── sockets/socketHandlers.js
│   ├── utils/                  # generateToken, generateOTP
│   └── server.js               # App bootstrap, Socket.io, middleware wiring
├── frontend/                   # React 18 + Vite SPA
│   └── src/
│       ├── components/         # Sidebar, Header, ErrorBoundary
│       ├── hooks/useFireSmokeDetection.js   # TF.js browser inference
│       ├── layouts/             # SuperAdminLayout, OrgAdminLayout, OperatorLayout
│       ├── pages/                # auth/, public/, superadmin/, orgadmin/, operator/
│       ├── services/             # api.js (axios), apiEndpoints.js, publicApi.js, socketService.js
│       ├── store/                # Redux Toolkit slices: auth, alerts, cameras, notifications
│       ├── utils/roleRoutes.js
│       ├── App.jsx               # Route table + role-based guards
│       └── main.jsx
├── ml/                          # Python training pipeline (offline, not wired into backend)
│   ├── train_fire_smoke_model.py
│   └── convert_to_tfjs.md
├── docs/EMAIL_SETUP.md
├── package.json / frontend/package.json   # npm workspaces (root = backend deps)
├── docker-compose.yml, Dockerfile, nginx.conf
└── README.md, PROJECT_STRUCTURE.md, DEPLOYMENT.md
```

Root `package.json` scripts: `npm run install-all`, `npm run dev` (concurrently runs backend on `:5000` and Vite frontend on `:5173`).

---

## 2. Backend Architecture

### 2.1 Runtime & Middleware (`backend/server.js`)

- Express app wrapped in a Node `http` server so Socket.io can share the same port.
- Global middleware order: `helmet` → `cors` (origin = `FRONTEND_URL`) → rate limiter (`express-rate-limit`, 100 req/15 min by default) → `express.json` (10mb limit) → `express.urlencoded` → `cookie-parser`.
- `req.io` is attached to every request so controllers can emit Socket.io events directly.
- Centralized `errorHandler` middleware is the last middleware (handles CastError, duplicate key 11000, ValidationError, JWT errors).
- `/health` endpoint for uptime checks.
- `process.on('unhandledRejection', ...)` shuts the server down gracefully on unhandled promise rejections.

### 2.2 Mounted Routes

| Base path | Router file | Purpose |
|---|---|---|
| `/api/auth` | `routes/auth.js` | Register, login, logout, email verify, password reset, refresh, Google OAuth |
| `/api/public` | `routes/public.js` | Public subscription plan listing, contact form submission |
| `/api/users` | `routes/users.js` | User CRUD, verify/suspend/reactivate, password reset (admin) |
| `/api/organizations` | `routes/organizations.js` | Organization CRUD, approve/reject/suspend |
| `/api/subscription-plans` | `routes/subscriptionPlans.js` | Plan CRUD, activate/deactivate/delete, assign to org |
| `/api/subscriptions` | `routes/subscriptions.js` | Checkout flow, "my subscription" |
| `/api/cameras` | `routes/cameras.js` | Camera CRUD, activity/heartbeat |
| `/api/operator-assignments` | `routes/operatorAssignments.js` | Assign/remove cameras↔operators |
| `/api/alerts` | `routes/alerts.js` | Alert CRUD, resolve/false-alarm/acknowledge, stats |
| `/api/notifications` | `routes/notifications.js` | In-app notification list, mark read |

⚠️ **No `/api/orders` route is registered**, even though an `Order` model exists (see §7, Missing Modules).

### 2.3 Middleware Pipeline (`backend/middleware/auth.js`)

Chained per-route in this typical order: `protect` → `requireActiveOrganization` → `requireVerifiedUser` → `requireActiveSubscription` → `authorize(...roles)`.

- **`protect`** — verifies JWT (cookie or `Authorization: Bearer`), loads user, rejects deleted/inactive users.
- **`requireActiveOrganization`** — non-super-admins must belong to an org with `status === 'ACTIVE'`.
- **`requireActiveSubscription`** — auto-expires subscriptions past `subscriptionEndDate`; blocks suspended orgs or non-`active` subscription status. Applied to cameras, alerts, operator-assignments.
- **`requireVerifiedUser`** — org_admin/operator must have `isVerified === true` for full access (pending-approval gate).
- **`authorize(...roles)`** — simple role allowlist.
- **`checkOrganizationAccess`** — ensures a user only touches their own organization's resource.
- **`auditLog`** — wraps `res.json` to write an `AuditLog` entry after most authenticated responses (defined but not applied globally — must be attached per-route; not currently wired into any route file).

### 2.4 Controllers (business logic summary)

- **authController** — register (creates org as `PENDING` + user as `org_admin`/`operator`, generates OTP, sends verification email), verify-email, login (checks active/org-active/email-verified), Google OAuth callback, logout, `getMe`, forgot/reset password, refresh token.
- **userController** — CRUD with strict role scoping; `verifyUser` now emits `user:verified` over Socket.io to a personal room; suspend/reactivate; hard-delete for operators (frees email), soft-delete otherwise; admin-triggered password reset.
- **organizationController** — CRUD, approve/reject/suspend lifecycle, per-org stats (camera/operator counts vs. plan limits).
- **subscriptionPlanController** — plan CRUD with price/currency/duration/billingCycle validation, duplicate-name check, limit-vs-usage validation on update, deactivate/reactivate, permanent delete (blocked if any org/subscription/order references the plan), `organizationsUsing` count for Super Admin, assign-to-organization.
- **subscriptionController** — `checkoutSubscription` (creates/updates org + `Subscription` + `Order` record, manual "payment simulation"), `getMySubscription`.
- **cameraController** — CRUD scoped by role/org, operator visibility limited to assigned cameras, camera-limit enforcement against plan, heartbeat/activity update.
- **operatorAssignmentController** — assign/replace/remove operator↔camera links, `my-cameras` endpoint for operators.
- **alertController** — create (from AI detection), resolve, mark false alarm, acknowledge, stats aggregation; emits Socket.io events (`alert:new`, `alert:resolved`, `alert:false_alarm`, `alert:updated`) to `org:{id}` rooms and also a generic namespaced event; sends alert emails to org admins; creates in-app `Notification` docs.
- **contactController** — `submitContact` saves to `Contact` collection and attempts to send a notification email (failure is swallowed so the message is still saved).

### 2.5 Real-Time Layer (`backend/sockets/socketHandlers.js`)

- Rooms: `org:{organizationId}` (camera/alert broadcast) and `user:{userId}` (personal approval notification).
- Client-initiated events: `join:user`, `leave:user`, `join:organization`, `leave:organization`, `camera:status` (manual), `camera:heartbeat` (device-initiated → marks ONLINE).
- Server-initiated background job: `setInterval` polling (`checkOfflineCameras`) marks cameras `OFFLINE` if no heartbeat within `CAMERA_HEARTBEAT_TIMEOUT_MS` (default 5 min), broadcasting `camera:status:update`.

### 2.6 Services

- **emailService.js** — Nodemailer wrapper; `sendVerificationEmail`, `sendPasswordResetEmail`, `sendAlertEmail`, `sendContactNotificationEmail`. Degrades gracefully (logs a warning) if SMTP env vars are missing.
- **oauthService.js** — Passport Google OAuth20 strategy; creates or links a `User` by Google profile email; defaults new Google sign-ups to `operator` role with no organization.

---

## 3. Database Models (Mongoose Schemas)

| Model | Key fields | Notes |
|---|---|---|
| **User** | name, email (unique), password (hashed, bcrypt), role (`super_admin\|org_admin\|operator`), organizationId, googleId, isEmailVerified, **isVerified** (Super Admin approval gate), verifiedBy/verifiedAt, emailVerificationToken/expires, passwordResetToken/expires, refreshToken, lastLogin, isActive, isDeleted | Soft-delete method; password hashing pre-save hook |
| **Organization** | name, email (unique), phone, address, installationAddress, logo, status (`PENDING\|ACTIVE\|REJECTED\|SUSPENDED`), approvedBy/At, rejectionReason, subscriptionPlanId (ref), subscriptionPlan (legacy enum string), subscriptionStatus, subscriptionStart/EndDate, maxCameras, maxOperators, adminId, isActive, isDeleted | Soft-delete method |
| **SubscriptionPlan** | name (unique), slug (unique), maxCameras, maxOperators, alertRetentionDays, storageLimit, price, currency, durationMonths, billingCycle (`monthly\|quarterly\|yearly\|custom`), displayOrder, isPopular, isRecommended, description, supportPriority, isActive | No `deletedAt` field (hard delete only, guarded by usage checks) |
| **Subscription** | planId (ref), organizationId (unique), plan (string), status (`active\|expired\|cancelled\|pending`), startDate, endDate, price, billingCycle (`monthly\|yearly` only — **no `quarterly`/`custom`**), paymentMethod, autoRenew, camerasUsed, operatorsUsed | One subscription doc per organization |
| **Camera** | name, label, ipAddress (regex-validated), streamUrl, location, organizationId, status (`ONLINE/OFFLINE` + lowercase variants + `maintenance`), lastHeartbeat, lastActivity, installationDate, createdBy, isActive, isDeleted, metadata (model/resolution/fps) | Mixed-case status enum is a minor inconsistency |
| **Alert** | cameraId, organizationId, fireConfidence, smokeConfidence, averageConfidence, intensityLevel (`low\|medium\|high\|critical`), status (`active\|acknowledged\|resolved\|false_alarm`), acknowledgedAt, resolvedBy/At, resolutionType, resolutionNote, alertImage, frameSnapshotURL, coordinates, timestamp, isFalseAlarm, actions[] (audit trail: type/byUserId/at/note) | Compound indexes for org+status+timestamp queries |
| **OperatorCameraAssignment** | operatorId, cameraId, organizationId | Unique index on (operatorId, cameraId) |
| **Notification** | userId, organizationId, alertId, type (`alert\|system\|order\|subscription`), title, message, isRead, readAt, priority | In-app notifications only (no push/SMS) |
| **Order** | organizationId, subscriptionPlan (enum `basic\|pro\|enterprise` — string, not a ref), amount, status (`pending\|approved\|rejected\|cancelled`), approvedBy/At, paymentIntentId, notes | **No CRUD routes/controller exist for this model** (see §7) |
| **AuditLog** | userId, organizationId, action (fixed enum list), resource (fixed enum list), resourceId, details (Mixed), ipAddress, userAgent | Populated by `authController` directly in a few places; the generic `auditLog` middleware exists but isn't attached to routes |
| **Contact** | name, email, subject, message, organization, status (`unread\|read\|replied`), timestamps | Backs the public Contact Us form |

**Known schema inconsistencies:**
- `Subscription.billingCycle` enum (`monthly|yearly`) is out of sync with `SubscriptionPlan.billingCycle` (`monthly|quarterly|yearly|custom`) — a plan with `quarterly`/`custom` billing cannot be represented cleanly on the `Subscription` document.
- `Order.subscriptionPlan` and `Organization.subscriptionPlan` use a hardcoded 3-value enum (`basic|pro|enterprise`) rather than referencing `SubscriptionPlan._id`, so custom-named plans break this legacy field.
- `Camera.status` enum mixes uppercase (`ONLINE/OFFLINE`) and lowercase (`online/offline`) variants — controllers/frontend must handle both cases defensively (and do, in most places).

---

## 4. Authentication Flow

1. **Registration** (`POST /api/auth/register`)
   - Checks for existing active user by email; blocks silent reuse of a soft-deleted email.
   - If an `organization` name is supplied: creates an `Organization` (`status: PENDING`), user becomes `org_admin`.
   - If no organization: user becomes `operator` with `organizationId: null` (must be assigned by an admin later).
   - Generates a 6-digit OTP (`emailVerificationToken`, 10-minute expiry), emails it via Nodemailer (best-effort; registration succeeds even if email fails).
   - New org_admin/operator accounts start with `isVerified: false` (separate from email verification — this is the Super Admin approval gate).

2. **Email verification** (`POST /api/auth/verify-email`) — OTP match sets `isEmailVerified: true`.

3. **Login** (`POST /api/auth/login`)
   - Validates credentials, checks `isActive`, checks `isEmailVerified` (bypassed for Google accounts), checks the user's organization is `ACTIVE` (non-super-admin).
   - Issues access + refresh JWT via `generateToken.js` (`sendTokenResponse` sets httpOnly cookies and also returns tokens in the JSON body for the SPA to store in `localStorage`).
   - Does **not** block login for `isVerified === false` — unverified users can log in but are redirected client-side to `/pending-verification` and are blocked server-side from most feature routes by `requireVerifiedUser`.

4. **Super Admin approval** (`PUT /api/users/:id/verify`) — sets `isVerified: true`, `verifiedBy`, `verifiedAt`; emits `user:verified` over Socket.io to room `user:{userId}`.

5. **Pending-approval UX** (`frontend/src/pages/auth/PendingVerification.jsx`)
   - Joins the personal Socket.io room and polls `GET /auth/me` every 5s as a fallback.
   - On approval: toast "Your account has been approved.", auto-redirect to the role-appropriate dashboard after ~2.5s.
   - "Update Profile" action re-checks approval status and redirects immediately if now approved.

6. **Token refresh** (`POST /api/auth/refresh`) — axios response interceptor (`frontend/src/services/api.js`) auto-retries a 401 once using the stored refresh token.

7. **Google OAuth** — `GET /api/auth/google` → Google consent → `GET /api/auth/google/callback` → creates/links user (auto `isEmailVerified: true`, role defaults to `operator`) → redirects to `FRONTEND_URL/auth/callback?token=...&refresh=...` which the SPA (`OAuthCallback.jsx`) consumes.

8. **Logout** — clears `refreshToken` on the user doc and clears auth cookies.

9. **Password reset** — `forgotpassword` emails a token (1-hour expiry); `resetpassword` validates and re-issues tokens.

---

## 5. User Roles & RBAC

| Role | Scope | Key permissions |
|---|---|---|
| **super_admin** | Global | Full CRUD on organizations, users, subscription plans; approve/reject/suspend organizations; approve users; assign plans; sees all cameras/alerts across orgs; bypasses `requireActiveOrganization`/`requireActiveSubscription`/`requireVerifiedUser`. Created only via `backend/scripts/createSuperAdmin.js` (not through public registration). |
| **org_admin** | Own organization | Manage own org profile (limited fields), create/manage operators (up to plan's `maxOperators`), create/manage cameras (up to plan's `maxCameras`), assign cameras to operators, view/resolve/acknowledge alerts for their org, view reports (page is a stub). Must be `isVerified` by Super Admin and belong to an `ACTIVE` org with an `active` subscription to access most features. |
| **operator** | Assigned cameras only | View only cameras explicitly assigned via `OperatorCameraAssignment`; view/acknowledge/resolve alerts only for assigned cameras; update own profile. Same verification/active-org/active-subscription gates as org_admin. |

Enforcement mechanism: layered Express middleware (`protect` → `requireActiveOrganization` → `requireVerifiedUser` → `requireActiveSubscription` → `authorize(role...)`) plus per-controller ownership checks (e.g., `organizationId` equality, `OperatorCameraAssignment` lookups). Frontend mirrors this via `ProtectedRoute` (role allowlist) and `isUnverifiedOrgUser` redirect logic in `App.jsx`.

---

## 6. Frontend Architecture

### 6.1 Routing (`App.jsx`, react-router-dom v6)

- Public: `/` (LandingPage), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/pending-verification`.
- Role-nested layouts with sub-routes:
  - `/superadmin/*` → `SuperAdminLayout` → dashboard, organizations, subscription-plans, users, orders, alerts.
  - `/orgadmin/*` → `OrgAdminLayout` → dashboard, cameras, alerts, operators, reports.
  - `/operator/*` → `OperatorLayout` → dashboard, cameras, alerts.
- `/app` acts as a role-based redirect landing point for already-authenticated users.
- `ProtectedRoute` wrapper checks `isAuthenticated` and `allowedRoles`; unverified org_admin/operator are redirected to `/pending-verification` before reaching their layout.
- Auth is restored from `localStorage` (`accessToken`, `user`) on app mount; Socket.io connects when authenticated and disconnects on logout.

### 6.2 State Management (Redux Toolkit, `store/store.js`)

- `auth` slice — login/register/getMe/logout thunks; `setUser`, `markUserVerified` reducers; persists `user`/tokens to `localStorage`.
- `alerts` slice — fetchAlerts/fetchAlertStats/resolveAlert/markFalseAlarm/acknowledgeAlert thunks; `addAlert`/`updateAlert` reducers driven by Socket.io events.
- `cameras` slice — fetchCameras/createCamera/updateCamera/deleteCamera thunks; `updateCameraStatus` reducer driven by Socket.io.
- `notifications` slice — present but its wiring to the notification API routes was not verified beyond the slice itself.

### 6.3 Services layer

- `services/api.js` — Axios instance with bearer-token injection and a 401 refresh-retry interceptor.
- `services/apiEndpoints.js` — typed helper functions for organizations, subscription plans (incl. reactivate/delete), users, operator assignments.
- `services/publicApi.js` — `getPublicSubscriptionPlans`, `submitContactMessage` (unauthenticated).
- `services/socketService.js` — Socket.io client wrapper; joins `organization` and `user` rooms on connect; dispatches Redux actions for `alert:new/resolved/false_alarm`, `camera:status:update`, `user:verified`.

### 6.4 Notable Pages

- **LandingPage.jsx** — marketing site with dark-mode toggle, dynamic pricing section (fetches `/api/public/subscription-plans`, shows Popular/Recommended badges), and a working Contact Us form (posts to `/api/public/contact` with loading/duplicate-submit guard and toast feedback).
- **PendingVerification.jsx** — real-time approval flow described in §4.
- **SuperAdminSubscriptionPlans.jsx** — full table UI: create/edit modals (price, currency, duration, billing cycle, limits, badges), activate/deactivate/delete/assign actions, org-usage column.
- **OrgAdminOperators.jsx** — add operator, delete operator, assign/replace camera access per operator.
- **OrgAdminCameras.jsx / OperatorCameras.jsx** — live camera tiles wired to `useFireSmokeDetection` (TensorFlow.js in-browser inference posting to `/api/alerts`).
- **Dashboards** (Super Admin / Org Admin / Operator) — stat cards + Recharts visualizations, recent-alerts tables.
- **Stub pages** (explicit "Implementation pending" placeholders):
  - `frontend/src/pages/orgadmin/Reports.jsx`
  - `frontend/src/pages/superadmin/Orders.jsx`

### 6.5 Machine Learning Integration

- `useFireSmokeDetection.js` loads a TensorFlow.js graph model client-side (`/models/fire_smoke_tfjs/model.json`), runs inference on a hidden `<video>` element at a configurable interval, applies a temporal window + consecutive-frame + cooldown gating strategy before POSTing to `/api/alerts`.
- `ml/train_fire_smoke_model.py` and `ml/convert_to_tfjs.md` are offline/manual training & conversion assets — they are not invoked by any backend or CI process; the trained model must be manually placed under `frontend/public/models/`.

---

## 7. Implemented Modules

- User registration/login/logout, JWT + refresh-token auth, Google OAuth, email verification (OTP), password reset.
- Super Admin approval workflow with real-time Socket.io notification + polling fallback.
- Organization lifecycle: create, approve, reject, suspend, soft-delete; per-org camera/operator/plan stats.
- Subscription Plan full lifecycle: create, edit, deactivate (soft, preserves existing subscribers), reactivate, permanent delete (guarded against orgs/subscriptions/orders referencing it), org-usage counts, price/currency/duration/billing-cycle fields, Popular/Recommended badges.
- Subscription checkout (manual/simulated payment) and "my subscription" retrieval endpoint (backend only — see gaps below).
- Camera management: CRUD, plan-based camera-limit enforcement, heartbeat/offline detection (Socket.io + periodic sweep).
- Operator↔camera assignment management (assign/replace/remove), operator-scoped camera/alert visibility.
- Alert lifecycle: AI-triggered creation, acknowledge, resolve (with resolution type/note), mark false alarm, stats aggregation, Socket.io broadcast, email + in-app notifications to org admins/operators.
- In-app notifications (list, mark read, mark all read).
- Contact Us: public form → validation → `Contact` collection persistence → best-effort business-email notification → toast feedback, loading state, duplicate-submit guard on the frontend.
- Public landing page with dynamic, active-only, sorted subscription plan display.
- Role-based dashboards for all three roles with charts (Recharts) and recent-activity tables.
- Client-side TensorFlow.js fire/smoke inference pipeline feeding the alert API.
- Audit logging model and a few explicit `AuditLog.create(...)` calls in `authController` (login/register/logout/password reset) and `userController` (operator hard-delete).
- Seed/admin scripts: `createSuperAdmin.js`, `seedSubscriptionPlans.js` (now includes price/currency/duration/billing defaults), `clearOperatorsAndOrgAdmins.js`.

---

## 8. Missing / Incomplete Modules

| Area | Gap |
|---|---|
| **Orders module** | `Order` Mongoose model exists and is written to during checkout, but **no `routes/orders.js` or `ordersController` exists**. `SuperAdminDashboard.jsx` calls `api.get('/orders')` and `Sidebar.jsx` links to `/superadmin/orders`, both of which hit the stub page (`SuperAdminOrders.jsx`, "Implementation pending") — the dashboard's "Pending Orders" stat will always fail/404 silently. |
| **Org Admin Reports** | `OrgAdminReports.jsx` is a placeholder with no charts, exports, or data. |
| **Self-service subscription checkout UI** | Backend `POST /api/subscriptions/checkout` and `GET /api/subscriptions/me` exist, but no frontend page consumes them. `LandingPage.jsx`'s "Subscribe" button navigates to `/login?planId=...`, yet `Login.jsx`/`Register.jsx` never read or act on the `planId` query param — the checkout flow is not wired end-to-end from the UI. |
| **Org-side subscription/usage view** | No Org Admin page displays current plan, usage vs. limits, renewal date, or a "renew" action (spec item 2F: "if plan inactive, organization cannot renew that exact plan" has no UI surface at all). |
| **Notification UI** | `notificationSlice` exists in Redux, and backend routes exist, but no visible bell/dropdown/notification-center component was found wired into the layouts (`Header.jsx`/`Sidebar.jsx` do not appear to consume the notifications API). |
| **Global audit-log middleware** | `auditLog` middleware is defined in `middleware/auth.js` but is not `router.use()`-d anywhere; only a handful of manual `AuditLog.create()` calls exist (register/login/logout/reset password/operator hard-delete). Most mutating actions (camera CRUD, alert resolution, plan changes, organization approval, etc.) are not audit-logged. |
| **Schema/enum inconsistencies** | `Subscription.billingCycle` doesn't include `quarterly`/`custom` (present on `SubscriptionPlan`); `Order.subscriptionPlan` / `Organization.subscriptionPlan` still use a hardcoded `basic|pro|enterprise` string enum instead of referencing `SubscriptionPlan._id` exclusively — custom plan names/slugs outside that set can't be represented in those fields. |
| **Camera status casing** | `Camera.status` enum accepts both `ONLINE/OFFLINE` and `online/offline` (+ `maintenance`), which is handled ad hoc in various places rather than normalized at the schema/service layer. |
| **File/image upload** | `Alert.alertImage` / `frameSnapshotURL` and `Organization.logo` are plain string fields; there is no multer/S3/cloud-storage integration found — clients must supply an already-hosted URL. |
| **Rate limiting granularity** | A single global rate limiter is applied to all of `/api/*`; there is no stricter limiter specifically on auth endpoints (login/register/forgot-password) or the public contact form beyond the global 100 req/15 min default. |
| **Automated tests** | No test directories, test runner config, or CI pipeline (e.g., Jest/Mocha/Playwright) were found in either `backend/` or `frontend/`. |
| **ML pipeline integration** | `ml/train_fire_smoke_model.py` is a standalone training script; there's no automated conversion/deployment path from a trained model into `frontend/public/models/` — this is a manual step per `ml/convert_to_tfjs.md`. |
| **Payment gateway** | Subscription "checkout" is a manual/simulated flow (`Order` created directly with `status: 'approved'`); no real payment provider (Stripe/PayPal/etc.) integration exists. |

---

## 9. Summary Assessment

The platform has a mature, mostly-complete MERN foundation covering authentication, RBAC, organization/subscription lifecycle management, camera/alert operations, real-time updates via Socket.io, and a working Contact Us feature. The most significant functional gaps are the **incomplete Orders module** (referenced by the UI but never implemented on the backend) and the **disconnected self-service subscription checkout flow** (backend logic exists but has no reachable frontend entry point). Reports (Org Admin) and Notifications (UI surface) are the other clearly unfinished areas. Schema-level enum mismatches between `Subscription`/`SubscriptionPlan`/`Order` are a latent data-integrity risk for custom pricing plans but do not currently block core functionality.
