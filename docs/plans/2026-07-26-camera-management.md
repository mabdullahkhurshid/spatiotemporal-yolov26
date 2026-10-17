# Camera Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Organization Admins a complete, plan-limit-aware camera registry with grid tiles, fullscreen live view, per-camera settings, and operator visibility — matching common VMS / SaaS surveillance product patterns.

**Architecture:** Reuse existing backend CRUD (`POST/PUT/DELETE /api/cameras`) and operator-assignment model; add small backend extensions for usage summary and camera-centric operator assignment; rebuild org-admin Cameras page around shared React components used by both org-admin and operator views.

**Tech Stack:** MERN (existing), Redux Toolkit (`cameraSlice`), React Router, Tailwind, `useLiveDetection` + Socket.io `detection:live`, Socket.io status updates.

## Global Constraints

- **Only org_admin** may add/edit/delete cameras in the UI; backend POST/PUT/DELETE remains org_admin-only (super_admin API access unchanged for emergency ops — no super_admin camera UI).
- Enforce **plan `maxCameras`** limit on create (already in `createCamera`; surface in UI).
- Do **not** rename/remove existing API routes or Redux slice actions.
- Preserve: JWT auth, RBAC, multi-tenant isolation, AI detection, alerts, Socket.io, operator assignment model.
- Minimum diff — extract shared components; do not rewrite unrelated modules.
- No new npm dependencies unless strictly required (e.g. no video player library for MVP — native `<video>` + modal).
- No database migrations with `--apply` unless explicitly authorized; new Camera fields use optional defaults.

---

## 1. Requirements vs Current State

| Requirement | Status | Gap |
|-------------|--------|-----|
| Org admin adds cameras within plan limit | Backend ✅ | No UI; `camerasUsed` in subscription not synced with real count |
| Add Camera button → form | ❌ | `createCamera` thunk exists but unused |
| Camera type–specific inputs | ❌ | No `cameraType` on model |
| Grid of small camera blocks with name/number | Partial | Full-size tiles only; no compact grid + identity label |
| Click tile → fullscreen live view | ❌ | Inline grid only |
| Assign operators to camera(s) | Partial | Operator-centric assignment on Operators page only |
| Assigned cameras visible on operator dashboard | Partial | Stats + link exist; no thumbnail grid on dashboard |
| Hold all camera settings | Partial | Model has basic fields; no settings panel UI |

---

## 2. Industry Reference (What Good Products Do)

Products like **Verkada**, **Milestone XProtect**, **Genetec Security Center**, and **Ring Business** share these patterns:

1. **Device registry** — Each camera is a record: display name, location, type, stream endpoint, online/offline status.
2. **License enforcement** — UI shows `N / max` devices; Add button disabled at limit with upgrade CTA.
3. **Grid-first monitoring** — Compact tiles (thumbnail + label + status dot); click opens immersive viewer.
4. **RBAC** — Admins manage devices; operators see only assigned subset.
5. **Dual assignment UX** — Manage access from **operator profile** (“which cameras?”) and **camera detail** (“which operators?”).
6. **Settings drawer** — Edit name, location, stream URL, type, detection toggle without leaving the grid.

This plan implements (1)–(6) at MVP depth using existing stack.

---

## 3. Recommended Approach

### Option A — Minimal patch on `Cameras.jsx` only
Add modal form + grid to existing page. Fastest, but duplicates tile logic between org-admin and operator pages.

### Option B — Shared component layer + targeted backend extensions *(Recommended)*
Extract `CameraGrid`, `CameraTile`, `CameraFullscreenModal`, `CameraFormModal`, `CameraSettingsDrawer`, `CameraUsageBanner`. Add `GET /api/cameras/usage` and `PUT /api/cameras/:id/operators`. Keeps pages thin; matches how VMS UIs separate “device list” from “live viewer.”

### Option C — Full VMS with `/cameras/:id` detail routes
Separate settings page per camera. Best long-term, but over-scoped for current iteration.

**Recommendation: Option B** — industrial UX without a large route refactor.

---

## 4. Data Model Extensions

### 4.1 Camera schema (`backend/models/Camera.js`)

Add optional fields (backward compatible):

```javascript
cameraType: {
  type: String,
  enum: ['ip_rtsp', 'http_mjpeg', 'onvif'],
  default: 'ip_rtsp',
},
displayNumber: {
  type: String,
  trim: true,
  // e.g. "CAM-01" — auto-suggested on create, user-editable
},
settings: {
  detectionEnabled: { type: Boolean, default: true },
  notes: { type: String, trim: true },
},
```

Keep existing `metadata` (`model`, `resolution`, `fps`) for hardware info.

### 4.2 Camera type → form fields (conditional UI)

