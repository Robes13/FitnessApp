# Nutrify transactional email

> Merged 2026-10-02 with `feat/api-integration` (see `mobilapp/docs/api-integration/plan-v2.md` §3 A2,
> A3, A5). The mail texts, links and pages are the integration's; the transport below is unchanged.

## Configuration and delivery

`appsettings.json` contains the non-secret Smtp settings. The Resend key is stored only as `Smtp:Password`
in `appsettings.Local.json`, loaded through the existing ASP.NET Core JSON configuration system. This local
server configuration is Git-ignored and excluded from output, publish, and Docker context. Provision that
file separately in the deployed API content root (for containers, mount it at `/app/appsettings.Local.json`),
with access restricted to the server account. Do not serve configuration files through a static file server.

Sender: Nutrify <nutrify@eldorado-fts.dk>. Transport: smtp.resend.com:587, STARTTLS required, username
resend. `IEmailService.SendEmailAsync(to, subject, html, text, cancellationToken)` (`SmtpEmailService`) owns
the transport; `Utilities/AccountEmails.cs` owns the templates (Danish + English text, the same text as HTML
with a clickable link), and `AccountMessageSender` hands them to the transport.

**Development** does not send mail: `AccountMessageSender` writes each mail as a text file to
`.dev-outbox/` in the content root (with the Docker compose in `mobilapp/docs/api-integration/docker/`:
`docker/outbox/*.txt`), exactly as before.

Links are built only from `App:PublicBaseUrl`, never from the request's Host header. `appsettings.json` leaves
it empty, so the API refuses to start outside Development until production sets `App__PublicBaseUrl` (Robert's
`https://eldorado-fts.dk` once the API is served there); Development uses `http://localhost:5210`.

Resend reported eldorado-fts.dk as verified during setup on 2026-09-30. The service checks Resend
authorization before each send and refuses delivery if verification cannot be confirmed. The key must have
permission to list domains as well as send email. No fallback sender is used. See
https://resend.com/features/smtp-service and https://resend.com/docs/api-reference/domains/list-domains.

Provider exception details are discarded. A delivery failure is logged as a sanitized warning, and the
request still succeeds (the account change is committed, and an error would tell an anonymous caller that
the account exists). Every mail can be asked for again: resend, forgot password, or `PATCH /me` again for an
e-mail change. No background retry queue was added.

## Database and routes

Migration `20260930082029_BindEmailVerificationTokensToEmail` adds required varchar(320) `Email` to
EMAIL_VERIFICATION_TOKEN and invalidates legacy tokens. `Email` binds a token to the account's address when
it was issued: if the address has changed since, the link no longer works. `NewEmail`
(`20260930115857_AddMealTypeAndPendingEmail`) is set only on an e-mail-change token and is where that mail
goes; the address is switched when that link is used.

- `POST /api/v1/auth/register`: saves an inactive, unverified account and a hashed token, commits, then sends
  the verification link. The response has `emailVerifiedAt: null`, never the token.
- `POST /api/v1/auth/email/resend-verification` with `{"emailOrUsername":"…"}`: always 204. Only for an
  unverified, non-deleted account, and at most once per 60 seconds per account (serialized in the database
  across API instances). A new mail invalidates the older links.
- `GET /api/v1/auth/email/verify?token=…`: the link in the mail. Verifies and answers with a small Danish +
  English HTML page (200 confirmed, 400 invalid/expired/used).
- `POST /api/v1/auth/email/verify` with `{"token":"…"}`: 204/400, for scripts and tests.
- `PATCH /api/v1/me` with a new `email`: the account and the session stay active on the old address; the
  link goes to the new address and switches it when used.

Tokens contain 32 cryptographically random bytes, encoded as 64 hexadecimal characters; only SHA-256 hashes
are stored. Verification tokens expire after 24 hours. Verification claims the token atomically in one
transaction. Invalid, malformed, expired, reused, deleted-account and changed-address tokens are rejected;
an already verified account can only be verified again by an e-mail-change token.

## Tests

`dotnet` runs in Docker (see `mobilapp/docs/api-integration/README.md`). The tests capture mail and use
SQLite; production PostgreSQL concurrency was not load-tested, and no live mail was sent.
