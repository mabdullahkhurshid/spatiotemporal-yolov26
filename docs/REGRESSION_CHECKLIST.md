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
- [x] Fullscreen modal uses `useFireSmokeDetection` (alerts pipeline preserved) — code verified
- [x] Socket.io `camera:status:update` handler unchanged in `socketService.js` — code verified; ID match fixed in `cameraSlice`
- [x] Online camera counts recognize `ONLINE` and `online` status values
- [x] Fullscreen/settings modals stay in sync with Redux after socket updates
- [x] Camera PUT requests validated by type (`validateCamera` middleware)
- [ ] Manual: add camera (ip_rtsp / http_mjpeg), plan limit, operator assignment, delete cascade
- [ ] Manual: operator sees only assigned cameras; org_admin add/edit/delete APIs return 403 for operator

## Build
- [x] `npm run build` (frontend) succeeds — verified 2026-07-27 (Phase 10.5)
- [x] Backend starts without module load errors — verified 2026-07-27 (Phase 10.5)
