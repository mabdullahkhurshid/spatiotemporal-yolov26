# Current Iteration

**Iteration:** 13 — Subscription renewal & re-subscribe  
**Started:** 2026-10-16  
**Status:** Complete — Phase 13.6 signed off 2026-10-17

## Current Step

Iteration 13 is complete. Wait for the next instruction before starting new work.

### Documentation alignment (2026-10-17)

- Removed legacy **CNN / TensorFlow.js** copy from README, landing page, ADRs, and audit docs; product AI is **YOLOv26 ONNX** only.
- Removed unused root dependency `@tensorflow/tfjs` (`npm install` refreshed lockfile).
- Verification: `npm run build` (frontend) exit 0; `subscriptionTerm` + `checkoutMode` node smoke checks; Python `compileall` for inference app.

### Audit fixes (2026-10-18)

Full-codebase audit with fixes and automated regression tests (`npm test`, `npm run test:inference`).

- Inference: `classes.json` order was `fire, smoke, other`, but the model metadata order is `fire, other, smoke`, so smoke and other were swapped. The detector now reads class names from the ONNX metadata. Detection payloads failed JSON serialization (numpy `float32`) on every frame with a box. Documented `INFERENCE_*` env vars were ignored. Retries now apply only to HTTP errors.
- Backend: `/api/internal/inference/*` is exempt from the public rate limiter (ingest returned 429 after about 50 s). Request input with `$`-operator keys is rejected, which closes NoSQL injection in the password reset and email verification flows. Refresh is refused for suspended or deleted users.
- Socket.io: JWT required on connect. Org rooms are limited to the user's own org. Operators receive events only for assigned cameras. The global `alert:<orgId>` broadcast is now scoped. Camera status spoofing is blocked.
- Alerts: tenant and assignment check on `POST /api/alerts`. Fixed the operator `?cameraId` filter bypass (alerts and incidents). Lifecycle transitions are atomic, and closed alerts cannot be reopened. Emails no longer delay the socket push.
- Other: org admin can edit their own profile. A rejected replace-assignment keeps existing assignments. Camera heartbeat has a tenant check. Permanent camera delete removes incidents. The refresh token is persisted before the response.
- Frontend: socket joins the org room (populated `organizationId`), uses a single connection, and handles `alert:updated`. Failed login shows the error instead of reloading the page. Refresh uses `VITE_API_URL`, stores the rotated token, and runs once for parallel 401s. Legacy `/subscribe/:planId` redirect fixed.
- Verification: 46/46 backend/client tests, 13/13 Python tests, `npm run build` exit 0, 75 s live worker E2E (0 errors, 0 throttled).

### Hardening follow-up (2026-10-18)

- Sessions: refresh tokens are now per-device, hashed sessions (`User.refreshSessions`, `backend/utils/sessions.js`) in an httpOnly cookie scoped to `/api/auth`. Rotation is atomic, with a 30 s grace window for parallel refreshes. Legacy single tokens are migrated on first use. Logout ends this device only, `POST /api/auth/logout-all` ends every device, and a password reset or suspension ends all sessions. The SPA keeps the access token in memory (`services/tokenStore.js`, `JWT_EXPIRE=15m`) and restores the session on reload through the cookie.
- Google sign-in redirects with a one-time, 2-minute code (`POST /api/auth/oauth/exchange`) instead of tokens in the URL. Live view uses a 60 s camera-scoped `streamToken` (`GET /api/cameras/:id/stream-token`); `?accessToken=` was removed.
- Secrets (`refreshToken`, sessions, OTP, reset token) are `select: false` and stored hashed. Previously, user API responses returned them; for example, an org admin editing an operator received that operator's refresh token.
- Rate limits: 1000 requests per 15 min per signed-in user (per IP when anonymous). Failed credential attempts: 10 per 15 min per IP. Email-sending endpoints: 10 per hour. Contact form: 5 per hour. `TRUST_PROXY` added for nginx deployments.
- Email: forgot-password and resend responses no longer reveal whether an account exists. Five wrong codes invalidate the OTP; `POST /api/auth/resend-verification` added, along with Login and Register UI. verify-email now normalizes the email like register does (dotted/mixed-case Gmail addresses could not verify before).
- Cameras: stream URLs must be rtsp/rtsps/http/https and must not point at loopback or link-local hosts. Local files and localhost require the `CAMERA_ALLOW_LOCAL_SOURCES=true` opt-in. The policy is enforced at create/update, in the inference registry and in the proxy (ffmpeg `-protocol_whitelist`). Parallel camera or operator creates can no longer exceed plan limits.
- Real time: super admins get platform-wide alert, incident and status events, but not raw detection frames.
- Inference: letterbox preprocessing is pixel-identical to Ultralytics `LetterBox`, and NMS is class-aware. On synthetic frames the pipeline matched Ultralytics `predict()` on 15/15 detections. An incident opens only after `INFERENCE_INCIDENT_MIN_CONSECUTIVE` frames (default 3).
- Frontend: routes are lazy-loaded with vendor chunks; initial JS dropped from 982 KB to about 306 KB. ESLint 9 flat config added, and `npm run lint` passes with 0 warnings. Removed the unused Register organization field.
- Verification: 74/74 backend/client tests, 18/18 Python tests, lint clean, `npm run build` exit 0, 45 s live worker E2E with 0 errors.

