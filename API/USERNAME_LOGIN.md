# Username authentication

## API contract

POST `/api/v1/auth/login` now accepts `{"username":"JohnDoe","password":"..."}`.
Email is not accepted as an alternative login identifier. This intentionally breaks email-based login clients; deploy API/client contract updates together. The included Angular UI already uses username labels, placeholders, autocomplete and a username argument throughout its session layer. Its AuthApi remains an existing stub: there is no live login HTTP request or JWT storage implementation in that client. Connecting that frontend to the backend is separate work; exercise the complete live flow through the API until that integration exists.

New and changed usernames must contain 3?50 ASCII letters, digits, underscore or hyphen, with no whitespace/control characters. The existing 50-character limit is retained for compatibility. Display casing is preserved in `Username`; `NormalizedUsername` folds ASCII A?Z to a?z consistently in the application and PostgreSQL. `JohnDoe` and `johndoe` identify the same account. Signup and the existing authorized account-update endpoint validate availability; the database unique index rejects concurrent duplicates. Those conflicts return a safe 409. Login failures return `Invalid username or password.`

Registration continues to require username, email, password and existing onboarding data. Account responses already include username. Password hashing, rehash behavior, access/refresh JWTs, revocation, and the server's verified-email checks are unchanged. No login rate limiter or lockout was present in this API; no controls were removed. The verification resend cooldown remains intact. Password recovery still uses email, and Resend/email-verification transport and templates are untouched.

## Database and existing users

The model already has required `USER.Username` and a unique index. Migration `20260930084037_AddNormalizedUsername` adds a database-generated stored `NormalizedUsername` column and unique index. The database computes it for existing rows and every insert/update, including writes outside the API; callers cannot choose an inconsistent normalized value. The existing username index remains.

The migration first rejects missing/empty names and collisions after ASCII folding. It neither deletes accounts nor invents or overwrites usernames. If a preflight check fails, resolve the affected identities through an account-owner-approved process before retrying; the migration transaction rolls back. Legacy names retain their display spelling and can still log in even if they do not satisfy the new registration restrictions. Non-ASCII characters in legacy names remain exact characters; ASCII letters are case-insensitive. Users can keep legacy names or choose a valid new name through the existing authorized account endpoint.

A read-only audit against the configured PostgreSQL database was attempted, but the server returned SQLSTATE 28P01 (password authentication failed). Live account counts/collisions could not be inspected. No migration has been applied to that database. Correct the existing server-side connection configuration, rerun an account audit, and apply:

```powershell
dotnet ef database update --project API.csproj
```

This also applies any earlier pending email-verification migration. Do not bypass the collision preflight or automatically rename accounts.

## Verification

Validation results: all 40 backend tests and all 720 frontend tests (91 files) passed. The Angular test bundle compiled successfully; EF reports no pending model changes.

```powershell
dotnet test API.slnx
npm --prefix ../mobilapp test -- --watch=false
```

Backend tests cover username registration, case normalization, service and database duplicate rejection, successful login without email, incorrect password, unknown username, rejection of email as a fallback, account username changes, preserved legacy names, email verification and email-based password reset. PostgreSQL migration execution remains unverified because the configured credentials were rejected; relational behavior is tested with SQLite's equivalent ASCII-folding generated column.

End-to-end API check:

1. Apply migrations and retain the Resend configuration described in EMAIL_SETUP.md.
2. POST a complete existing registration request with username `JohnDoe`, your inbox email, password and onboarding data. Confirm `emailVerified=false` and the username in the response.
3. Open the verification email in that inbox and click its eldorado-fts.dk link.
4. POST `/api/v1/auth/login` with only `{"username":"johndoe","password":"your-password"}`. Expect access/refresh tokens and `emailVerified=true`.
5. Verify an email-as-username request is rejected and a second signup using `JOHNDOE` returns 409.
6. POST `/api/v1/auth/password/forgot` with the account email, complete the existing token-based reset, and log in using the same username and new password.

## Files changed for this task

Backend: `DTOs/Auth/LoginRequest.cs`, `DTOs/Auth/RegisterRequest.cs`, `DTOs/Auth/UpdateAccountRequest.cs`, `Domain/Entities/User.cs`, `Data/FitnessAppDbContext.cs`, `Services/Auth/AuthService.cs`, `Services/Auth/UserAccountService.cs`, `Exceptions/GlobalExceptionHandler.cs`, `API.http`, and `Migrations/FitnessAppDbContextModelSnapshot.cs`.

Created: `Utilities/UsernameRules.cs`, `20260930084037_AddNormalizedUsername.cs` and its Designer under `Migrations/`, `../API.Tests/UsernameAuthenticationTests.cs`, and this guide.

Tests: updated `../API.Tests/ApiWorkflowTests.cs` for the username login contract and SQLite generated-column mapping.

Frontend: `../mobilapp/src/app/features/auth/pages/login-page/login-page.ts` now blocks invalid/empty forms and limits username length; `../mobilapp/src/app/features/signup/services/signup-state.ts` and its spec enforce the backend username rules. Login HTML and session/AuthApi arguments already used username and needed no identifier changes. Forgot-password email fields are unchanged.

No new package dependencies were introduced. Frontend dependencies were restored from its existing package lock for testing.
