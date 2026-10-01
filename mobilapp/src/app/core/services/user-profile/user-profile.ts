import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  concat,
  defer,
  forkJoin,
  map,
  of,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
import { ME_ENDPOINT } from '../../constants/auth';
import { CALORIE_FLOOR_KCAL, GOALS, PACES } from '../../constants/nutrition';
import { PROFILE_ENDPOINT } from '../../constants/profile';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { StoreStatus } from '../../models/api';
import { UserDto } from '../../models/auth';
import { Macros } from '../../models/food';
import {
  ActivityLevel,
  GoalDefinition,
  GoalId,
  IntensityDefinition,
  PaceDefinition,
  PaceId,
  UserProfile,
} from '../../models/profile';
import {
  CreateUserGoalRequest,
  LatestWeightDto,
  PatchUserProfileRequest,
  UpsertUserSettingRequest,
  UserGoalDto,
  UserProfileDto,
  UserSettingDto,
} from '../../models/profile-api';
import { injectApiUrl, mapApiError, toApiError } from '../../utils/api';
import { NOW } from '../../utils/now';
import {
  GENDER_TO_API,
  GOAL_TO_API,
  INTENSITY_TO_API,
  registerErrorKey,
} from '../auth-api/auth-mapping';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { SessionDataStore } from '../session-data/session-data';
import {
  UPLOADED_PHOTO_CROP,
  toGoalFields,
  toProfileFields,
  toUserProfile,
} from './profile-mapping';

const NO_TARGETS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const MAINTAIN_GOAL: GoalId = 'hold';
/** A new "lose"/"gain" goal without a chosen pace gets the recommended one. */
const DEFAULT_PACE: PaceId = 'moderat';
/** The multipart field the API reads the photo from, and the baked photo's file name. */
const PHOTO_UPLOAD_FIELD = 'file';
const PHOTO_UPLOAD_FILE_NAME = 'avatar.jpg';

