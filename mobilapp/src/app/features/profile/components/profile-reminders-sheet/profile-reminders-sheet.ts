import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { REMINDER_DEFINITIONS, REMINDER_IDS } from '../../../../core/constants/reminders';
import {
  ReminderId,
  ReminderSetting,
  ReminderSettings,
  WeekdayIndex,
} from '../../../../core/models/reminder';
import { ReminderService } from '../../../../core/services/reminders';
import { formatClockTime, parseClockTime } from '../../../../core/utils/clock-time';
import { DAY_NAMES_LONG, DAY_NAMES_SHORT } from '../../../../core/utils/date-format';
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
  readonly text: string;
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

const NOTICE = {
  UNSUPPORTED:
    'Påmindelser virker kun i appen på din telefon. Dine valg bliver gemt, så de er klar dér.',
  MASTER_OFF: 'Notifikationer er slået fra. Slå dem til for at få dine påmindelser.',
  DENIED:
    'Appen har ikke lov til at sende notifikationer. Giv lov under appens notifikationer i ' +
    'telefonens indstillinger – så bliver dine påmindelser planlagt igen.',
  PROMPT: 'Appen skal have lov til at sende notifikationer, før dine påmindelser kan komme frem.',
} as const;

const NOTICE_ACTION_LABEL: Readonly<Record<ReminderNoticeAction, string>> = {
  'enable-master': 'Slå notifikationer til',
  'request-permission': 'Tillad notifikationer',
};

const EVERY_DAY_LABEL = 'Hver dag';
const WEEKDAY_INDEXES: readonly WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_OPTIONS: readonly WeekdayOption[] = [
  { value: null, label: EVERY_DAY_LABEL },
  ...WEEKDAY_INDEXES.map((index) => ({ value: index, label: DAY_NAMES_SHORT[index] })),
];

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
  imports: [ReactiveFormsModule, UiButton, UiChip, UiFormError, UiSheet, UiSwitch, UiTextInput],
  templateUrl: './profile-reminders-sheet.html',
  styleUrl: './profile-reminders-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileRemindersSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  private readonly reminders = inject(ReminderService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly timeForm: TimeForm = this.formBuilder.group(
    timeValues(this.reminders.settings()),
  );
  protected readonly error = this.reminders.error;

  /** Switches can't be used: the master switch is off or the phone said no. */
  protected readonly locked = computed(
    () =>
      this.reminders.isSupported() &&
      (!this.reminders.masterEnabled() || this.reminders.permission() === 'denied'),
  );

  protected readonly notice = computed<ReminderNotice | null>(() => {
    if (!this.reminders.isSupported()) {
      return { text: NOTICE.UNSUPPORTED, action: null };
    }
    if (!this.reminders.masterEnabled()) {
      return { text: NOTICE.MASTER_OFF, action: 'enable-master' };
    }
    if (this.reminders.permission() === 'denied') {
      return { text: NOTICE.DENIED, action: null };
    }
    if (this.reminders.permission() === 'prompt' && this.reminders.enabledCount() > 0) {
      return { text: NOTICE.PROMPT, action: 'request-permission' };
    }
    return null;
  });
  protected readonly noticeActionLabel = computed(() => {
    const action = this.notice()?.action;
    return action ? NOTICE_ACTION_LABEL[action] : null;
  });

  protected readonly rows = computed<readonly ReminderRow[]>(() => {
    const settings = this.reminders.settings();
    return REMINDER_DEFINITIONS.map((definition) => {
      const setting = settings[definition.id];
      const weekday = definition.allowsWeekday ? setting.weekday : null;
      return {
        id: definition.id,
        label: definition.label,
        summary: summaryFor(setting.time, weekday),
        enabled: setting.enabled,
        allowsWeekday: definition.allowsWeekday,
        weekdayOptions: definition.allowsWeekday
          ? WEEKDAY_OPTIONS.map((option) => ({ ...option, selected: option.value === weekday }))
          : [],
        switchLabel: `Påmindelse om ${definition.label.toLowerCase()}`,
        timeLabel: `Tidspunkt for ${definition.label.toLowerCase()}`,
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
        untracked(() =>
          this.timeForm.setValue(timeValues(this.reminders.settings()), { emitEvent: false }),
        );
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
        this.reminders.setMasterEnabled(true);
        break;
      case 'request-permission':
        void this.reminders.requestPermission();
        break;
      default:
        break;
    }
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
function summaryFor(time: ReminderSetting['time'], weekday: WeekdayIndex | null): string {
  const day = weekday === null ? EVERY_DAY_LABEL : DAY_NAMES_LONG[weekday];
  return `${day} kl. ${formatClockTime(time)}`;
}
