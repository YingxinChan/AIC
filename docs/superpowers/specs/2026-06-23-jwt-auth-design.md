# JWT Authentication — Design Spec

**Date:** 2026-06-23
**Status:** Approved

## Overview

Replace the stub auth with real JWT-based register, login, and session management. Users are stored in PostgreSQL (Supabase). Tokens are stored in httponly cookies and expire after 7 days. No refresh token — access token only.

## Architecture

Three files change:

| File | Change |
|---|---|
| `backend/core/security.py` | Add `create_access_token(user_id, email)`. Update `get_current_user()` to decode and validate the JWT instead of accepting any cookie value |
| `backend/services/auth_service.py` | Replace stubs with real async DB operations — insert User on register, fetch + verify on login |
| `backend/routers/auth.py` | Inject async DB session into register, login, me routes |
| `backend/schemas/auth.py` | No change |
| `backend/models/user.py` | No change |

## Data Flow

**Register:**
1. Check `users` table — if email already exists, raise 409
2. Hash the password with bcrypt (`hash_password` already in `core/security.py`)
3. Insert new `User` row
4. Create JWT with `{"sub": str(user_id), "email": email, "exp": now + 7 days}`
5. Set httponly cookie `access_token = <jwt>`
6. Return `{"user": {"id": user_id, "email": email}}`

**Login:**
1. Fetch `User` from DB by email — if not found, raise 401
2. Verify password against stored hash — if wrong, raise 401 (same message as not found)
3. Create JWT (same structure as register)
4. Set httponly cookie
5. Return `{"user": {"id": user_id, "email": email}}`

**Me:**
1. Read `access_token` cookie — if missing, raise 401
2. Decode and validate JWT — if expired or tampered, raise 401
3. Fetch `User` from DB by `id` from token — if not found, raise 401
4. Return `{"user": {"id": user_id, "email": email}}`

**Logout:**
1. Delete `access_token` cookie
2. Return 204 (no DB call, no token blacklist)

## Token

- Algorithm: HS256
- Secret: `settings.secret_key`
- Payload: `{"sub": str(user_id), "email": email, "exp": utcnow + timedelta(days=7)}`
- Library: `python-jose[cryptography]` (already in requirements.txt)
- Storage: httponly cookie named `access_token`

## Error Handling

| Scenario | Status | Detail |
|---|---|---|
| Register with existing email | 409 | "Email already registered" |
| Login — email not found | 401 | "Invalid credentials" |
| Login — wrong password | 401 | "Invalid credentials" |
| `/me` — no cookie | 401 | "Not authenticated" |
| `/me` — expired/invalid token | 401 | "Not authenticated" |
| `/me` — user deleted from DB | 401 | "Not authenticated" |

Login uses the same message for wrong email and wrong password — never reveal which is incorrect.

## Testing

Existing tests in `tests/test_auth.py` are updated. Tests hit a real DB (Supabase) — each test that creates a user generates a unique email (`test+<uuid>@example.com`) to avoid collisions between runs.

**Tests to keep/update:**
- register returns 200, sets cookie, returns user email ✓
- login returns 200, sets cookie ✓
- logout returns 204 ✓
- `/me` without cookie returns 401 ✓
- `/me` with valid cookie returns real user (not stub) ✓

**New tests:**
- register with duplicate email returns 409
- login with wrong password returns 401
- `/me` with invalid/tampered token returns 401

## Dev Seed User

A seed script `backend/scripts/seed_dev_user.py` creates a fixed development user if it doesn't already exist. Teammates run it once after setup. It is idempotent — safe to run multiple times.

**Credentials (shared with the team):**
- Email: `dev@smarttrip.ai`
- Password: `devpass123`

The script hashes the password with bcrypt and inserts the user via SQLAlchemy. If the email already exists, it skips silently.

Run with:
```bash
python scripts/seed_dev_user.py
```

## Out of Scope

- Refresh tokens (future work)
- Token blacklisting on logout (not needed for MVP)
- Email verification (future work)
- Password reset (future work)
