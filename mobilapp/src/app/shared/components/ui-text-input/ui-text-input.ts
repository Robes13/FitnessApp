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
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';

export type TextInputType = 'text' | 'password' | 'email' | 'number';
export type TextInputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search' | 'url';
/** 52 / 48 px – `--size-control-lg` / `-md`. */
export type TextInputSize = 'lg' | 'md';
/**
 * Værdien i formularen. Tekstfelter giver altid en `string`; `type="number"` giver et tal
 * eller `null`, når feltet er tomt – som Angulars indbyggede number-accessor.
 */
export type TextInputValue = string | number | null;
/**
 * Kantens farve i fejltilstand. `negative` (rød) er standard; `accent` (orange) bruges,
 * hvor designet markerer en blød uoverensstemmelse frem for en fejl – fx uens adgangskoder.
 */
export type TextInputInvalidTone = 'negative' | 'accent';

/** Fra designet (login, linje 101). Knappen skifter kun `aria-pressed`, ikke teksten. */
const REVEAL_LABEL = 'Vis adgangskode';
const REVEAL_ICON: Readonly<Record<'hidden' | 'shown', IconName>> = {
  hidden: 'eye',
  shown: 'eye-off',
};

/**
 * Designets `.glass-input`: glas-fyld, hairline, 14 px radius og orange fokusring.
 * Implementerer `ControlValueAccessor`, så den bruges med `formControl`/`formControlName`.
 *
 * Adgangskodefelter har et indbygget øje, der viser/skjuler koden (`revealable`).
 */
@Component({
  selector: 'app-ui-text-input',
  imports: [UiIcon],
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
  readonly autocomplete = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Fejltilstand: farvet kant. Teksten vises separat med `app-ui-form-error`. */
  readonly invalid = input(false, { transform: booleanAttribute });
  /** Kantens farve, når `invalid` er sat. */
  readonly invalidTone = input<TextInputInvalidTone>('negative');
  /** Mørk, halvgennemsigtig bund til felter oven på fotos (glemt adgangskode). */
  readonly translucent = input(false, { transform: booleanAttribute });
  /** Kodefelt: centreret, display-skrift og bred spatiering. */
  readonly centered = input(false, { transform: booleanAttribute });
  /** Vis/skjul-knap på adgangskodefelter. */
  readonly revealable = input(true, { transform: booleanAttribute });
  readonly size = input<TextInputSize>('lg');

  /** Feltet har mistet fokus (efter `onTouched` er kaldt). */
  readonly blurred = output<void>();

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly revealed = signal(false);
  protected readonly revealLabel = REVEAL_LABEL;

  protected readonly hasRevealToggle = computed(
    () => this.type() === 'password' && this.revealable(),
  );
  protected readonly nativeType = computed(() =>
    this.hasRevealToggle() && this.revealed() ? 'text' : this.type(),
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
