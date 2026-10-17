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