/**
 * The signed-in user's profile from the API, as one signal plus derived values (age, BMI,
 * activity level …), the current goal and its targets.
 *
 * `load()` fetches everything in parallel and replaces the whole profile. Its
 * `POST me/goals/recalculate` is the spec's "on the 1st of every month": the API only stores a
 * new goal when the numbers have moved. `save()` is pessimistic – memory changes only after the
 * API has answered. `update()`, `replace()` and `resetToDefaults()` only change memory (the
 * sign-up draft, the weight store, an account switch); nothing is written to storage.
 *
 * Never injects `SessionService` (it injects this service): `SessionDataService` calls `load()`
 * once the session is authenticated and `reset()` when it becomes a guest.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileService implements SessionDataStore {
  private readonly http = inject(HttpClient);
  private readonly url = injectApiUrl();
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly state = signal<UserProfile>({ ...DEFAULT_PROFILE });
  private readonly statusState = signal<StoreStatus>('idle');
  private readonly goalState = signal<UserGoalDto | null>(null);

  readonly profile: Signal<UserProfile> = this.state.asReadonly();
  readonly status: Signal<StoreStatus> = this.statusState.asReadonly();
  /** The API's current goal; `null` until loaded. */
  readonly goal: Signal<UserGoalDto | null> = this.goalState.asReadonly();
  /** The daily calorie and macro targets, rounded – the API's, never the app's. 0 until loaded. */
  readonly targets: Signal<Macros> = computed(() => {
    const goal = this.goalState();
    return goal === null
      ? NO_TARGETS
      : {
          kcal: Math.round(goal.targetDailyCalories),
          protein: Math.round(goal.targetProtein),
          carbs: Math.round(goal.targetCarbohydrates),
          fat: Math.round(goal.targetFat),
        };
  });
  /** The API lifted the target to its safe minimum – it lifts to exactly `CALORIE_FLOOR_KCAL`. */
  readonly calorieFloorApplied: Signal<boolean> = computed(() => {
    const goal = this.goalState();
    const floor = CALORIE_FLOOR_KCAL[this.state().gender ?? 'andet'];
    return goal !== null && goal.targetDailyCalories === floor;
  });
  /** The user's own name. Empty until the user has signed up or logged in. */
  readonly displayName = computed(() => this.state().username.trim());
  readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());
  readonly age = computed(() => this.calculator.ageFromBirthday(this.state().birthday, this.now()));
  readonly bmi = computed(() => this.calculator.bmi(this.state().weightKg, this.state().heightCm));
  readonly activityLevel: Signal<ActivityLevel> = computed(() =>
    this.calculator.activityLevelFor(this.state().stepsPerDay),
  );
  readonly trainingFrequency = computed(() => this.calculator.trainingFrequency(this.state()));
  readonly intensity: Signal<IntensityDefinition | null> = computed(() =>
    this.calculator.intensityFor(this.state().trainingRpe),
  );
  readonly goalDefinition: Signal<GoalDefinition | null> = computed(
    () => GOALS.find((goal) => goal.id === this.state().goal) ?? null,
  );
  readonly paceDefinition: Signal<PaceDefinition | null> = computed(() =>
    this.calculator.paceFor(this.state().pace),
  );

  /**
   * Fetches the whole profile: account, profile, (recalculated) goal, settings and latest weight.
   * Never errors – a failure sets `status` to `'error'`, and screens offer "Prøv igen", which
   * calls this again. A failed recalculation falls back to the current goal.
   */
  load(): Observable<void> {
    return defer(() => {
      this.statusState.set('loading');
      return forkJoin({
        user: this.http.get<UserDto>(this.url(ME_ENDPOINT)),
        profile: this.http.get<UserProfileDto>(this.url(PROFILE_ENDPOINT.PROFILE)),
        goal: this.http
          .post<UserGoalDto>(this.url(PROFILE_ENDPOINT.RECALCULATE_GOAL), null)
          .pipe(catchError(() => this.fetchCurrentGoal())),
        settings: this.http.get<UserSettingDto[]>(this.url(PROFILE_ENDPOINT.SETTINGS)),
        latest: this.http.get<LatestWeightDto>(this.url(PROFILE_ENDPOINT.LATEST_WEIGHT)),
      });
    }).pipe(
      map((parts) => {
        this.goalState.set(parts.goal);
        this.state.set(toUserProfile(parts));
        this.statusState.set('ready');
      }),
      catchError(() => {
        this.statusState.set('error');
        return of(undefined);
      }),
    );
  }

  /** Forgets the account's profile – memory only. */
  reset(): void {
    this.resetToDefaults();
    this.statusState.set('idle');
  }

  /**
   * Saves a change in the API and then applies the API's answer. Routed per field:
   * profile fields → `PATCH me/profile`, then `reloadGoal()` (the API recalculated it) ·
   * goal, pace, goal weight → `POST me/goals` (409 = the goal already matches = success) ·
   * notifications → `PUT me/settings/Notifications` · e-mail → `PATCH me`, and the local e-mail
   * stays: the API keeps the old address until the link in the mail to the new one is tapped.
   * Fails with an `ApiError` (e-mail: `registerErrorKey`); nothing changes then.
   */
  save(patch: Partial<UserProfile>): Observable<void> {
    const saves: Observable<void>[] = [];
    const profileRequest = this.toPatchRequest(patch);
    if (Object.values(profileRequest).some((value) => value !== undefined)) {
      saves.push(this.saveProfile(profileRequest));
    }
    if (patch.goal !== undefined || patch.pace !== undefined || patch.goalWeightKg !== undefined) {
      saves.push(defer(() => this.saveGoal(this.toGoalRequest({ ...this.state(), ...patch }))));
    }
    if (patch.notificationsEnabled !== undefined) {
      saves.push(this.saveNotifications(patch.notificationsEnabled));
    }
    if (patch.email !== undefined) {
      saves.push(this.saveEmail(patch.email));
    }
    return concat(...saves).pipe(
      toArray(),
      map(() => undefined),
    );
  }

  /**
   * Spec 2.4: uploads the baked photo (`PUT me/profile/image`, multipart field `file`) and shows
   * the API's URL – relative in Development (`/api/v1/dev-images/…`, served through the dev
   * proxy). Pessimistic: the photo changes only once the API has answered.
   */
  uploadPhoto(blob: Blob): Observable<void> {
    const body = new FormData();
    body.append(PHOTO_UPLOAD_FIELD, blob, PHOTO_UPLOAD_FILE_NAME);
    return this.http
      .put<{ profileImageUrl: string }>(this.url(PROFILE_ENDPOINT.PROFILE_IMAGE), body)
      .pipe(
        map(({ profileImageUrl }) =>
          this.update({ photo: { dataUrl: profileImageUrl, ...UPLOADED_PHOTO_CROP } }),
        ),
        mapApiError(),
      );
  }

  /** Removes the photo (`DELETE me/profile/image`). 404 = it is already gone = success. */
  deletePhoto(): Observable<void> {
    return this.http.delete<void>(this.url(PROFILE_ENDPOINT.PROFILE_IMAGE)).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound
          ? of(undefined)
          : throwError(() => toApiError(error)),
      ),
      map(() => this.update({ photo: null })),
    );
  }

  /** The current goal (`GET me/goals/current`) – after the API has recalculated it. */
  reloadGoal(): Observable<void> {
    return this.fetchCurrentGoal().pipe(
      map((goal) => this.applyGoal(goal)),
      mapApiError(),
    );
  }

  /** Memory only – e.g. the weight store keeps `weightKg` equal to the latest weigh-in. */
  update(patch: Partial<UserProfile>): void {
    this.state.update((profile) => ({ ...profile, ...patch }));
  }

  /** Memory only – the sign-up draft once the account exists. */
  replace(profile: UserProfile): void {
    this.state.set(profile);
  }

  /** Memory only – another account signs in on this device. */
  resetToDefaults(): void {
    this.state.set({ ...DEFAULT_PROFILE });
    this.goalState.set(null);
  }

  private fetchCurrentGoal(): Observable<UserGoalDto> {
    return this.http.get<UserGoalDto>(this.url(PROFILE_ENDPOINT.CURRENT_GOAL));
  }

  private saveProfile(request: PatchUserProfileRequest): Observable<void> {
    return this.http.patch<UserProfileDto>(this.url(PROFILE_ENDPOINT.PROFILE), request).pipe(
      map((dto) => this.update(toProfileFields(dto))),
      mapApiError(),
      switchMap(() => this.reloadGoal()),
    );
  }

  private saveGoal(request: CreateUserGoalRequest): Observable<void> {
    return this.http.post<UserGoalDto>(this.url(PROFILE_ENDPOINT.GOALS), request).pipe(
      map((goal) => this.applyGoal(goal)),
      catchError((error: unknown) =>
        // 409: the current goal already is this one – only the profile's fields follow.
        error instanceof HttpErrorResponse && error.status === HttpStatusCode.Conflict
          ? of(this.update(toGoalFields(request)))
          : throwError(() => toApiError(error)),
      ),
    );
  }

  private saveNotifications(enabled: boolean): Observable<void> {
    const request: UpsertUserSettingRequest = { value: String(enabled) };
    return this.http
      .put<UserSettingDto>(this.url(PROFILE_ENDPOINT.NOTIFICATIONS_SETTING), request)
      .pipe(
        map(() => this.update({ notificationsEnabled: enabled })),
        mapApiError(),
      );
  }

  private saveEmail(email: string): Observable<void> {
    return this.http.patch<UserDto>(this.url(ME_ENDPOINT), { email }).pipe(
      map(() => undefined),
      mapApiError(registerErrorKey),
    );
  }

  private applyGoal(goal: UserGoalDto): void {
    this.goalState.set(goal);
    this.update(toGoalFields(goal));
  }

  /** The profile fields of `patch` in the API's shape; `undefined` = not sent. */
  private toPatchRequest(patch: Partial<UserProfile>): PatchUserProfileRequest {
    const intensity =
      patch.trainingRpe === undefined ? null : this.calculator.intensityFor(patch.trainingRpe);
    return {
      birthDate: patch.birthday ?? undefined,
      gender: patch.gender ? GENDER_TO_API[patch.gender] : undefined,
      height: patch.heightCm,
      dailySteps: patch.stepsPerDay,
      trainingDaysPerWeek: patch.trainingDays?.filter(Boolean).length,
      workoutDurationMinutes: patch.trainingMinutes,
      trainingIntensity: intensity ? INTENSITY_TO_API[intensity.id] : undefined,
    };
  }

  /**
   * The goal as the API validates it: maintaining sends the current weight (the API's latest
   * weigh-in, loaded into `weightKg`) and pace 0; losing or gaining the goal weight and a pace.
   */
  private toGoalRequest(profile: UserProfile): CreateUserGoalRequest {
    const goal = profile.goal ?? MAINTAIN_GOAL;
    if (goal === MAINTAIN_GOAL) {
      return {
        goalType: GOAL_TO_API[goal],
        targetWeight: profile.weightKg,
        weightChangePerWeek: 0,
      };
    }
    const paceId = profile.pace ?? DEFAULT_PACE;
    return {
      goalType: GOAL_TO_API[goal],
      targetWeight: profile.goalWeightKg,
      weightChangePerWeek: PACES.find((pace) => pace.id === paceId)!.kgPerWeek,
    };
  }
}
