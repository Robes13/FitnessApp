import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { REMINDER_DEFINITIONS, REMINDER_IDS } from '../../../../core/constants/reminders';
import {
  ReminderId,
  ReminderSetting,
  ReminderSettings,
  WeekdayIndex,
} from '../../../../core/models/reminder';
import { ReminderService } from '../../../../core/services/reminders/reminders';
import { formatClockTime, parseClockTime } from '../../../../core/utils/clock-time';
import { DAY_NAME_LONG_KEYS, DAY_NAME_SHORT_KEYS } from '../../../../core/utils/date-format';
import { Translate, injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiSwitch } from '../../../../shared/components/ui-switch/ui-switch';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';

type TimeForm = FormGroup<Record<ReminderId, FormControl<string>>>;

/** What the notice's button does, if it has one. */
type ReminderNoticeAction = 'enable-master' | 'request-permission';

interface ReminderNotice {
  readonly textKey: string;
  readonly action: ReminderNoticeAction | null;
}

interface ReminderRow {
  readonly id: ReminderId;
  readonly label: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly allowsWeekday: boolean;
  /** The weekday chips with the chosen one selected; empty when the kind has no weekday. */
  readonly weekdayOptions: readonly WeekdayOptionView[];
  readonly switchLabel: string;
  readonly timeLabel: string;
  readonly timeControl: FormControl<string>;
}

interface WeekdayOption {
  readonly value: WeekdayIndex | null;
  readonly label: string;
}

interface WeekdayOptionView extends WeekdayOption {
  readonly selected: boolean;
}

const NOTICE_KEY = {
  UNSUPPORTED: 'profile.remindersSheet.noticeUnsupported',
  MASTER_OFF: 'profile.remindersSheet.noticeMasterOff',
  DENIED: 'profile.remindersSheet.noticeDenied',
  PROMPT: 'profile.remindersSheet.noticePrompt',
} as const;

const NOTICE_ACTION_LABEL_KEY: Readonly<Record<ReminderNoticeAction, string>> = {
  'enable-master': 'profile.remindersSheet.enableMaster',
  'request-permission': 'profile.remindersSheet.requestPermission',
};

const EVERY_DAY_LABEL_KEY = 'profile.remindersSheet.everyDay';
const WEEKDAY_INDEXES: readonly WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];
function weekdayOptions(t: Translate): readonly WeekdayOption[] {
  return [
    { value: null, label: t(EVERY_DAY_LABEL_KEY) },
    ...WEEKDAY_INDEXES.map((index) => ({ value: index, label: t(DAY_NAME_SHORT_KEYS[index]) })),
  ];
}

/**
 * "Påmindelser": one switch per reminder kind (breakfast, lunch, dinner, weigh-in and the
 * evening food log). An enabled reminder shows its time – and, for the weigh-in, a choice of
 * every day or one weekday. Every change is saved at once through `ReminderService`, which
 * reschedules the notifications; there is no save button.
 *
 * The switches are locked while the profile's "Notifikationer" master switch is off or the
 * phone has denied notifications, and a notice explains why. In the browser the settings can
 * still be changed, with a note that reminders only arrive in the app.
 */
