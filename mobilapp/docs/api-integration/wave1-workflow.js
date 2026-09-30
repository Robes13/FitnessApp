// Superseded by plan-v2.md: kept as history, do not run. The waves, domains and tasks now live in
// plan-v2.md §4 and tasks/*.md.
export const meta = {
  name: 'wave1-domains',
  description:
    'Five domains in parallel worktrees (profile, photo, reminders, weight, food) + auth UI test, then merge',
  phases: [
    { title: 'Implement', detail: 'one agent per domain, own worktree' },
    { title: 'Review', detail: 'one reviewer per domain' },
    { title: 'Fix', detail: 'apply findings, green, commit on wave1/<domain>' },
    { title: 'UI auth', detail: 'browser test of signup/login/forgot/delete in main tree' },
    { title: 'Merge', detail: 'merge branches into feat/api-integration, full build + tests' },
  ],
};

const SP = '/Users/janick/Documents/GitHub/FitnessApp/mobilapp/docs/api-integration';
const ROOT = '/Users/janick/Documents/GitHub/FitnessApp';
const MAIN_APP = `${ROOT}/mobilapp`;

const COMMON = `Angular 22 / Capacitor 8 app "mobilapp" inside the monorepo ${ROOT}. Read ${SP}/plan.md FIRST (binding decisions, contracts between domains, parallel-work rules). Then read ${SP}/map/api-contract.md and ${SP}/map/critic.md (critic corrections override the domain reports). Wave 0 is done and committed on branch feat/api-integration: HTTP core (API_BASE_URL in core/constants/api.ts, core/models/api.ts CursorPage/ProblemDetails, core/utils/api.ts fetchAllPages + toApiError, auth interceptor in core/interceptors, SessionService with status guest|pending-verification|authenticated, SessionDataService in core/services/session-data where stores register load()/reset()). Read those files and the READMEs of core/ before writing code, and REUSE them. The real API runs in Docker at http://localhost:5210 (never modify ${ROOT}/API). Dev e-mails (verification tokens) land in ${SP}/docker/outbox/*.txt. For live contract checks use curl/node fetch directly against http://localhost:5210 with throwaway users (<name>+<random>@example.test; register → token from outbox → POST auth/email/verify → login), and delete them afterwards (DELETE /api/v1/me). Do NOT use the browser (UI testing happens after merge). Tests: npx ng test --watch=false ; build: npx ng build (both run inside the app folder of YOUR tree; must be clean, no warnings). HTTP specs use provideHttpClient() + provideHttpClientTesting() + HttpTestingController.`;