| Type | Required | Optional |
|------|----------|----------|
| `ip_rtsp` | name/label, ipAddress, location | streamUrl (rtsp://…), displayNumber, model, resolution |
| `http_mjpeg` | name/label, streamUrl, location | displayNumber, ipAddress |
| `onvif` | name/label, ipAddress, location | *(disabled in UI v1 — “Coming soon” badge)* |

Validation stays in existing `validateCamera`; extend with optional `cameraType` enum check.

### 4.3 Usage count (single source of truth)

**Do not** rely on stale `subscription.camerasUsed`. Instead:

- `GET /api/cameras/usage` returns `{ used, maxCameras, canAddMore }` where `used = Camera.countDocuments({ organizationId, isDeleted: false })`.
- Update `getAccountSummary` to compute `camerasUsed` from live count (same query) so portal UsageBar stays accurate.

---

## 5. Backend Tasks

### Task B1: Camera usage endpoint

**Files:**
- Create: none
- Modify: `backend/controllers/cameraController.js`, `backend/routes/cameras.js`

**Interfaces:**
- Produces: `GET /api/cameras/usage` → `{ success, data: { used, maxCameras, canAddMore } }`
- Access: `org_admin` only (operators get 403)

**Logic:**
```javascript
exports.getCameraUsage = async (req, res, next) => {
  const orgId = req.user.organizationId;
  const organization = await Organization.findById(orgId).populate('subscriptionPlanId');
  const used = await Camera.countDocuments({ organizationId: orgId, isDeleted: false });
  const maxCameras = organization.subscriptionPlanId?.maxCameras ?? organization.maxCameras ?? 0;
  res.json({ success: true, data: { used, maxCameras, canAddMore: used < maxCameras } });
};
```

Route (before `/:id`):
```javascript
router.get('/usage', authorize('org_admin'), getCameraUsage);
```

---

### Task B2: Auto-suggest display number on create

**Files:**
- Modify: `backend/controllers/cameraController.js` — inside `createCamera`

**Logic:** If `displayNumber` not provided, set `CAM-${String(cameraCount + 1).padStart(2, '0')}` (e.g. CAM-01, CAM-02).

Accept `cameraType` and `settings` from body; persist on create/update.

---

### Task B3: Camera-centric operator assignment

**Files:**
- Modify: `backend/controllers/cameraController.js` (or `operatorAssignmentController.js`)
- Modify: `backend/routes/cameras.js`

**Interfaces:**
- Produces: `PUT /api/cameras/:id/operators` body `{ operatorIds: string[], replace: true }`
- Access: `org_admin` only
- Validates: camera belongs to org; each operator is `role: operator` in same org
- Behavior: delete existing assignments for this `cameraId`, insert new rows `(operatorId, cameraId, organizationId)`

This complements existing `POST /api/operator-assignments` (operator-centric). Do **not** remove the old endpoint.

---

### Task B4: Fix account-summary live camera count

**Files:**
- Modify: `backend/controllers/userController.js` — `getAccountSummary`

Replace `subscription?.camerasUsed ?? 0` with live `Camera.countDocuments` for the org.

---

### Task B5: Extend validation

**Files:**
- Modify: `backend/middleware/validation.js`

Add optional `body('cameraType').isIn(['ip_rtsp', 'http_mjpeg', 'onvif'])`.

For `http_mjpeg`, require `streamUrl`; for `ip_rtsp`, keep current ip + location rules.

---

## 6. Frontend Architecture

```
frontend/src/components/cameras/
├── CameraUsageBanner.jsx      # "3 / 10 cameras" + Add disabled at limit
├── CameraGrid.jsx             # responsive grid wrapper
├── CameraTile.jsx             # compact tile: preview, label, status, displayNumber
├── CameraFormModal.jsx        # add/edit; fields change by cameraType
├── CameraFullscreenModal.jsx  # fullscreen live view + AI overlay + Esc to close
├── CameraSettingsDrawer.jsx   # edit settings, assign operators, delete
└── CameraOperatorPicker.jsx   # multi-select operators for one camera

frontend/src/pages/orgadmin/Cameras.jsx    # compose management page
frontend/src/pages/operator/Cameras.jsx    # reuse CameraGrid + Fullscreen (read-only)
frontend/src/pages/operator/Dashboard.jsx    # add assigned-camera thumbnail strip
```

### 6.1 Org Admin Cameras page layout

```
┌─────────────────────────────────────────────────────────────┐
│ Cameras                          [Add Camera] (if canAdd)   │
│ Usage: ████░░░░░░ 3/10                                      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│ │ CAM-01│ │ CAM-02│ │ CAM-03│ │  +   │  ← compact tiles    │
│ │ Lobby │ │ Yard  │ │ Gate  │ │ empty│                       │
│ │ ● ON  │ │ ● OFF │ │ ● ON  │ │ slot │                       │
│ └──────┘ └──────┘ └──────┘ └──────┘                        │
└─────────────────────────────────────────────────────────────┘
```

- **Add Camera** → `CameraFormModal` (type selector at top drives fields).
- **Click tile** → `CameraFullscreenModal` (live stream + detection overlay).
- **Gear icon on tile** (org admin only) → `CameraSettingsDrawer` (edit, assign operators, delete).

### 6.2 Operator experience

- **Dashboard:** Row of up to 4 assigned camera mini-tiles + “View all” → `/operator/cameras`.
- **Live Cameras page:** Same `CameraGrid` + `CameraFullscreenModal`; no add/edit/delete/settings.
- Data: continue using `fetchCameras()` (backend already filters to assigned cameras for operators).

### 6.3 Operator assignment — two entry points

| Entry | Location | API |
|-------|----------|-----|
| Operator → cameras | `Operators.jsx` (existing) | `POST /operator-assignments` |
| Camera → operators | `CameraSettingsDrawer` (new) | `PUT /cameras/:id/operators` |

Both update the same `OperatorCameraAssignment` collection.

---

## 7. Frontend Tasks

### Task F1: API helpers

**Files:**
- Modify: `frontend/src/services/apiEndpoints.js`

```javascript
export const getCameraUsage = () => api.get('/cameras/usage');
export const assignOperatorsToCamera = (cameraId, operatorIds, replace = true) =>
  api.put(`/cameras/${cameraId}/operators`, { operatorIds, replace });
```

Extend `cameraSlice` with `fetchCameraUsage` thunk (optional — page can fetch directly).

---

### Task F2: `CameraUsageBanner`

**Files:**
- Create: `frontend/src/components/cameras/CameraUsageBanner.jsx`

Props: `{ used, maxCameras, onAddClick, canAdd }`. Reuse styling from `UsageBar.jsx`. Disable Add button + tooltip when `!canAdd`: “Camera limit reached. Upgrade your plan.”

---

### Task F3: `CameraTile` (compact)

**Files:**
- Create: `frontend/src/components/cameras/CameraTile.jsx`

Props: `{ camera, compact, onOpen, onSettings, showSettings }`.

Display:
- Primary label: `camera.displayNumber || camera.label || camera.name`
- Secondary: location
- Status pill (ONLINE/OFFLINE from Socket.io + initial API state)
- Thumbnail: static placeholder or `<video muted>` snapshot if `streamUrl` (lazy — no TF model on tile to save GPU)

Extract shared detection logic from existing `CameraTile` in orgadmin/operator pages into fullscreen only.

---

### Task F4: `CameraFormModal`

**Files:**
- Create: `frontend/src/components/cameras/CameraFormModal.jsx`

Props: `{ open, mode: 'add'|'edit', initialValues, onSubmit, onClose }`.

Fields by type (see §4.2). On submit call `createCamera` or `updateCamera` from `cameraSlice`. Show server error for limit exceeded (`400 Camera limit reached`).

---

### Task F5: `CameraFullscreenModal`

**Files:**
- Create: `frontend/src/components/cameras/CameraFullscreenModal.jsx`

- Fixed overlay, `Escape` to close, click-outside optional.
- Full-width `<video>` + `useLiveDetection` / `DetectionOverlayCanvas`.
- Header: displayNumber, name, location, status.
- Org admin: shortcut button to open settings drawer.

---

### Task F6: `CameraSettingsDrawer`

**Files:**
- Create: `frontend/src/components/cameras/CameraSettingsDrawer.jsx`
- Create: `frontend/src/components/cameras/CameraOperatorPicker.jsx`

Sections:
1. **Identity** — name, displayNumber, location, cameraType (read-only after create if type affects validation)
2. **Connection** — ipAddress, streamUrl
3. **Hardware** — metadata model, resolution, fps
4. **Detection** — settings.detectionEnabled toggle (passed to fullscreen hook)
5. **Operator access** — multi-select org operators; save via `assignOperatorsToCamera`
6. **Danger zone** — soft delete with confirm

Load operators via existing `getUsers()` filtered to `role === 'operator'`.

---

### Task F7: Rebuild `orgadmin/Cameras.jsx`

**Files:**
- Modify: `frontend/src/pages/orgadmin/Cameras.jsx`

Replace inline `CameraTile` with shared components. On mount:
```javascript
dispatch(fetchCameras());
getCameraUsage().then(setUsage);
```

Wire Add → FormModal, tile click → Fullscreen, gear → SettingsDrawer.

Empty state: illustration + “Add your first camera” CTA (not “admin panel” message).

---

### Task F8: Update operator views

**Files:**
- Modify: `frontend/src/pages/operator/Cameras.jsx` — shared grid + fullscreen
- Modify: `frontend/src/pages/operator/Dashboard.jsx` — assigned camera mini-grid (first 4 from `cameras` state)

---

### Task F9: Polish `Operators.jsx` assignment empty state

**Files:**
- Modify: `frontend/src/pages/orgadmin/Operators.jsx`

When `allCameras.length === 0` in assign modal, show: “No cameras yet. Add cameras on the Cameras page first.” with link to `/orgadmin/cameras`.

---

## 8. UX & Error Handling

| Scenario | Behavior |
|----------|----------|
| At camera limit | Add button disabled; banner shows max; API 400 surfaced as toast |
| Invalid stream URL | Tile shows “No stream”; fullscreen shows retry message |
| Operator with no assignments | Dashboard empty state + link message |
| Subscription inactive | Existing middleware 403 — show banner from org subscription page |
| Delete camera with assignments | Backend soft-delete; assignments removed; restore/permanent via API |
| Socket offline | Tile status updates via existing `camera:status:update` |

### Delete cascade (Task B2 add-on)

In `deleteCamera`, after `softDelete()`:
```javascript
await OperatorCameraAssignment.deleteMany({ cameraId: camera._id });
```

---

## 9. Implementation Phases (Iteration 10)

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **10.1** | Backend B1–B5 | Usage endpoint, displayNumber, camera operators PUT, live count, validation |
| **10.2** | Frontend F1–F3 | API helpers, usage banner, compact tile, grid |
| **10.3** | Frontend F4–F7 | Form modal, fullscreen, settings drawer, org-admin page |
| **10.4** | Frontend F8–F9 | Operator dashboard grid, operator cameras page, Operators polish |
| **10.5** | QA | Build, regression checklist, update CURRENT_ITERATION.md |

---

## 10. Testing Checklist

### Org admin
- [ ] Add camera (ip_rtsp) — appears in grid with CAM-XX label
- [ ] Add camera (http_mjpeg) — streamUrl required, ip optional
- [ ] Hit plan limit — Add disabled + API rejects 11th camera on 10 limit plan
- [ ] Edit camera settings — persists after refresh
- [ ] Assign 2 operators to camera — both see it on dashboard/cameras
- [ ] Remove operator from camera — operator no longer sees it
- [ ] Delete camera — removed from grid; assignments cleaned up
- [ ] Fullscreen opens/closes with Esc; AI detection runs

### Operator
- [ ] Sees only assigned cameras on dashboard strip and /operator/cameras
- [ ] Cannot access add/edit/delete APIs (403)
- [ ] Fullscreen works on assigned camera

### Regression
- [ ] Alerts still fire from detection hook
- [ ] Socket.io status updates still work
- [ ] Customer portal UsageBar shows correct camera count
- [ ] Super admin org stats camera count unchanged

---

## 11. Out of Scope (Future)

- ONVIF auto-discovery and credential vault
- NVR multi-channel import
- Per-camera detection threshold overrides (use env vars for now)
- Recording / playback / timeline
- Map view / floor plans
- Mobile PTZ controls
- Super admin camera management UI

---

## 12. Files Summary

| Action | Path |
|--------|------|
| Modify | `backend/models/Camera.js` |
| Modify | `backend/controllers/cameraController.js` |
| Modify | `backend/routes/cameras.js` |
| Modify | `backend/middleware/validation.js` |
| Modify | `backend/controllers/userController.js` |
| Create | `frontend/src/components/cameras/*.jsx` (7 files) |
| Modify | `frontend/src/pages/orgadmin/Cameras.jsx` |
| Modify | `frontend/src/pages/operator/Cameras.jsx` |
| Modify | `frontend/src/pages/operator/Dashboard.jsx` |
| Modify | `frontend/src/pages/orgadmin/Operators.jsx` |
| Modify | `frontend/src/services/apiEndpoints.js` |
| Modify | `frontend/src/store/slices/cameraSlice.js` (optional usage thunk) |
| Modify | `docs/CURRENT_ITERATION.md`, `docs/REGRESSION_CHECKLIST.md` |

---

## 13. Self-Review (Spec Coverage)

| User requirement | Covered by |
|------------------|------------|
| Org admin only adds cameras | F7 UI; backend already org_admin POST |
| Plan limit enforcement | B1, B4, F2, F4 |
| Add Camera button + form | F4, F7 |
| Type-specific inputs | B5, F4, schema §4.2 |
| Small blocks with name/number | F3, F7 |
| Click → fullscreen | F5, F7, F8 |
| Assign operators to cameras | B3, F6, existing Operators page |
| Operators see assigned cameras | F8, existing GET filter |
| Hold camera settings | F6, schema settings + metadata |

No placeholders remain. Scope fits one iteration (10) in five phases.
