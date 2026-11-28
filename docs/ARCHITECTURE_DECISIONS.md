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
- ONVIF type is schema-ready but disabled in UI v1 (“Coming soon”). Superseded by ADR-008.

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

## ADR-007: Design system and unified app shell (2026-10-18)

**Context:** The UI used Tailwind red as the brand color — the same red as fire alerts and destructive actions — and about 2,000 raw color classes, 11 hand-built tables, 6 separately built dialogs, and two different shells (account portal and operations) for the same user. Contrast failed on the alert actions (as low as 1.92:1).

**Decision:**

- Semantic design tokens (`canvas`, `surface`, `line`, `fg`, `critical`, `warning`, `success`, `info`, `sidebar`) as CSS variables in `frontend/src/index.css`, mapped in `tailwind.config.js`; light and dark themes share one vocabulary. The brand is cobalt (`brand-600 #2B59D9`); red is reserved for fire alerts and destructive actions. `primary-*` is kept as an alias of `brand`.
- Shared primitives in `frontend/src/components/ui/` (Button, IconButton, Badge/StatusBadge, Card, PageHeader, Field/Input/Select/Switch, Dialog/Drawer with focus trap, ConfirmProvider/useConfirm, Menu, Tabs, DataTable/Pagination, StatGroup, Logo, Avatar). One status vocabulary in `ui/status.js`.
- One `AppShell` (`components/shell/`) for every signed-in role. Navigation comes from `navConfig.js`; the existing routes and layout files are unchanged (each layout renders `AppShell`). The top bar shows the live active-alert count.
- Alerts use one workspace (`components/alerts/`) for all three roles, with a single next action per alert and the resolution outcome captured.
- Inter is self-hosted via `@fontsource-variable/inter`; only the subsets a page needs are downloaded.

**Consequences:**

- New screens should compose primitives and tokens rather than raw palette classes.
- Theme preference adds a `system` option (no stored key); `setTheme` broadcasts in-tab changes.
- `window.confirm` is no longer used; destructive actions go through `useConfirm`.

## ADR-008: ONVIF cameras resolve their stream from the device (2026-10-18)

**Context:** ONVIF was schema-only. Users had to find each camera's RTSP path by hand, and RTSP credentials were stored in plain text inside `streamUrl`.

**Decision:**
- The backend talks ONVIF itself (`backend/services/onvif/`): SOAP 1.2 with WS-Security UsernameToken digest (corrected for device clock skew), HTTP Digest/Basic fallback, Media1 with Media2 fallback, WS-Discovery on every IPv4 interface.
- Add flow: **Connect** (`POST /api/cameras/onvif/probe`) lists device identity and video profiles; create/update resolve the chosen profile's RTSP URI from the device. Client-supplied `streamUrl` is ignored for ONVIF cameras. Service and stream addresses the device advertises are rebased onto the host the user entered (NAT / port forwarding).
- Credentials: password AES-256-GCM encrypted in `Camera.onvif.passwordEnc` (`select: false`, stripped by `toJSON`), key `CAMERA_CREDENTIALS_KEY` (falls back to an HKDF of `JWT_SECRET`). `streamUrl` holds no credentials; `authenticatedStreamUrl()` adds them only for the ffmpeg proxy and the API-key-authenticated inference camera list. Logs are redacted.
- Device and stream addresses follow the same policy as stream URLs (`checkStreamSource`: no loopback/link-local unless `CAMERA_ALLOW_LOCAL_SOURCES=true`). A saved password is reused by probe only for the same host, port and username.
- Discovery (`POST /api/cameras/onvif/discover`) is on by default outside production and opt-in (`ONVIF_DISCOVERY_ENABLED=true`) in production, where the server usually is not on the cameras' LAN.

**Consequences:**
- Saving an ONVIF camera requires the device to be reachable; unrelated edits (name, notes) do not contact the device. `POST /api/cameras/:id/onvif/refresh` re-reads the stream address.
- Rotating the credentials key requires re-entering ONVIF passwords.
- No PTZ, events or snapshot URI yet.

## ADR-009: Explainable alerts — decision trace, LayerCAM, SHAP (2026-10-19)

**Context:** Alerts showed confidences and a snapshot but not why they fired. The model only proposes boxes; a deterministic rule (`IncidentTracker`: fire/smoke ≥ confidence threshold in N consecutive frames, cooldown) raises the alert and the backend picks severity from the alert frame's peak confidence.

**Decision:**
- **Decision trace (exact):** the worker sends the rule values and confirming frames (`metrics.evidence`); `backend/services/alertExplanation.js` stores `alert.explanation.decision` and plain-language `reasons`. Each box keeps all class scores so a high `other` score can be flagged as a possible look-alike.
- **Visual explanation: LayerCAM (Grad-CAM family)** on `best.pt` — same weights as `best.onnx`, checked at explainer start-up. Target: class score summed over anchors with IoU > 0.5 to the alert box; activations: first block of the Detect classification branch per scale. Vanilla Grad-CAM was rejected after measuring 12–17% of attention inside the box (89–100% with LayerCAM).
- **Separate explainer process/container** (`python -m app.xai.main`, `requirements-xai.txt`, `Dockerfile.explainer`). It pulls jobs over the API-key internal API; alerts are emitted before their heatmap exists (`alert:explained` follows). The live detector's dependencies are unchanged.
- **False-alarm likelihood:** one global `GradientBoostingClassifier` on numeric features only (no images, no organization identifiers), explained with SHAP `TreeExplainer` in probability units. Labels come from operator outcomes and the new `falseAlarmCause`. Training refuses to write a model below 150 labelled alerts, 30 per class or CV ROC-AUC 0.6.
- **LIME rejected:** ~300 perturbed CPU passes per alert (~2.4 min), stochastic output, out-of-distribution masking of diffuse smoke.

**Consequences:**
- The false-alarm likelihood is advisory: it never suppresses an alert or changes severity.
- `averageConfidence` keeps its meaning (peak of the alert frame); the true mean over the confirming frames is `explanation.decision.streakMeanConfidence`.
- Heatmaps are served from `/uploads/explanations/` like snapshots (static, unauthenticated, random filename). Authenticating `/uploads` is still open.
- With `XAI_ENABLED=true` and no explainer running, alerts stay `pending`; the UI hides the heatmap state after 3 minutes.
- The explainer retrains daily (`XAI_RETRAIN_HOURS`) and keeps the previous model when a new one fails the quality gate. Org admins see label progress as a percentage; platform-wide counts are for super admins only.