const DOMAINS = [
  {
    key: 'profile',
    report: 'profile-goals-nutrition.md',
    task: `Domain PROFILE DATA + GOALS + SETTINGS (not the photo upload — another agent does that). Implement per ${SP}/map/profile-goals-nutrition.md §8 and plan.md decision 1:
- API types + thin API service for me, me/profile (PATCH), me/profile/activity if useful, me/goals (current, POST), me/settings (GET, PUT {value}), me/weight-logs/latest.
- Pure mapper (spec'd): API → UserProfile (gender Male/Female/Other ↔ mand/kvinde/andet, Unspecified/PreferNotToSay ↔ null; trainingIntensity ↔ RPE 3/6/9 with RPE→level via INTENSITIES maxRpe; trainingDaysPerWeek ↔ 7 booleans keeping the local weekday pattern when the count matches, else first N days; pace ↔ weightChangePerWeek nearest PACES; goalType ↔ tabe/hold/tage; WeightUnit kg/lb ↔ units; Notifications setting ↔ notificationsEnabled; profileImageUrl → photo {dataUrl: url, aspectRatio: 1, zoom: 1, x: 50, y: 50}), and UserProfile patch → API requests.
- UserProfileService: load() (forkJoin of the GETs, 404 → keep defaults), save(patch): Observable<void> routing each field to its endpoint (profile fields → PATCH me/profile then reloadGoal(); goal/pace/goalWeight → POST me/goals with MaintainWeight using targetWeight = current weight from latest and pace 0, 409 identical goal = success; notificationsEnabled/units → PUT me/settings/{key}; username → PATCH me (409 taken error); email → PATCH me, then the account is inactive until the new e-mail is verified: end the session via SessionService and route the user through the existing verify flow / login — keep it simple and explain in README), reloadGoal() (replace the stub), goal signal (UserGoalDto | null), reset(). Keep update(patch) as the synchronous local setter (contract!). Timezone sync: after load, PATCH me/profile {timeZoneId} if Intl's zone differs. Local-only extras the API cannot store (kcalOverride, weekday pattern, exact RPE, preferred pace when maintaining) stay in localStorage with // ponytail: comments pointing to the gap. Register the store in SessionDataService.
- AdaptiveGoalService/NutritionCalculator: kcal base = round(goal.targetDailyCalories) when a goal is loaded, + existing adaptive adjustment, kcalOverride wins; macros scaled proportionally from the API grams. Before an account exists (signup preview) keep the app formula.
- ThemeService/LanguageService: on set() also PUT me/settings/Theme|Language when authenticated (fire-and-forget with console.error on failure is NOT allowed silently — log and keep local value, document it); on profile load apply server values (Theme 'system' → app default). Values: Theme light|dark|system (case-sensitive), Language 'da'|'en'.
- features/profile: profile-edit service + edit sheet become async (busy state on save, UiFormError with i18n keys on failure, sheet stays open on error); tighten limits to API (height ≥ 100, age ≤ 100). Profile page shows loading/error for the initial load if relevant.
- Tests for mapper (all enum tables both ways, edge cases), API service (URLs, verbs, bodies), UserProfileService (save routes per field, 409 goal = success, reloadGoal after profile PATCH, reset), adaptive goal with API base, theme/language sync. Update broken specs.`,
  },
  {
    key: 'photo',
    report: 'profile-goals-nutrition.md',
    task: `Domain PROFILE PHOTO (only this; another agent does the rest of profile). Per ${SP}/map/profile-goals-nutrition.md §2.2 and §6: API service methods for PUT me/profile/image (multipart/form-data, field name "file", JPEG ≤ 2 MB; response {profileImageUrl}) and DELETE me/profile/image (204; 404 = already gone = success). Change features/profile/components/profile-photo-sheet (+ shared/components/profile-avatar/photo-crop.ts helpers if needed) from "save live on every drag/zoom" to "upload on confirm": bake the crop (zoom/x/y/aspect) into a square JPEG via canvas (e.g. 512×512, quality ~0.85, well under 2 MB) and upload; loading + error state (UiFormError, i18n keys in da+en); on success set the profile photo locally via UserProfileService.update({ photo: { dataUrl: profileImageUrl, aspectRatio: 1, zoom: 1, x: 50, y: 50 } }) (the profile agent maps profileImageUrl the same way on load). "Remove photo" → DELETE. Keep the avatar rendering working with an https URL. IMPORTANT: never upload to the live API (it writes to a real Azure container) — test with HttpTestingController only; you may call DELETE on a throwaway user without a photo to confirm the 404 shape. Unit-test the canvas-bake helper where feasible in jsdom (or isolate the pure geometry part) and the sheet's upload/error flow.`,
  },
  {
    key: 'reminders',
    report: 'reminders.md',
    task: `Domain REMINDERS per ${SP}/map/reminders.md §4 (settings stored in the API, delivery stays local notifications; no Firebase/devices). RemindersApi (list/create/update), apiType per ReminderDefinition, id-order convention for the four LogFood kinds (create missing ones sequentially in definition order; never delete; sort by reminderId), reminderTime "HH:mm" out / slice(0,5) in, weekday stays local, PATCH only changed fields through a queue (last write wins), SAVE error key in da+en, load() when SessionService status becomes authenticated (NOT isLoggedIn) — register in SessionDataService — and reset() on guest (reset to DEFAULT_REMINDER_SETTINGS and cancel scheduled local notifications so a logged-out phone stops firing). Keep reminder-notifier and the reminders sheet unchanged unless needed. Tests per report §4.4.`,
  },
  {
    key: 'weight',
    report: 'weight.md',
    task: `Domain WEIGHT per ${SP}/map/weight.md §3 (with critic R4: endpoints relative to API_BASE_URL, e.g. 'me/weight-logs'). WeightLogService on HttpClient: load() GET ?limit=100, add() POST with 409 → PATCH existingWeightLogId, update() PATCH {weight}, remove() DELETE, status signal, pessimistic updates, sort by Date.parse. Keep profile weightKg in sync via UserProfileService.update({ weightKg }) (local setter, contract) and fall back to GET me/weight-logs/latest when the list becomes empty; after every successful mutation call UserProfileService.reloadGoal() (contract; stub exists). Register load/reset in SessionDataService. Remove STORAGE_KEY.WEIGHT_LOG. Update every caller of the changed mutation APIs so the build stays green (weight-view, weight page, edit sheet: saving/busy, errors via UiFormError, sheet stays open on error, loading/error/retry state for the first load). i18n keys in da+en. Tests per report §3.9 (no live UI).`,
  },
  {
    key: 'food',
    report: 'food.md',
    task: `Domain FOOD (catalog, custom foods, barcode flow, food log, food page) per ${SP}/map/food.md §3–§5 and plan.md decision 2 (meal as fixed local hour in consumedAt; create core/utils/meal-slot.ts with mealSlotIso(day, meal) and mealFromConsumedAt(iso), spec'd incl. DST). Food API service + mapping (FoodDto → FoodItem with base portion from servings; FoodLogDto → LoggedFood; CustomFoodInput/ScannedProduct → CreateFoodRequest + needed serving PUT; units g/ml/stk/portion ↔ Gram/Milliliter/Piece/Serving). FoodLogService: load() (catalog via fetchAllPages on GET foods?limit=100, logs for the last 90 days via fetchAllPages on GET me/food-logs?from&to&limit=100), mutations return Observable and update signals from server responses, status signal, reset(); register in SessionDataService. Keep all existing public computed signals (entries, byMeal, totals, entriesFor, dailyTotals, allEntries, customFoods …) so consumers keep working. BarcodeFlowService: check the loaded catalog by barcode first, else Open Food Facts as today; logging a scanned product creates the food (with barcode, + Milliliter serving for liquids) and then the log; 409 name clash → retry once with "<name> (<brand or barcode>)". Food page + add sheet + food-picker: async with pending state (CTA disabled/loading), UiFormError errors, loading/error/empty states for the first load; i18n keys in da+en. Remove STORAGE_KEY.FOOD_LOG and CUSTOM_FOODS and FOOD_SEARCH_DELAY_MS if unused. IMPORTANT: callers in OTHER features that break because mutations became Observable (history relog, collections new-collection-sheet addCustomFood, food-add-sheet collection logging, recipe page) must be minimally adapted so the build stays green and behaviour is preserved (subscribe; collections/history are fully reworked in wave 2). Tests per report §5.10.`,
  },
];

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'severity', 'problem', 'fix'],
      },
    },
    buildOk: { type: 'boolean' },
    testsOk: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['findings', 'buildOk', 'testsOk', 'summary'],
};

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    worktree: {
      type: 'string',
      description: 'absolute path of YOUR worktree root (git rev-parse --show-toplevel)',
    },
    report: {
      type: 'string',
      description:
        'files changed, decisions beyond the plan, test/build numbers, new API gaps found',
    },
    newGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['worktree', 'report', 'newGaps'],
};

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commit: { type: 'string' },
    report: {
      type: 'string',
      description: 'per finding fixed/skipped + reason, final test count, build status',
    },
    newGaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['branch', 'commit', 'report', 'newGaps'],
};

