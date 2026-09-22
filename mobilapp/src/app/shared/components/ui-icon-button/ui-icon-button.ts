import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 56 / 52 / 48 / 44 / 40 / 36 / 28 / 26 px – `--size-control-xl` … `-4xs`. */
export type UiIconButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | '2xs' | '3xs' | '4xs';
/** `ghost` er helt gennemsigtig (designets lille genlog-knap i historikken). */
export type UiIconButtonTone =
  'neutral' | 'ghost' | 'accent' | 'translucent' | 'outline' | 'danger-soft';

/**
 * Designets runde `.circ`-knap. Bruges som attribut på et native `<button>` med et
 * `<app-ui-icon>` som indhold. Knappen er ikon-only, så den **skal** have `aria-label`.
 */
@Component({
  selector: 'button[app-ui-icon-button]',
  templateUrl: './ui-icon-button.html',
  styleUrl: './ui-icon-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
  },
})
export class UiIconButton {
  readonly size = input<UiIconButtonSize>('xl');
  readonly tone = input<UiIconButtonTone>('neutral');

  protected readonly hostClasses = computed(
    () => `ui-icon-button ui-icon-button--${this.size()} ui-icon-button--${this.tone()}`,
  );
}