@Component({
  selector: 'app-profile-reminders-sheet',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    UiButton,
    UiChip,
    UiFormError,
    UiSheet,
    UiSwitch,
    UiTextInput,
  ],
  templateUrl: './profile-reminders-sheet.html',
  styleUrl: './profile-reminders-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileRemindersSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  private readonly reminders = inject(ReminderService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly timeForm: TimeForm = this.formBuilder.group(
    timeValues(this.reminders.settings()),
  );
  /** "Slå notifikationer til" is saving the master switch in the API. */
  protected readonly enablingMaster = signal(false);
  /** Why saving the master switch failed – a key, so it follows the language. */
  private readonly masterErrorKey = signal<string | null>(null);
  protected readonly error = computed(() => {
    const key = this.masterErrorKey();
    return key === null ? this.reminders.error() : this.t(key);
  });

  /** Switches can't be used: the master switch is off or the phone said no. */
  protected readonly locked = computed(
    () =>
      this.reminders.isSupported() &&
      (!this.reminders.masterEnabled() || this.reminders.permission() === 'denied'),
  );

  protected readonly notice = computed<ReminderNotice | null>(() => {
    if (!this.reminders.isSupported()) {
      return { textKey: NOTICE_KEY.UNSUPPORTED, action: null };
    }
    if (!this.reminders.masterEnabled()) {
      return { textKey: NOTICE_KEY.MASTER_OFF, action: 'enable-master' };
    }
    if (this.reminders.permission() === 'denied') {
      return { textKey: NOTICE_KEY.DENIED, action: null };
    }
    if (this.reminders.permission() === 'prompt' && this.reminders.enabledCount() > 0) {
      return { textKey: NOTICE_KEY.PROMPT, action: 'request-permission' };
    }
    return null;
  });
  protected readonly noticeActionLabelKey = computed(() => {
    const action = this.notice()?.action;
    return action ? NOTICE_ACTION_LABEL_KEY[action] : null;
  });

  protected readonly rows = computed<readonly ReminderRow[]>(() => {
    const settings = this.reminders.settings();
    const options = weekdayOptions(this.t);
    return REMINDER_DEFINITIONS.map((definition) => {
      const setting = settings[definition.id];
      const weekday = definition.allowsWeekday ? setting.weekday : null;
      const label = this.t(definition.labelKey);
      return {
        id: definition.id,
        label,
        summary: summaryFor(this.t, setting.time, weekday),
        enabled: setting.enabled,
        allowsWeekday: definition.allowsWeekday,
        weekdayOptions: definition.allowsWeekday
          ? options.map((option) => ({ ...option, selected: option.value === weekday }))
          : [],
        switchLabel: this.t('profile.remindersSheet.switchLabel', {
          reminder: label.toLowerCase(),
        }),
        timeLabel: this.t('profile.remindersSheet.timeLabel', { reminder: label.toLowerCase() }),
        timeControl: this.timeForm.controls[definition.id],
      };
    });
  });

  constructor() {
    for (const id of REMINDER_IDS) {
      this.timeForm.controls[id].valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe((value) => this.onTimeChange(id, value));
    }

    // Start from the saved times each time the sheet opens.
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.timeForm.setValue(timeValues(this.reminders.settings()), { emitEvent: false });
          this.masterErrorKey.set(null);
        });
      }
    });

    effect(() => {
      if (this.locked()) {
        this.timeForm.disable({ emitEvent: false });
      } else {
        this.timeForm.enable({ emitEvent: false });
      }
    });
  }

  protected setEnabled(id: ReminderId, enabled: boolean): void {
    this.reminders.update(id, { enabled });
  }

  protected setWeekday(id: ReminderId, weekday: WeekdayIndex | null): void {
    this.reminders.update(id, { weekday });
  }

  protected runNoticeAction(): void {
    switch (this.notice()?.action) {
      case 'enable-master':
        this.enableMaster();
        break;
      case 'request-permission':
        void this.reminders.requestPermission();
        break;
      default:
        break;
    }
  }

  /** Pessimistic, like the profile's switch: the notice stays until the API has saved it. */
  private enableMaster(): void {
    if (this.enablingMaster()) {
      return;
    }
    this.enablingMaster.set(true);
    this.masterErrorKey.set(null);
    this.reminders
      .setMasterEnabled(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.enablingMaster.set(false),
        error: (error: unknown) => {
          this.enablingMaster.set(false);
          this.masterErrorKey.set(toApiError(error).messageKey);
        },
      });
  }

  /** An empty or half-typed time is ignored – the last valid time stays saved. */
  private onTimeChange(id: ReminderId, value: string): void {
    const time = parseClockTime(value);
    if (time) {
      this.reminders.update(id, { time });
    }
  }
}

function timeValues(settings: ReminderSettings): Record<ReminderId, string> {
  return {
    morgen: formatClockTime(settings.morgen.time),
    frokost: formatClockTime(settings.frokost.time),
    aften: formatClockTime(settings.aften.time),
    'weigh-in': formatClockTime(settings['weigh-in'].time),
    'daily-log': formatClockTime(settings['daily-log'].time),
  };
}

/** `'Hver dag kl. 21:00'` or `'Mandag kl. 07:30'`. */
function summaryFor(
  t: Translate,
  time: ReminderSetting['time'],
  weekday: WeekdayIndex | null,
): string {
  const day = t(weekday === null ? EVERY_DAY_LABEL_KEY : DAY_NAME_LONG_KEYS[weekday]);
  return t('profile.remindersSheet.summary', { day, time: formatClockTime(time) });
}
