import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { ThemeService } from '../../../../core/services/theme';
import { UserProfileService } from '../../../../core/services/user-profile';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiPageHeader } from '../../../../shared/components/ui-page-header/ui-page-header';
import { UiRowButton } from '../../../../shared/components/ui-row-button/ui-row-button';
import { UiSwitch } from '../../../../shared/components/ui-switch/ui-switch';
import { Achievements } from '../../components/achievements/achievements';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import { ProfileDeleteAccountSheet } from '../../components/profile-delete-account-sheet/profile-delete-account-sheet';
import { ProfileEditSheet } from '../../components/profile-edit-sheet/profile-edit-sheet';
import { ProfileLogoutSheet } from '../../components/profile-logout-sheet/profile-logout-sheet';
import { ProfilePhotoSheet } from '../../components/profile-photo-sheet/profile-photo-sheet';
import { AchievementsService } from '../../services/achievements';
import { ProfileEditRowId } from '../../services/profile-edit';
import { ProfileRowsService } from '../../services/profile-rows';

/**
 * The profile screen: avatar and key figures at the top, then "Min plan", "Konto", the
 * achievements, "Log ud" and "Slet konto". All rows open the same edit sheet, which knows its own variant.
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
    UiButton,
    UiIcon,
    UiPageHeader,
    UiRowButton,
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
  private readonly rows = inject(ProfileRowsService);
  private readonly achievementsService = inject(AchievementsService);

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
  protected readonly notificationsEnabled = computed(
    () => this.profiles.profile().notificationsEnabled,
  );

  protected readonly editRow = signal<ProfileEditRowId | null>(null);
  protected readonly photoOpen = signal(false);
  protected readonly logoutOpen = signal(false);
  protected readonly deleteAccountOpen = signal(false);

  protected goBack(): void {
    void this.router.navigateByUrl(APP_PATH.HOME);
  }

  protected openEdit(row: ProfileEditRowId): void {
    this.editRow.set(row);
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
  }

  /** Clears all local data and reloads the app at login – see `SessionService.deleteAccount()`. */
  protected deleteAccount(): void {
    this.deleteAccountOpen.set(false);
    this.session.deleteAccount();
  }

  protected setLight(light: boolean): void {
    this.theme.set(light ? 'light' : 'dark');
  }

  protected setNotifications(enabled: boolean): void {
    this.profiles.update({ notificationsEnabled: enabled });
  }

  protected logout(): void {
    this.logoutOpen.set(false);
    this.session.logout();
    void this.router.navigateByUrl(APP_PATH.LOGIN);
  }
}
