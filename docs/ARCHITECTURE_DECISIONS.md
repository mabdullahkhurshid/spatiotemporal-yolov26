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
