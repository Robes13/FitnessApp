# Username rules and login

> Merged 2026-10-02 with `feat/api-integration` (see `mobilapp/docs/api-integration/plan-v2.md` §3 A1).

## API contract

`POST /api/v1/auth/login` takes `{"emailOrUsername":"JohnDoe","password":"…"}` (1–320 characters). A value
with `@` is an e-mail (lower-cased); anything else is a username, matched case-insensitively.

| Status | When                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| 200    | tokens                                                                                     |
| 401    | unknown identifier, deleted or inactive account, wrong password (same text for all)       |
| 403    | right password, e-mail not verified (no tokens, does not count as a failed attempt)       |
| 429    | 6th attempt within a 15-minute window, also with the right password (per API instance)    |

New and changed usernames (`UsernameRules`, register and `PATCH /me`) must contain 3–50 ASCII letters,
digits, underscore or hyphen – so no whitespace and no `@`. Invalid names give 400 `errors.Username`.
Display casing is preserved in `Username`; `NormalizedUsername` folds ASCII A–Z to a–z consistently in the
application and PostgreSQL, so `JohnDoe` and `johndoe` identify the same account. Signup and the account
update check availability; the unique index rejects concurrent duplicates with a 409 "That username is
already in use." Password recovery (`POST /auth/password/forgot`) also takes an e-mail or a username.

## Database and existing users

Migration `20260930084037_AddNormalizedUsername` adds a database-generated stored `NormalizedUsername`
column and a unique index. The database computes it for existing rows and every insert/update. The
existing username index remains.

The migration first rejects missing/empty names and collisions after ASCII folding. It neither deletes
accounts nor invents or overwrites usernames. If a preflight check fails, resolve the affected identities
through an account-owner-approved process before retrying; the migration transaction rolls back. Legacy
names keep their display spelling and can still log in even if they do not satisfy the new rules.

```bash
dotnet ef database update --project API.csproj   # in Docker, see mobilapp/docs/api-integration/README.md
```

## Tests

`UsernameAuthenticationTests` cover registration, case normalization, service and database duplicate
rejection, login with a username in another case, generic login failures, account username changes,
preserved legacy names and the e-mail-based password reset. Relational behavior is tested with SQLite's
equivalent ASCII-folding generated column.
