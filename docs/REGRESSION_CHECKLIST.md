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

## Build
- [x] `npm run build` (frontend) succeeds — verified 2026-07-26 (Phase 9.5)
- [x] Backend starts without module load errors — verified 2026-07-26 (Phase 9.5)
