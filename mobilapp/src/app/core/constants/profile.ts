/** Profile, goal and settings endpoints, relative to `API_BASE_URL` (`'me'` is `ME_ENDPOINT`). */
export const PROFILE_ENDPOINT = {
  PROFILE: 'me/profile',
  /** `PUT` (multipart, field `file`) and `DELETE` the profile photo. */
  PROFILE_IMAGE: 'me/profile/image',
  /** `PUT { dailySteps, fromHealthIntegration }` – the step sync's steps (spec 2.6). */
  ACTIVITY: 'me/profile/activity',
  GOALS: 'me/goals',
  CURRENT_GOAL: 'me/goals/current',
  RECALCULATE_GOAL: 'me/goals/recalculate',
  SETTINGS: 'me/settings',
  NOTIFICATIONS_SETTING: 'me/settings/Notifications',
  LATEST_WEIGHT: 'me/weight-logs/latest',
} as const;

/** The API's `SettingKey` behind the profile's "Notifikationer" switch. */
export const NOTIFICATIONS_SETTING_KEY = 'Notifications';
