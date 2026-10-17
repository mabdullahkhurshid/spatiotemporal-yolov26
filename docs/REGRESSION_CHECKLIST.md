# Regression Checklist

Run after each phase before marking complete.

## Auth & Roles
- [ ] Super Admin login → `/superadmin/dashboard`
- [ ] Existing org_admin login → `/customer/dashboard` (portal home; org dashboard via explicit nav)
- [ ] Existing operator login → `/operator/dashboard`
- [ ] New customer registration → `role: customer`, no organization
- [ ] Email OTP verification still required before login

## Unchanged Modules
- [ ] Landing page marketing sections visually unchanged
- [ ] Contact form submits successfully
- [ ] Public subscription plans load on landing
- [ ] Camera CRUD and alerts (org_admin) unchanged
- [ ] Socket.io alert/camera events unchanged
- [ ] Super Admin subscription plan management unchanged

## Customer Portal (Phase 9)
- [ ] New customer register → `/customer/dashboard` (not `/`)
- [ ] Org admin login → `/customer/dashboard` (portal home)
- [ ] Logout from portal dropdown clears session
- [ ] Purchase completes in portal → subscription visible; not forced to org dashboard
- [ ] Org admin can open org dashboard from portal
- [ ] Org admin can return to portal via Account link
- [ ] Same email cannot create a second organization
- [ ] Landing unchanged for anonymous visitors
- [ ] Operator / super_admin flows unchanged
- [ ] Theme toggle in Settings persists across landing, portal, and admin (`localStorage.theme`)
- [ ] Mobile portal sidebar opens from header menu button and closes on nav/overlay
- [ ] Portal pages show skeletons while loading account/plan data

## Camera Management (Phase 10)
- [x] `GET /api/cameras/usage` route registered (org_admin only) — code verified
- [x] `PUT /api/cameras/:id/operators` route registered — code verified
- [x] Live `camerasUsed` in account summary via `Camera.countDocuments` — code verified
- [x] Org admin Cameras page: usage banner, grid, form, fullscreen, settings drawer — code verified
- [x] Operator Cameras + Dashboard: shared grid/fullscreen (read-only, no settings) — code verified
- [x] Operators assign modal: empty state links to `/orgadmin/cameras` — code verified
- [x] Fullscreen modal uses server inference overlay (`useLiveDetection` + Socket `detection:live`) — code verified
- [x] Socket.io `camera:status:update` handler unchanged in `socketService.js` — code verified; ID match fixed in `cameraSlice`
- [x] Online camera counts recognize `ONLINE` and `online` status values
- [x] Fullscreen/settings modals stay in sync with Redux after socket updates
- [x] Camera PUT requests validated by type (`validateCamera` middleware)
- [ ] Manual: add camera (ip_rtsp / http_mjpeg), plan limit, operator assignment, delete cascade
- [ ] Manual: operator sees only assigned cameras; org_admin add/edit/delete APIs return 403 for operator

## AI Inference (Phase 12)
- [x] Internal routes `/api/internal/inference/*` (API key) — code verified
- [x] `GET /api/incidents`, `/api/incidents/stats` — code verified
- [x] `GET /api/cameras/:id/stream/mjpeg` RTSP proxy (ffmpeg) — code verified
- [x] Python `python-services/inference` ONNX CPU worker — code verified
- [x] `@tensorflow/tfjs` removed (frontend + root); `useFireSmokeDetection` removed; YOLOv26 ONNX worker only
- [ ] Manual: inference worker + RTSP camera → overlay + alert + Reports charts
- [ ] Manual: ffmpeg installed on host for local RTSP preview (or use Docker backend image)

## Subscription Renewal (Phase 13)

Executed 2026-10-17 against `http://localhost:5000` with disposable accounts (removed afterward).

### Checkout and entitlement (V1–V10)

- [x] V1 Expired org admin, same plan → 200, same `organizationId`, camera note and assignment kept, new order — API 2026-10-17
- [x] V2 Expired org admin, different plan → 200, org limits match the plan — API 2026-10-17 (P2)
- [x] V3 Active term, different plan → 400 change-after-expiry message — API 2026-10-17
- [x] V4 Active term, same plan → same 400 message — API 2026-10-17
- [x] V5 Suspended organization → 403 suspended message — API 2026-10-17
- [x] V6 Inactive plan → 404 `Subscription plan not found or inactive` — API 2026-10-17
- [x] V7 Camera count over plan limit → 400, order count unchanged, subscription stayed expired — API 2026-10-17
- [x] V8 Operator count over plan limit → 400, order count unchanged — API 2026-10-17
- [x] V9 New customer checkout → one organization, role `org_admin` — API 2026-10-17
- [x] V10 Past `endDate` syncs org and subscription to `expired`. Camera list stays available. Camera create, alerts, and incidents return 403 — API 2026-10-17

### De-provisioning (V11–V14)

- [x] V11 Expired org admin: `GET /api/cameras`, `GET /api/cameras/usage`, `DELETE /api/cameras/:id` allowed; `POST` camera denied — API 2026-10-17
- [x] V12 After one delete brought usage within the plan, checkout succeeded — API 2026-10-17
- [x] V13 Active subscription camera delete returned 200 — API 2026-10-17
- [x] V14 Expired: operator cameras/alerts 403, MJPEG 403, inference list omitted the org. After renewal, operator cameras 200 and inference included the org — API 2026-10-17
- [x] `/customer/downgrade-prep?planId=` listed the expired org’s cameras — browser 2026-10-17

### Portal (V15–V21)

- [x] V15 Renewal checkout with `{ planId }` only kept the camera note and assignment — API 2026-10-17
- [x] V16 Active org admin opening subscribe was sent to `/customer/subscription`. Plan buttons say **View Subscription** — browser 2026-10-17
- [x] V17 Customer subscribe page shows organization name and **Complete Purchase** — browser 2026-10-17
- [x] V18 Expired banner **Renew plan** opens Plans with **Renew** — browser 2026-10-17
- [x] V19 Over-camera plan opens the capacity dialog; **Manage cameras** opens downgrade prep — browser 2026-10-17
- [x] V20 Profile menu **Renew plan** → `/customer/plans`. Customers see **Purchase Plan** — browser 2026-10-17
- [x] V21 Org-admin subscription page and portal My Subscription show **Renew or change plan** when expired — browser 2026-10-17

### Docs (Phase 13.5)

- [x] ADR-006 in `docs/ARCHITECTURE_DECISIONS.md` — renewal reuses checkout, term helper, deprovision exception, no mid-term swap
- [x] Help renders `frontend/src/data/faq.js`; contact action is `/customer/help/contact` (no second static FAQ)

## Build
- [x] `npm run build` (frontend) succeeds — verified 2026-10-17 (Phase 13.6)
- [x] Backend starts without module load errors — verified 2026-10-16 (Phase 13.1 module load)