### UI/UX redesign (2026-10-18)

- Design system (ADR-007): semantic tokens for light and dark, cobalt brand with red reserved for alerts, Inter, and shared UI primitives. A single `AppShell` for all roles; routes unchanged.
- Redesigned: alerts (shared workspace, detail drawer with snapshot and history, resolution outcome), the three role dashboards, cameras (honest tile states, deleted-cameras view with restore), reports, operators, organizations, users, plans, orders, account home, plans and checkout, subscription, profile, settings, help and contact, the landing page, and the sign-in pages.
- Fixes found during the redesign: org dashboard alert total was capped at 10; org admin profile returned 403 (populated organization compared as an object); orders now record the purchased plan name; lifecycle actions no longer drop populated camera data; the resolve action now sends the outcome; the unread notification count now decreases; a broken /orders link; camera tiles tried to play RTSP in the browser.
- Verification: 76/76 backend and client tests, 18/18 Python tests, lint clean, build clean, and a full headless-Chrome sweep across roles, sizes and themes with automated accessibility and overflow checks.

### Google sign-in, real email, ONVIF cameras (2026-10-18)

- Email: verified end to end through the configured Gmail SMTP. Register code, password reset link and contact notification each arrived in about 2 s; the code and link read back over IMAP completed verify, login and reset. Templates now HTML-escape names, camera labels and contact messages.
- Google sign-in: OAuth `state` bound to an httpOnly SameSite=Lax cookie (login CSRF). Google emails are normalized like registration (a dotted or mixed-case Gmail address created a duplicate account before). Unverified Google emails are refused. Cancel, bad state and token errors return to `/login?error=…` instead of a raw 401/500. The code exchange applies the same active-organization check as password login. Missing Google config disables the button path instead of crashing startup. Live sign-in checked by hand against Google.
- ONVIF (ADR-008): `backend/services/onvif/` with WS-Security digest plus device clock-skew correction, HTTP Digest/Basic fallback, Media1/Media2 and WS-Discovery. `POST /api/cameras/onvif/discover`, `POST /api/cameras/onvif/probe` and `POST /api/cameras/:id/onvif/refresh` added. Passwords are AES-256-GCM encrypted (`CAMERA_CREDENTIALS_KEY`) and added to the stream URL only for the ffmpeg proxy and the inference worker; logs are redacted. UI: ONVIF option in Add camera (scan network, connect, pick profile); ONVIF connection section and Refresh from camera in camera settings.
- Verification: 98/98 backend tests (new `oauth.test.js` against a mock Google, `onvif.test.js` against a simulated ONVIF device including real multicast discovery), Python tests OK, lint clean, build clean. ONVIF E2E with real video: MediaMTX RTSP behind login, then probe, create, 162 MJPEG frames in 5 s through the proxy, the Python worker ingesting the stream (`streamStatus=ok`), and refresh after a stream path change.

## Phase 13 Overview

| Phase | Name | Status |
|-------|------|--------|
| **13.0** | Shared subscription term + usage helpers | **Complete** |
| **13.1** | Backend renewal rules + capacity guards + expiry sync | **Complete** |
| **13.2** | Expired de-provisioning lane | **Complete** |
| **13.3** | Portal dual-mode checkout | **Complete** |
| **13.4** | Renewal entry points + downgrade prompt | **Complete** |
| **13.5** | Docs / ADR / regression closure | **Complete** |
| **13.6** | End-to-end QA matrix | **Complete** |

---

## Phase 13.0 — Helpers

- [x] `backend/utils/subscriptionTerm.js` — `isSubscriptionTermActive`, `isOrganizationRenewable`, `getOrganizationUsageCounts`, `syncExpiredSubscriptionState`

## Phase 13.1 — Backend

- [x] Checkout blocks **any** plan while term active (not same-plan-only)
- [x] Suspended org → 403 at checkout
- [x] Live camera + operator count vs plan limits → 400 before writes
- [x] `requireActiveSubscription` syncs `Subscription.status` to `expired` when past end date
- [x] `POST /api/subscriptions/checkout` remains without subscription middleware (renewal path open)

### Validation (2026-10-16)

- [x] `subscriptionTerm` pure logic unit checks (node)
- [x] `subscriptionController` + `auth` middleware load without error
- [ ] V1–V10 against MongoDB (manual / scripted HTTP — pending DB QA)

## Phase 13.2 — De-provisioning lane

