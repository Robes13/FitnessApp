import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';

export type TextInputType = 'text' | 'password' | 'email' | 'number' | 'time' | 'date';
export type TextInputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search' | 'url';
/** 52 / 48 px – `--size-control-lg` / `-md`. */
export type TextInputSize = 'lg' | 'md';
/**
 * The value in the form. Text fields always give a `string`; `type="number"` gives a number
 * or `null` when the field is empty – like Angular's built-in number accessor.
 */
export type TextInputValue = string | number | null;
/**
 * The border color in the error state. `negative` (red) is the default; `accent` (orange) is
 * used where the design marks a soft mismatch rather than an error – e.g. mismatched passwords.
 */
export type TextInputInvalidTone = 'negative' | 'accent';

/** From the design (login, line 101). The reveal button only toggles `aria-pressed`, not its label. */
const REVEAL_ICON: Readonly<Record<'hidden' | 'shown', IconName>> = {
  hidden: 'eye',
  shown: 'eye-off',
};

/**
 * Fields whose text must be kept exactly as typed. iOS would otherwise capitalize the first
 * letter ("testbruger" → "Testbruger") and autocorrect names and addresses.
 */
const VERBATIM_AUTOCOMPLETE: ReadonlySet<string> = new Set([
  'username',
  'email',
  'current-password',
  'new-password',
  'one-time-code',
]);
const VERBATIM_TYPES: ReadonlySet<TextInputType> = new Set(['email', 'password']);

/**
 * The design's `.glass-input`: glass fill, hairline, 14 px radius and an orange focus ring.
 * Implements `ControlValueAccessor`, so it's used with `formControl`/`formControlName`.
 *
 * Password fields have a built-in eye that shows/hides the password (`revealable`).
 */
@Component({
  selector: 'app-ui-text-input',
  imports: [UiIcon, TranslatePipe],
  templateUrl: './ui-text-input.html',
  styleUrl: './ui-text-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTextInput), multi: true },
  ],
  host: {
    '[class]': 'hostClasses()',
    '[class.ui-text-input--invalid]': 'invalid()',
    '[class.ui-text-input--translucent]': 'translucent()',
    '[class.ui-text-input--centered]': 'centered()',
    '[class.ui-text-input--revealable]': 'hasRevealToggle()',
    '[class.ui-text-input--disabled]': 'disabled()',
  },
})
export class UiTextInput implements ControlValueAccessor {
  readonly type = input<TextInputType>('text');
  readonly placeholder = input('');
  readonly inputMode = input<TextInputMode | null>(null);
  readonly maxLength = input<number | null>(null);
  /** Native `min`/`max`, e.g. `'YYYY-MM-DD'` bounds for the date picker. */
  readonly min = input<string | null>(null);
  readonly max = input<string | null>(null);
  readonly autocomplete = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Error state: colored border. The text is shown separately with `app-ui-form-error`. */
  readonly invalid = input(false, { transform: booleanAttribute });
  /** The border color when `invalid` is set. */
  readonly invalidTone = input<TextInputInvalidTone>('negative');
  /** Dark, semi-transparent background for fields on top of photos (forgot password). */
  readonly translucent = input(false, { transform: booleanAttribute });
  /** Code field: centered, display font and wide letter spacing. */
  readonly centered = input(false, { transform: booleanAttribute });
  /** Show/hide button on password fields. */
  readonly revealable = input(true, { transform: booleanAttribute });
  readonly size = input<TextInputSize>('lg');

  /** The field has lost focus (after `onTouched` has been called). */
  readonly blurred = output<void>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly revealed = signal(false);

  protected readonly hasRevealToggle = computed(
    () => this.type() === 'password' && this.revealable(),
  );
  protected readonly nativeType = computed(() =>
    this.hasRevealToggle() && this.revealed() ? 'text' : this.type(),
  );
  /** Usernames, e-mails, passwords and codes: no auto-capitalization, autocorrect or spellcheck. */
  protected readonly verbatim = computed(
    () => VERBATIM_TYPES.has(this.type()) || VERBATIM_AUTOCOMPLETE.has(this.autocomplete() ?? ''),
  );
  protected readonly revealIcon = computed(() =>
    this.revealed() ? REVEAL_ICON.shown : REVEAL_ICON.hidden,
  );
  protected readonly hostClasses = computed(
    () =>
      `ui-text-input ui-text-input--${this.size()} ui-text-input--invalid-${this.invalidTone()}`,
  );

  private onChange: (value: TextInputValue) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: TextInputValue | undefined): void {
    this.value.set(value == null ? '' : String(value));
  }

  registerOnChange(fn: (value: TextInputValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(rawValue: string): void {
    this.value.set(rawValue);
    this.onChange(this.toFormValue(rawValue));
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }

  protected toggleReveal(): void {
    this.revealed.update((shown) => !shown);
  }

  private toFormValue(rawValue: string): TextInputValue {
    if (this.type() !== 'number') {
      return rawValue;
    }
    return rawValue === '' ? null : Number.parseFloat(rawValue);
  }
}
