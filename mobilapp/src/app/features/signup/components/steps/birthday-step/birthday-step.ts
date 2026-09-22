import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAX_AGE, MIN_AGE } from '../../../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator';
import { MONTH_NAMES_LONG, startOfDay } from '../../../../../core/utils/date-format';
import { NOW } from '../../../../../core/utils/now';
import { bandToneForGender } from '../../../../../shared/components/figure';
import { SignupStateService } from '../../../services/signup-state';
import { BirthdayCake } from './birthday-cake/birthday-cake';
import {
  CALENDAR_DEFAULT_MONTH,
  CALENDAR_DEFAULT_YEAR,
  CALENDAR_MIN_YEAR,
  CALENDAR_WEEKDAYS,
  CalendarCell,
  buildCalendarCells,
  shiftCalendar,
} from './calendar-grid';
import { clamp } from '../../../../../core/utils/math';

const YEAR_LENGTH = 4;
const ISO_YEAR_END = 4;
const ISO_MONTH_START = 5;
const ISO_MONTH_END = 7;
const ISO_DAY_START = 8;

/** The design's `ageHint`. */
const HINT_NO_DATE = 'Vælg din fødselsdato ovenfor.';
const HINT_TOO_YOUNG = 'Du skal være mindst 16 år for at bruge Nutrify.';
const HINT_TOO_OLD = 'Tjek datoen igen.';
const LABEL_NO_DATE = 'Ingen dato valgt endnu';
const AGE_PLACEHOLDER = '–';

/**
 * Step 2 (`sAlder`): the birthday is picked in a month calendar with year and
 * month buttons. The age is shown large and used in the BMR calculation, and
 * `app-birthday-cake` reacts to it with hat, flames and cake tiers.
 *
 * The calendar view (year/month) is local step state; only the date itself is
 * written to `SignupStateService`.
 */
@Component({
  selector: 'app-birthday-step',
  imports: [BirthdayCake, ReactiveFormsModule],
  templateUrl: './birthday-step.html',
  styleUrl: './birthday-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'birthday-step' },
})
export class BirthdayStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);

  protected readonly state = inject(SignupStateService);
  protected readonly weekdays = CALENDAR_WEEKDAYS;

  /** The year while the user is typing – only becomes a display value at four digits. */
  private readonly yearDraft = signal<string | null>(null);
  private readonly yearOverride = signal<number | null>(null);
  private readonly monthOverride = signal<number | null>(null);

  protected readonly yearControl = new FormControl('', { nonNullable: true });

  protected readonly today = computed(() => startOfDay(this.now()));
  private readonly birthdayIso = computed(() => this.state.birthday() ?? '');

  protected readonly year = computed(() => {
    const override = this.yearOverride();
    if (override !== null) {
      return override;
    }
    const iso = this.birthdayIso();
    return iso ? Number(iso.slice(0, ISO_YEAR_END)) : CALENDAR_DEFAULT_YEAR;
  });

  protected readonly month = computed(() => {
    const override = this.monthOverride();
    if (override !== null) {
      return override;
    }
    const iso = this.birthdayIso();
    return iso ? Number(iso.slice(ISO_MONTH_START, ISO_MONTH_END)) - 1 : CALENDAR_DEFAULT_MONTH;
  });

  protected readonly monthName = computed(() => MONTH_NAMES_LONG[this.month()]);
  protected readonly yearText = computed(() => this.yearDraft() ?? String(this.year()));

  protected readonly cells = computed(() =>
    buildCalendarCells(this.year(), this.month(), this.birthdayIso(), this.today()),
  );

  protected readonly age = computed(() =>
    this.calculator.ageFromBirthday(this.state.birthday(), this.now()),
  );
  protected readonly ageText = computed(() =>
    this.age() > 0 ? String(this.age()) : AGE_PLACEHOLDER,
  );

  protected readonly ageHint = computed(() => {
    if (!this.birthdayIso()) {
      return HINT_NO_DATE;
    }
    const age = this.age();
    if (age < MIN_AGE) {
      return HINT_TOO_YOUNG;
    }
    return age > MAX_AGE ? HINT_TOO_OLD : '';
  });

  /** The design's `birthdayLabel`: `Valgt: 16. maj 1998` or `Ingen dato valgt endnu`. */
  protected readonly birthdayLabel = computed(() => {
    const iso = this.birthdayIso();
    if (!iso) {
      return LABEL_NO_DATE;
    }
    const day = Number(iso.slice(ISO_DAY_START));
    const monthName = MONTH_NAMES_LONG[Number(iso.slice(ISO_MONTH_START, ISO_MONTH_END)) - 1];
    return `Valgt: ${day}. ${monthName} ${iso.slice(0, ISO_YEAR_END)}`;
  });

  protected readonly hasBirthday = computed(() => this.birthdayIso().length > 0);
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  constructor() {
    effect(() => {
      const text = this.yearText();
      if (this.yearControl.value !== text) {
        this.yearControl.setValue(text, { emitEvent: false });
      }
    });
    this.yearControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((raw) => this.onYearInput(raw));
  }

  protected shift(deltaYears: number, deltaMonths: number): void {
    const next = shiftCalendar(this.year(), this.month(), deltaYears, deltaMonths, this.today());
    this.yearOverride.set(next.year);
    this.monthOverride.set(next.month);
    this.yearDraft.set(null);
  }

  protected pick(cell: CalendarCell): void {
    if (cell.future) {
      return;
    }
    this.state.birthday.set(cell.iso);
    this.yearOverride.set(cell.year);
    this.monthOverride.set(cell.month);
    this.yearDraft.set(null);
  }

  protected onYearBlur(): void {
    this.yearDraft.set(null);
  }

  /** Digits only, at most four. At four digits the year is clamped and the view follows. */
  private onYearInput(raw: string): void {
    const digits = raw.replace(/\D/g, '').slice(0, YEAR_LENGTH);
    if (digits.length < YEAR_LENGTH) {
      this.yearDraft.set(digits);
      return;
    }
    const today = this.today();
    const year = clamp(Number(digits), CALENDAR_MIN_YEAR, today.getFullYear());
    this.yearDraft.set(null);
    this.yearOverride.set(year);
    if (new Date(year, this.month(), 1) > today) {
      this.monthOverride.set(today.getMonth());
    }
  }
}