phase('Implement');
const domainsDone = pipeline(
  DOMAINS,
  (d) =>
    agent(
      `${COMMON}\n\nYou are in your OWN git worktree (isolated copy; other agents work on other domains in theirs). First: run \`git rev-parse --show-toplevel\` and \`git log --oneline -3\` (HEAD must include wave 0 on feat/api-integration), then symlink node_modules: ln -s ${MAIN_APP}/node_modules <your-worktree>/mobilapp/node_modules (if build/test misbehave with the symlink, remove it and run npm ci). Also read ${SP}/map/${d.report}.\n\n${d.task}\n\nFollow ARCHITECTURE.md, CLAUDE.md and ponytail (simplest correct solution, reuse, no new deps). Update the READMEs your change affects (Danish). Do not commit yet. Return your worktree path, a report, and any NEW API gaps you discovered (Danish, one line each).`,
      { label: `impl:${d.key}`, phase: 'Implement', isolation: 'worktree', schema: IMPL_SCHEMA },
    ),
  (impl, d) =>
    agent(
      `${COMMON}\n\nReview READ-ONLY the uncommitted work of the ${d.key} domain agent in the worktree ${impl.worktree} (use git -C ${impl.worktree} diff / status; read files there — NOT the main tree). Its report:\n---\n${impl.report}\n---\nTask was:\n${d.task}\n\nCheck: (1) correctness against the real C# DTOs/controllers in ${ROOT}/API and the live API (curl, throwaway user, clean up); (2) ARCHITECTURE.md/CLAUDE.md rules (i18n keys exist in BOTH da.json and en.json, no hardcoded text, no any, no magic strings, tokens/BEM, OnPush, loading/empty/error states, no silent catch, READMEs updated, dependency direction); (3) contracts in plan.md honoured (update() stays sync local setter, reloadGoal, meal-slot helper, SessionDataService registration, load only when authenticated); (4) tests meaningful for the risky logic; (5) over-engineering to cut. Run build + tests IN THAT WORKTREE's mobilapp folder (cd ${impl.worktree}/mobilapp) and report status. Only real, concrete findings with file:line and a specific fix.`,
      { label: `review:${d.key}`, phase: 'Review', schema: REVIEW_SCHEMA },
    ).then((r) => ({ impl, review: r })),
  (x, d) =>
    agent(
      `${COMMON}\n\nYou finish the ${d.key} domain in the worktree ${x.impl.worktree} (work ONLY there: cd ${x.impl.worktree}/mobilapp). Reviewer findings:\n${JSON.stringify(x.review, null, 1)}\n\nVerify each finding (skip wrong ones with a reason) and fix the real ones. Then make build and the full test suite clean in that worktree. Then commit: if HEAD is detached or on a temp branch, \`git switch -c wave1/${d.key}\`; stage everything of this domain (not the node_modules symlink!) and commit with a Conventional Commit message in Danish (e.g. "feat(${d.key}): ..." with a short body), WITHOUT any Co-Authored-By or AI attribution. Never push. Return branch, commit sha, report, and new API gaps (Danish, one line each; include the implementer's: ${JSON.stringify(x.impl.newGaps)}).`,
      { label: `fix:${d.key}`, phase: 'Fix', schema: FIX_SCHEMA },
    ).then((f) => ({ key: d.key, worktree: x.impl.worktree, ...f })),
);

