import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_PATH } from '../../../../core/constants/app-route';
import { LANGUAGE_OPTIONS } from '../../../../core/constants/language';
import { Language } from '../../../../core/models/language';
import { LanguageService } from '../../../../core/services/language/language';
import { injectTranslate } from '../../../../core/services/language/translate';
import { ReminderService } from '../../../../core/services/reminders/reminders';
import { SessionService } from '../../../../core/services/session/session';
import { ThemeService } from '../../../../core/services/theme/theme';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiPageHeader } from '../../../../shared/components/ui-page-header/ui-page-header';
import { UiRowButton } from '../../../../shared/components/ui-row-button/ui-row-button';
import { UiSegmentedControl } from '../../../../shared/components/ui-segmented-control/ui-segmented-control';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { UiSwitch } from '../../../../shared/components/ui-switch/ui-switch';
import { Achievements } from '../../components/achievements/achievements';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import { ProfileDeleteAccountSheet } from '../../components/profile-delete-account-sheet/profile-delete-account-sheet';
import { ProfileEditSheet } from '../../components/profile-edit-sheet/profile-edit-sheet';
import { ProfileLogoutSheet } from '../../components/profile-logout-sheet/profile-logout-sheet';
import { ProfilePhotoSheet } from '../../components/profile-photo-sheet/profile-photo-sheet';
import { ProfileRemindersSheet } from '../../components/profile-reminders-sheet/profile-reminders-sheet';
import { AchievementsService } from '../../services/achievements';
import { ProfileEditRowId } from '../../services/profile-edit';
import { ProfileRow, ProfileRowsService } from '../../services/profile-rows';

const REMINDERS_VALUE_KEY = {
  OFF: 'profile.page.remindersOff',
  NONE: 'profile.page.remindersNone',
  ACTIVE_ONE: 'profile.page.remindersActiveOne',
  ACTIVE_MANY: 'profile.page.remindersActiveMany',
} as const;

/**
 * The profile screen: avatar and key figures at the top, then "Min plan", "Konto", the
 * achievements, "Log ud" and "Slet konto". All rows open the same edit sheet, which knows its own
 * variant – except the calorie target, which is the API's and can't be edited.
 *
 * While the profile loads, a spinner replaces the profile's own data; if it fails, a message and
 * "Prøv igen" do. The device settings, log out and account deletion stay usable either way.
 *
 * The page sits outside the tab shell (it's opened from the avatar on Home), so it doesn't
 * reserve space for the tab bar and navigates back to Home instead.
 */
@Component({
  selector: 'app-profile-page',
  imports: [
    Achievements,
    ProfileAvatar,
    ProfileDeleteAccountSheet,
    ProfileEditSheet,
    ProfileLogoutSheet,
    ProfilePhotoSheet,
    ProfileRemindersSheet,
    TranslatePipe,
    UiButton,
    UiEmptyState,
    UiIcon,
    UiPageHeader,
    UiRowButton,
    UiSegmentedControl,
    UiSpinner,
    UiSwitch,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-page' },
})
export class ProfilePage {
  private readonly router = inject(Router);
  private readonly profiles = inject(UserProfileService);
  private readonly session = inject(SessionService);
  private readonly theme = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly rows = inject(ProfileRowsService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly reminders = inject(ReminderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly status = this.profiles.status;
  /** The profile's own data is hidden while it loads or after it failed to load. */
  protected readonly profileShown = computed(
    () => this.status() !== 'loading' && this.status() !== 'error',
  );
  protected readonly displayName = this.profiles.displayName;
  protected readonly initial = this.profiles.initial;
  protected readonly photo = computed(() => this.profiles.profile().photo);
  protected readonly email = this.rows.email;
  protected readonly weightText = this.rows.weightText;
  protected readonly heightText = this.rows.heightText;
  protected readonly bmiText = this.rows.bmiText;
  protected readonly planRows = this.rows.planRows;
  protected readonly accountRows = this.rows.accountRows;
  protected readonly achievements = this.achievementsService.achievements;
  protected readonly isLight = this.theme.isLight;
  protected readonly languages = LANGUAGE_OPTIONS;
  protected readonly language = this.languageService.language;
  protected readonly notificationsEnabled = this.reminders.masterEnabled;
  /** The "Påmindelser" row's value: "Fra", "Ingen", "1 aktiv" or "3 aktive". */
  protected readonly remindersValue = computed(() => {
    const count = this.reminders.enabledCount();
    if (!this.reminders.masterEnabled()) {
      return this.t(REMINDERS_VALUE_KEY.OFF);
    }
    if (count === 0) {
      return this.t(REMINDERS_VALUE_KEY.NONE);
    }
    return this.t(count === 1 ? REMINDERS_VALUE_KEY.ACTIVE_ONE : REMINDERS_VALUE_KEY.ACTIVE_MANY, {
      count,
    });
  });

  protected readonly editRow = signal<ProfileEditRowId | null>(null);
  protected readonly photoOpen = signal(false);
  protected readonly logoutOpen = signal(false);
  protected readonly deleteAccountOpen = signal(false);
  protected readonly remindersOpen = signal(false);
  protected readonly loggingOut = signal(false);
  protected readonly deletingAccount = signal(false);
  /** A key, so a shown error follows a language switch. */
  private readonly deleteErrorKey = signal<string | null>(null);
  protected readonly deleteError = computed(() => {
    const key = this.deleteErrorKey();
    return key === null ? null : this.t(key);
  });

  protected goBack(): void {
    void this.router.navigateByUrl(APP_PATH.HOME);
  }

  protected openEdit(row: ProfileRow): void {
    if (row.editable !== false) {
      this.editRow.set(row.id);
    }
  }

  /** Never fails – a new failure shows the error again. */
  protected retryLoad(): void {
    this.profiles.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected closeEdit(): void {
    this.editRow.set(null);
  }

  protected openPhoto(): void {
    this.photoOpen.set(true);
  }

  protected closePhoto(): void {
    this.photoOpen.set(false);
  }

  protected openReminders(): void {
    this.remindersOpen.set(true);
  }

  protected closeReminders(): void {
    this.remindersOpen.set(false);
  }

  protected askLogout(): void {
    this.logoutOpen.set(true);
  }

  protected closeLogout(): void {
    this.logoutOpen.set(false);
  }

  protected askDeleteAccount(): void {
    this.deleteAccountOpen.set(true);
  }

  protected closeDeleteAccount(): void {
    this.deleteAccountOpen.set(false);
    this.deleteErrorKey.set(null);
  }

  /**
   * Deletes the account in the API. On success `SessionService.deleteAccount()` clears all local
   * data and reloads the app at login, so the sheet stays busy until then. On an error nothing
   * is deleted and the sheet shows why.
   */
  protected deleteAccount(): void {
    if (this.deletingAccount()) {
      return;
    }
    this.deletingAccount.set(true);
    this.deleteErrorKey.set(null);
    this.session
      .deleteAccount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error: unknown) => {
          this.deletingAccount.set(false);
          this.deleteErrorKey.set(toApiError(error).messageKey);
        },
      });
  }

  protected setLight(light: boolean): void {
    this.theme.set(light ? 'light' : 'dark');
  }

  protected setLanguage(language: Language | null): void {
    if (language !== null) {
      void this.languageService.set(language);
    }
  }

  protected setNotifications(enabled: boolean): void {
    this.reminders.setMasterEnabled(enabled);
  }

  /** Never fails: the session ends locally even if the API can't be reached. */
  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.session
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loggingOut.set(false);
        this.logoutOpen.set(false);
        void this.router.navigateByUrl(APP_PATH.LOGIN);
      });
  }
}
