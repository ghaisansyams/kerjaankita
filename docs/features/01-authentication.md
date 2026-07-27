# FSD 01 — Authentication

Flow-based module (not CRUD). Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Establish and manage user identity and sessions on Supabase Auth (email + password, PKCE), and route users to the right place (dashboard / onboarding / portal) based on their memberships.
2. **User Story** — *As a user, I can create an account, sign in, recover a lost password, and sign out, so I can securely access my organizations.*
3. **Actors** — Anonymous (all auth routes), Authenticated user, System (`handle_new_user` trigger), Invited user (arrives with a token).
4. **Preconditions** — Supabase configured. For reset: a valid, unexpired email link. For invited signup: a valid invitation token.
5. **Main Flow**
   - **Sign in:** enter email+password → validate → `signInWithPassword` → on success route to `redirectTo ?? /dashboard`; if user has no org → `/onboarding`; if user is guest-only → `/portal`.
   - **Sign up:** enter name+email+password → validate → `signUp` (metadata: full_name) → `handle_new_user` creates the profile row → if email confirmation required, show "check your email"; else session issued and routed. Invited users additionally get an org membership on accept.
   - **Forgot password:** enter email → always show the same neutral success → email link → `/auth/callback` exchanges the code → `/reset-password`.
   - **Reset password:** enter new+confirm → `updateUser` → signed in → `/dashboard`.
   - **Sign out:** `signOut` → clear session → `/login`.
6. **Alternative Flow** — Already-authenticated user hitting `/login` or `/register` → redirected to `/dashboard`. Email unconfirmed on sign-in → block with "confirm your email" + resend. OAuth/magic-link (roadmap) reuses `/auth/callback`.
7. **Validation Rules** — email: RFC email; password sign-in: non-empty; password sign-up/reset: ≥ 8 chars; reset confirm must equal password; full name: 2–80. All server-authoritative (schemas: `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`).
8. **Business Rules** — First-ever account of a fresh deployment is bootstrapped as owner (dev/seed context); in normal use new users land on Onboarding. Password reset & signup responses are **enumeration-safe** (identical for known/unknown emails). Sessions are httpOnly cookies; `getUser()` (revalidated) is used for authz, never `getSession()` alone.
9. **Permission Rules** — All routes public except the authenticated `updatePassword`/`signOut`. No org permissions involved.
10. **Database Tables Used** — `auth.users` (managed), `profiles` (created by trigger), `invitations` + `organization_members` (invited flow).
11. **Server Actions Used** — `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `updatePassword`; Route Handler `GET /auth/callback`. (Contracts in API §1.)
12. **UI Components Used** — `(auth)` split-screen layout, brand panel, `LoginForm`/`RegisterForm`/`ForgotPasswordForm`/`ResetPasswordForm`, `AuthAlert`, `SubmitButton`, password show/hide toggle.
13. **Notifications Triggered** — None at auth level. (`invitation_accepted` fires from the Members module, not here.)
14. **Activity Logs Generated** — None (profile creation is silent; there is no org context yet).
15. **Realtime Events** — None.
16. **Loading State** — Standard Loading; submit buttons show "Signing in… / Creating account… / Sending link… / Updating…".
17. **Empty State** — N/A (forms are the content).
18. **Error State** — Sign-in failure: single neutral alert ("email or password is incorrect"), constant-time, password field cleared. Sign-up: field errors (weak password) + form error (email exists → link to Login). Reset link expired/invalid → explain + re-request. `RATE_LIMITED` → "Too many attempts, try again shortly".
19. **Success State** — Session established → route; reset request → neutral success panel; sign-out → login screen.
20. **Edge Cases** — Unconfirmed email sign-in; expired/used reset link; invited email ≠ signup email (reject, `FORBIDDEN`); double-submit (idempotent); user already a member on invite accept (`CONFLICT`); Supabase down (`NOT_CONFIGURED`/`INTERNAL`); paste of a stale `redirectTo` to a page they can't see (post-login guard re-routes).
21. **Acceptance Criteria** — (a) valid credentials sign in and land per membership; (b) invalid credentials show a generic error and never reveal which field; (c) reset flow completes end-to-end from email link; (d) enumeration-safe responses verified; (e) authenticated users can't see `/login`; (f) sign-out fully clears the session.
22. **QA Checklist** — Base checklist +: constant-time failure timing; cookie flags (httpOnly/secure/sameSite) set; `getUser()` used for guards; rate limiting on sign-in/reset; keyboard-only completion of every form; password toggle labelled.
23. **Future Improvements** — SSO/SAML, OAuth providers, magic-link, 2FA/TOTP, passkeys, session/device management, email-change flow, org-enforced password policies.

**CRUD breakout:** N/A — flow-based module.
**State transitions:** session `none → active → none`; email `unconfirmed → confirmed` (via callback). No audit/notifications at auth layer.