const uiAuth = agent(
  `${COMMON}\n\nUI TEST of wave 0 (auth) in the MAIN tree ${MAIN_APP} (branch feat/api-integration). You MAY use the built-in browser tools here (mcp__Claude_Browser__*; you're the only browser user now). Start the dev server with mcp__Claude_Browser__preview_start {name: "mobilapp-dev"} (config in ${MAIN_APP}/.claude/launch.json; it uses the dev proxy to the Docker API) and use resize_window preset "mobile". Test end-to-end like a user, with a fresh @example.test user: full signup wizard → pending verification sheet on Home → paste token from ${SP}/docker/outbox (newest file for that e-mail) → verified, Home unlocked; "check again" and "resend" behaviour; logout; login with e-mail (+ wrong password error text; unverified account hint); forgot password → token from outbox → new password → logged in; delete account (confirm the user can no longer log in). Also try the English language if a switch exists. Check console errors and network requests (read_console_messages / read_network_requests) — no bearer to Open Food Facts, refresh works (you can force it by editing the stored accessTokenExpiresAt in localStorage via javascript_tool to a past time and navigating). Fix real bugs you find, ONLY in auth/session/signup/interceptor/verify-sheet/profile logout+delete files and their i18n/README, keep tests green (npx ng test --watch=false; npx ng build), then commit on feat/api-integration as "fix(auth): ..." (Danish, no AI attribution, never push). Take a final screenshot of the logged-in Home. Stop the preview server at the end (preview_stop). Return a concise report: what was tested, bugs found/fixed, remaining issues, new API gaps (Danish).`,
  { label: 'ui:auth', phase: 'UI auth' },
);

const [domainResults, uiReport] = await Promise.all([domainsDone, uiAuth]);
const ok = domainResults.filter(Boolean);
log(`domains committed: ${ok.map((r) => r.key + '@' + r.branch).join(', ')}`);

phase('Merge');
const merge = await agent(
  `${COMMON}\n\nMERGE step in the MAIN tree ${ROOT} (branch feat/api-integration; make sure the working tree is clean first — if the UI-test agent left uncommitted changes, report them and commit them as "fix(auth): ..." only if they are finished and tests pass). Merge these branches one at a time with \`git merge --no-ff <branch>\` (Danish merge messages, no AI attribution): ${JSON.stringify(ok.map((r) => ({ key: r.key, branch: r.branch, commit: r.commit })))}. Resolve conflicts carefully (i18n JSON: keep ALL keys from both sides and keep the JSON valid; READMEs: combine; session-data store list: include all stores; storage-key: apply all removals; code conflicts: understand both intents). After all merges: npx ng build and npx ng test --watch=false in ${MAIN_APP} must be clean — fix integration problems (e.g. two domains changing the same caller differently, contract mismatches like reloadGoal/update/meal-slot) and commit fixes as "fix: ..." . Also validate that da.json and en.json have exactly the same key set (write a tiny node/python check and fix any mismatch). Do NOT remove the worktrees. Never push. Return: merge summary, conflicts and how they were resolved, final test count + build status, and remaining problems.`,
  { label: 'merge:wave1', phase: 'Merge' },
);

return {
  domains: ok.map((r) => ({
    key: r.key,
    branch: r.branch,
    commit: r.commit,
    worktree: r.worktree,
    report: r.report,
    newGaps: r.newGaps,
  })),
  missing: DOMAINS.map((d) => d.key).filter((k) => !ok.find((r) => r.key === k)),
  uiAuth: uiReport,
  merge,
};