- [x] `requireActiveSubscriptionUnlessDeprovision` — org_admin GET `/cameras`, GET `/usage`, DELETE `/:id` when expired
- [x] `cameraController` blocks create/update in `deprovisionMode`
- [x] `frontend/src/pages/customer/DowngradePrepPage.jsx` at `/customer/downgrade-prep?planId=`
- [x] Operator removal via existing `DELETE /api/users/:id` (no subscription middleware on users routes)

### Validation (2026-10-16)

- [x] Backend camera routes + auth middleware load
- [x] `npm run build` (frontend)
- [ ] V11–V14 against MongoDB (manual — pending DB QA)

## Phase 13.3 — Portal dual-mode checkout

- [x] `PORTAL_ROLES` on `/customer/subscribe` and `/customer/subscribe/:planId` (`App.jsx`)
- [x] `frontend/src/utils/checkoutMode.js` — `first_purchase`, `renewal`, `blocked_active`, `blocked_suspended`
- [x] `SubscribePage.jsx` — account summary on mount, mode-specific form, error mapping, token refresh
- [x] `SubscriptionPage.jsx` — `renewed=1` success copy

### Validation (2026-10-16)

- [x] `npm run build` (frontend)
- [ ] V15–V17 against MongoDB (manual — pending DB QA)

## Phase 13.4 — Entry points + capacity UX

- [x] `frontend/src/hooks/useRenewalEligibility.js` — mode, `canRenew`, `canCheckoutPlan(plan)`
- [x] `PlansPage` — Renew / Subscribe / View Subscription; over-capacity opens `PlanCapacityModal`
- [x] Plan cards show “Not enough slots” in renewal mode when camera usage exceeds the plan
- [x] Expired banner, portal subscription CTA, org-admin subscription link, profile **Renew plan**
- [x] Pending plan deep links wait for account summary; active term does not open checkout
- [x] FAQ expiry and one-organization answers
- [x] Inactive plan deep link remains on `SubscribePage` (Phase 13.3)
- [x] Operators have no renewal menu item

### Validation (2026-10-16)

- [x] `checkoutMode` capacity helper checks (node)
- [x] `npm run build` (frontend)
- [ ] V18–V21 in the browser against a logged-in expired organization (manual — pending DB QA)

## Phase 13.5 — Docs, ADR, regression pointers

- [x] ADR-006 — renewal reuses `POST /api/subscriptions/checkout`; `isSubscriptionTermActive`; expired camera list/delete exception; no mid-term plan change
- [x] `docs/REGRESSION_CHECKLIST.md` — Subscription Renewal section lists V1–V21
- [x] Help page reads `frontend/src/data/faq.js`. Contact Support is `/customer/help/contact`. No separate static FAQ copy.

### Validation (2026-10-17)

- [x] ADR symbols match `subscriptionTerm.js`, `routes/subscriptions.js`, and `requireActiveSubscriptionUnlessDeprovision`
- [x] FAQ expiry and one-organization answers match the renewal rules
- [x] V1–V21 executed in Phase 13.6

## Phase 13.6 — End-to-end QA

Disposable `qa136.*` accounts and `qa136-*` plans were created through the API, exercised, then deleted. One pre-existing organization remains.

- [x] P1 / V1 / V15 — expired admin renewed the same plan; organization id, camera note, and operator assignment stayed; a new order was added
- [x] P2 — upgrade changed `maxCameras` / `maxOperators` and kept the camera
- [x] P3 — downgrade within capacity succeeded
- [x] P4 / V7 / V11 / V12 — over camera limit returned 400 with no new order; list and delete worked; create returned 403; checkout succeeded after one delete
- [x] P5 / V3 / V4 — active term checkout returned 400 for the same plan and a different plan
- [x] P6 / V9 — first purchase created one organization and role `org_admin`
- [x] P7 / V14 — operator cameras and alerts returned 403 while expired; both returned to access after the admin renewed. MJPEG returned 403 while expired. Inference camera discovery omitted the expired org and included it after renewal
- [x] P8 / V6 — super admin deactivated a plan; checkout onto it returned 404 and the subscription stayed expired
- [x] V5 — suspended organization checkout returned 403
- [x] V8 — live operator count over the plan returned 400 with no new order
- [x] V10 — a past end date with status still `active` synced both documents to `expired`. Camera list stayed available. Camera create, alerts, and incidents returned 403
- [x] V13 — camera delete while the term was active returned 200
- [x] V16–V21 browser — expired banner, Plans **Renew**, capacity modal, downgrade prep, profile **Renew plan**, org-admin **Renew or change plan**, active subscribe URL redirected to My Subscription, customer checkout still shows organization name and **Complete Purchase**
- [x] `npm run build` (frontend) exit 0 on 2026-10-17
- [x] No new environment variables and no new npm dependencies

### Validation note

Portal capacity copy uses account-summary `operatorsUsed`, which checkout stores as `1` on first purchase. The API guard counts live operators. Both behaviors matched ADR-006.

---

## Previous — Iteration 12 (AI Inference)

Complete — see git history and Phase 12 sections in `REGRESSION_CHECKLIST.md`.
