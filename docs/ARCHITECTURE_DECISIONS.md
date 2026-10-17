# Architecture Decisions

## ADR-001: Customer role for pre-purchase users (2026-07-25)

**Context:** Landing page registrants must be normal users until they purchase a plan, not Organization Admins.

**Decision:** Add a dedicated `customer` role (`super_admin | org_admin | operator | customer`) instead of reusing `operator` without an organization.

**Consequences:**
- Clear RBAC separation between pre-purchase customers and operators
- Checkout promotes `customer` → `org_admin` and creates organization
- Routing sends customers to landing (`/`), not operator dashboard

## ADR-002: Remove Super Admin approval from self-service path (2026-07-25)

**Context:** Pending verification blocks org_admin/operator access until Super Admin approves.

**Decision:** Self-service registrants get `isVerified: true` as customers; org promotion on purchase sets `isVerified: true`. Super Admin verify endpoints remain for manual edge cases only.

**Consequences:** `/pending-verification` removed from active flow; purchase is the only promotion gate to org_admin.

## ADR-003: Customer portal as persistent account home (2026-07-26)

**Context:** After purchase, users become org_admin but should retain a customer-style account area (profile, subscription, plans) without being stuck on the marketing landing page or forced into the org dashboard.

**Decision:**
- Introduce `/customer/*` as the account home for `customer` (pre-purchase) and `org_admin` (post-purchase).
- One organization per user email; no multi-org creation from the same account.
- After checkout, redirect to the portal subscription view; org operational dashboard (`/orgadmin/*`) is optional via explicit navigation.
- Org admin layouts include an Account link back to `/customer/dashboard`.

**Consequences:**
- `getDashboardPathForRole('customer')` and org_admin login default → `/customer/dashboard`.
- Checkout must reject duplicate active org/subscription for the same user.
- Profile and portal routes allow `org_admin`, not only `customer`.
- ADR-001 consequence “routing sends customers to landing” is superseded for account navigation by this ADR.
- Theme preference is stored as `localStorage.theme` (`"dark"` | `"light"`) app-wide; legacy `darkMode` is migrated on read. Settings, landing, and admin headers share the same key.

## ADR-004: Shared camera component layer + live usage count (2026-07-27)

**Context:** Org-admin and operator camera views duplicated tile logic; subscription `camerasUsed` could drift from actual camera records.

**Decision:**
- Extract shared React components under `frontend/src/components/cameras/` (`CameraGrid`, `CameraTile`, `CameraUsageBanner`, modals/drawer).
- Org-admin page composes management UI; operator pages reuse grid + fullscreen only (read-only).
- `GET /api/cameras/usage` and portal account summary use live `Camera.countDocuments({ organizationId, isDeleted: false })`.
- Operator assignment supports two entry points: operator-centric (`POST /operator-assignments`) and camera-centric (`PUT /cameras/:id/operators`).

**Consequences:**
- Plan limit enforcement is accurate in UI and API.
- Soft-delete cascades remove `OperatorCameraAssignment` rows for the camera.
- ONVIF type is schema-ready but disabled in UI v1 (“Coming soon”).

## ADR-005: Python ONNX inference sidecar (CPU-first) (2026-10-16)

**Context:** In-browser inference could not match YOLOv26 weights, could not monitor RTSP 24/7, and did not expose bounding-box analytics.

**Decision:**
- Run **YOLOv26 Ultralytics-exported ONNX** (`best.onnx`) in a **Python inference service** on the host CPU (optional GPU cloud later).
- Node remains the **control plane**: internal API key routes under `/api/internal/inference`, MongoDB persistence, Socket.io fan-out (`detection:live`, `incident:updated`, `incident:ended`), existing alert/email/notification pipeline via `alertCreationService`.
- React visualizes server detections (overlay + metrics); default `VITE_AI_MODE=server`.

**Consequences:**
- Legacy browser-side ML and `ml/` training folder removed; Colab/Roboflow YOLOv26 export + `python-services/inference` runtime only.
- Weights live under `python-services/inference/weights/` (gitignored).
- RTSP browser playback may still require a future media relay phase; inference works independently of UI video.

## ADR-006: Renewal reuses checkout (2026-10-17)

**Context:** An expired organization admin must renew the same organization. A second organization, a new billing service, and a mid-term plan swap are out of scope. While the term is active, product APIs stay gated. After expiry, the admin still needs a way to delete cameras so a smaller plan can be purchased.

**Decision:**

- `POST /api/subscriptions/checkout` is the only self-service purchase and renewal write. It stays behind `protect` only. It does not use `requireActiveSubscription` or `requireActiveOrganization`, so an expired org admin can still call it.
- `backend/utils/subscriptionTerm.js` is the term definition. `isSubscriptionTermActive` is true only when the organization is `ACTIVE`, `subscriptionStatus` is `active`, the subscription document is `active`, and `subscription.endDate` is still in the future. A past org or subscription end date means the term is not active.
- While that helper returns true, checkout returns 400 for every plan id: `You already have an active subscription. You can change plans after it expires.`
- A suspended organization receives 403 and cannot self-serve checkout.
- A successful renewal updates the existing `Organization` and `Subscription`, appends a new approved `Order`, and starts a new term at checkout time (`startDate` now, `endDate` now plus the plan duration). Camera records are left in place. `camerasUsed` and `operatorsUsed` on the subscription document are preserved.
- Before those writes, checkout counts live cameras (`isDeleted: false`) and active operators (`role: operator`). If either count exceeds the selected plan, checkout returns 400 and writes nothing.
- Expired org admins may list cameras, read usage, and soft-delete a camera through `requireActiveSubscriptionUnlessDeprovision`. Create, update, stream, and restore stay blocked. Alerts and incidents keep `requireActiveSubscription`. The inference camera list includes only subscriptions with `status: active` and `endDate` still in the future. Operator removal stays on `DELETE /api/users/:id`, which has no subscription middleware.
- The portal classifies the account as first purchase, renewal, active term, or suspended from `GET /api/users/me/account-summary`. Renewal entry points go to `/customer/plans`, then `/customer/subscribe/:planId`. Over-capacity plans open a prompt and link to `/customer/downgrade-prep`. Help copy comes from `frontend/src/data/faq.js` via `/customer/help`.

**Consequences:**

- One email keeps one organization across expiry and renewal.
- Plan changes wait until the current term has ended. There is no proration.
- Payment remains simulated.
- Operators have no renewal UI. Their product access returns when the org admin’s term is active again.
- Super Admin `assignPlanToOrganization` is unchanged and can still write the same organization outside this checkout path.
- Portal capacity hints use account-summary usage. Camera usage there is a live count. Operator usage there is the stored `operatorsUsed` counter. Checkout’s live operator count remains the enforcement source.
