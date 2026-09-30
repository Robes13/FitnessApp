# Nutrify transactional email

## Configuration and delivery

The API is C# / ASP.NET Core 10, using NuGet, EF Core 10 and PostgreSQL. Authentication uses JWT access/refresh tokens and the existing USER and EMAIL_VERIFICATION_TOKEN tables. Existing login, refresh, and JWT validation require persisted email verification.

`appsettings.json` contains the non-secret Smtp settings. The supplied key is stored only as `Smtp:Password` in `appsettings.Local.json`, loaded through the existing ASP.NET Core JSON configuration system. This local server configuration is Git-ignored and excluded from output, publish, and Docker context. No environment-variable dependency or .env file was added. Provision that file separately in the deployed API content root (for containers, mount it at `/app/appsettings.Local.json`), with access restricted to the server account. Do not serve configuration files through a static file server.

Sender: Nutrify <nutrify@eldorado-fts.dk>. Transport: smtp.resend.com:587, STARTTLS required, username resend. Both HTML and plain text are included. The reusable `IEmailService.SendEmailAsync(to, subject, html, text, cancellationToken)` owns transport; account messaging owns templates. Development now sends through Resend instead of writing raw tokens to the development outbox.

Resend reported eldorado-fts.dk as verified during setup on 2026-09-30. The service checks Resend authorization before each send and refuses delivery if verification cannot be confirmed. The key must have permission to list domains as well as send email. No fallback sender is used. See https://resend.com/features/smtp-service and https://resend.com/docs/api-reference/domains/list-domains.

Provider exception details are discarded. Verification delivery failures produce a sanitized operational warning while retaining the saved, unverified account and normal registration response. Users can request another email after the cooldown. No background retry queue was added.

## Database and routes

Migration `20260930082029_BindEmailVerificationTokensToEmail` adds required varchar(320) Email to EMAIL_VERIFICATION_TOKEN. It invalidates legacy tokens because they were not bound to an address. USER.EmailVerifiedAt already existed; no new user columns are needed. The migration was generated and reviewed, but not applied to the configured database.

Apply from the API directory before starting the updated application:

```powershell
dotnet ef database update --project API.csproj
```

Existing routes are retained:

- POST /api/v1/auth/register: saves an inactive, unverified account and hashed token, commits, then sends the verification link. Response includes emailVerified=false and emailVerifiedAt=null, never the token.
- POST /api/v1/auth/email/resend-verification with {"email":"your-address@example.com"}: generic 204 for missing, deleted, verified, or cooldown-limited accounts. Eligible requests replace previous tokens and send a new email. Cooldown is 60 seconds per account, serialized in the database across API instances.
- POST /api/v1/auth/email/verify with {"token":"..."}: existing JSON verification endpoint; 204 on success.
- GET /api/v1/auth/email/verify?token=...: clickable verification endpoint; redirects to https://eldorado-fts.dk/api/v1/auth/email/verified after successful verification.
- GET /api/v1/auth/email/verified: simple Nutrify confirmation page with a link back to the application.

The existing account update endpoint resets verification on email changes, invalidates prior tokens, revokes refresh tokens, and emails the new address. Existing JWT validation also rejects unverified accounts.

Tokens contain 32 cryptographically random bytes (256 bits), encoded as 64 hexadecimal characters; only SHA-256 hashes are stored. They expire after 24 hours and are bound to the user and normalized email. Verification and token consumption occur in one transaction. Invalid, malformed, expired, reused, deleted-account, and changed-address tokens are rejected without database details. The success page itself cannot change verification state.

## End-to-end test

1. Apply the migration and provision server-local configuration. Route https://eldorado-fts.dk/api/v1/* to this API; all generated links use this domain, even during local development. Configure reverse-proxy/access logging to omit query strings on verification requests.
2. Register through the existing application signup or POST /api/v1/auth/register with the full existing onboarding request and an inbox you control.
3. Confirm the registration response has emailVerified=false and emailVerifiedAt=null. Login remains blocked until verification.
4. Receive the Nutrify email. Confirm the sender, HTML button, full fallback URL and plain-text alternative.
5. Click the link. Confirm the Nutrify success page appears, then log in. The returned user has emailVerified=true and a persisted emailVerifiedAt timestamp.
6. Open the link again: it must return 400. Wait 60 seconds and request a resend for another unverified account; the prior link must fail and the replacement must succeed.
7. Change the account email using the existing account endpoint. Confirm verification resets, old tokens fail, and only the new address receives a valid link.

No live email was sent during implementation. The tests use captured email and SQLite; production PostgreSQL concurrency was not load-tested.

Run the existing test suite from the API directory:

```powershell
dotnet test API.slnx
```

## File inventory

Created: `.gitignore`, local-only `appsettings.Local.json`, this guide, `Services/Email/IEmailService.cs`, `Services/Email/SmtpEmailService.cs`, `Services/Auth/VerificationEmailTemplate.cs`, the migration and its Designer file, and `../API.Tests/EmailVerificationTests.cs`.

Modified: `.dockerignore`, `API.csproj`, `appsettings.json`, `Program.cs`, `Options/SmtpOptions.cs`, `Controllers/AuthController.cs`, `DTOs/Auth/UserDto.cs`, `DTOs/Auth/VerifyEmailRequest.cs`, `Domain/Entities/EmailVerificationToken.cs`, `Data/FitnessAppDbContext.cs`, `Migrations/FitnessAppDbContextModelSnapshot.cs`, `Services/Auth/AccountMessageSender.cs`, `Services/Auth/IAccountMessageSender.cs`, `Services/Auth/AuthService.cs`, `Services/Auth/UserAccountService.cs`, and `../API.Tests/ApiWorkflowTests.cs`.

Dependencies installed: none. Existing .NET SMTP/HTTP APIs and existing xUnit/SQLite test dependencies were reused.
