import {
  MealReminderId,
  ReminderDefinition,
  ReminderId,
  ReminderSettings,
} from '../models/reminder';
import { MEALS } from './meals';

function mealLabelKey(id: MealReminderId): string {
  return MEALS.find((meal) => meal.id === id)?.labelKey ?? id;
}

/**
 * The reminder kinds in the order the sheet shows them. Notification ids are fixed per
 * kind (1001–1005), so a reschedule replaces the existing notification on the device.
 */
export const REMINDER_DEFINITIONS: readonly ReminderDefinition[] = [
  {
    id: 'morgen',
    labelKey: mealLabelKey('morgen'),
    notificationId: 1001,
    titleKey: 'core.reminders.breakfast.title',
    bodyKey: 'core.reminders.breakfast.body',
    allowsWeekday: false,
    defaults: { enabled: false, time: { hour: 8, minute: 0 }, weekday: null },
  },
  {
    id: 'frokost',
    labelKey: mealLabelKey('frokost'),
    notificationId: 1002,
    titleKey: 'core.reminders.lunch.title',
    bodyKey: 'core.reminders.lunch.body',
    allowsWeekday: false,
    defaults: { enabled: false, time: { hour: 12, minute: 0 }, weekday: null },
  },
  {
    id: 'aften',
    labelKey: mealLabelKey('aften'),
    notificationId: 1003,
    titleKey: 'core.reminders.dinner.title',
    bodyKey: 'core.reminders.dinner.body',
    allowsWeekday: false,
    defaults: { enabled: false, time: { hour: 18, minute: 30 }, weekday: null },
  },
  {
    id: 'weigh-in',
    labelKey: 'core.reminders.weighIn.label',
    notificationId: 1004,
    titleKey: 'core.reminders.weighIn.title',
    bodyKey: 'core.reminders.weighIn.body',
    allowsWeekday: true,
    defaults: { enabled: false, time: { hour: 7, minute: 30 }, weekday: null },
  },
  {
    id: 'daily-log',
    labelKey: 'core.reminders.dailyLog.label',
    notificationId: 1005,
    titleKey: 'core.reminders.dailyLog.title',
    bodyKey: 'core.reminders.dailyLog.body',
    allowsWeekday: false,
    defaults: { enabled: true, time: { hour: 21, minute: 0 }, weekday: null },
  },
];

export const REMINDER_IDS: readonly ReminderId[] = REMINDER_DEFINITIONS.map(
  (definition) => definition.id,
);

/** Every notification id the app owns – all of them are cancelled before a reschedule. */
export const REMINDER_NOTIFICATION_IDS: readonly number[] = REMINDER_DEFINITIONS.map(
  (definition) => definition.notificationId,
);

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  morgen: definitionFor('morgen').defaults,
  frokost: definitionFor('frokost').defaults,
  aften: definitionFor('aften').defaults,
  'weigh-in': definitionFor('weigh-in').defaults,
  'daily-log': definitionFor('daily-log').defaults,
};

/** Translation keys of what the user sees when scheduling on the device fails. */
export const REMINDER_ERROR_KEY = {
  SCHEDULE: 'core.reminders.error.schedule',
  PERMISSION: 'core.reminders.error.permission',
} as const;

export function definitionFor(id: ReminderId): ReminderDefinition {
  const definition = REMINDER_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) {
    throw new Error(`Unknown reminder id "${id}".`);
  }
  return definition;
}
