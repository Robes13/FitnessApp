import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';

/** Lagorden: `sheet` 20 · `sheet-high` 25 · `overlay` 30 · `top` 40 (`--z-index-*`). */
export type SheetLayer = 'sheet' | 'sheet-high' | 'overlay' | 'top';
/**
 * `auto` = op til 78 % af skærmen, `medium` = 88 %, `tall` = 96 %,
 * `full` = næsten hele skærmen (100 % − 24 px).
 */
export type SheetMaxHeight = 'auto' | 'medium' | 'tall' | 'full';
/** Overskriftens størrelse: `sm` 26 · `md` 28 · `lg` 30 px (`--font-size-display-sm/md/lg`). */
export type SheetTitleSize = 'sm' | 'md' | 'lg';
/** Farven på `titleAccent`: orange (standard) eller rød – designets "Log <rød>ud?</rød>". */
export type SheetTitleAccentTone = 'accent' | 'negative';

const DEFAULT_CLOSE_LABEL = 'Luk';

/**
 * Åbne ark i den rækkefølge, de blev åbnet. Kun det øverste reagerer på Escape, så
 * stablede ark (fx "Ny samling" med en indlejret vare-søgning) lukker ét ad gangen.
 */
const openSheets: UiSheet[] = [];

function registerOpen(sheet: UiSheet): void {
  if (!openSheets.includes(sheet)) {
    openSheets.push(sheet);
  }
}

function unregister(sheet: UiSheet): void {
  const index = openSheets.indexOf(sheet);
  if (index >= 0) {
    openSheets.splice(index, 1);
  }
}

function isTopmost(sheet: UiSheet): boolean {
  return openSheets.at(-1) === sheet;
}

/**
 * Bundark: dæmpet, sløret scrim over hele app-roden med et panel nederst (designets
 * `var(--sheet)`-ark med 28 px radius). Arket lukker ved klik på scrimmen, på
 * luk-knappen eller med Escape – alle tre udsender `closed`; forælderen ejer `open`.
 *
 * `hideClose` gør arket ikke-afviseligt (ingen luk-knap, scrim og Escape ignoreres) –
 * bruges til "Tjek din mail", som brugeren ikke må lukke.
 *
 * Titlen sammensættes af `title` + `titleAccent` (orange eller rød, med eller uden mellemrum) i
 * tre størrelser, så alle designets ark kan udtrykkes med inputs alene.
 *
 * Slots: standardindhold, `[sheetLeading]` (over overskriften – designets ikon-cirkel og
 * log-ud-mærke), `[sheetTitle]` (eget indhold i titlens plads, når `title` og `titleAccent`
 * er tomme – fx en badge), `[sheetHeaderExtra]` (til højre for titlen, før luk-knappen) og
 * `[sheetFooter]`.
 */
@Component({
  selector: 'app-ui-sheet',
  imports: [UiIcon, UiIconButton],
  templateUrl: './ui-sheet.html',
  styleUrl: './ui-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-sheet',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class UiSheet {
  readonly open = input.required<boolean>();
  readonly title = input('');
  /** Vises orange efter `title`, fx title `Ny` + titleAccent `samling`. */
  readonly titleAccent = input('');
  /** Designet varierer: "Log ud?" 26 (`sm`), "Tilføj mad" 28 (`md`), "Tjek din mail" 30 (`lg`). */
  readonly titleSize = input<SheetTitleSize>('sm');
  readonly titleAccentTone = input<SheetTitleAccentTone>('accent');
  /** Ingen mellemrum mellem `title` og `titleAccent`: "Profil" + "billede" → "Profilbillede". */
  readonly titleAccentJoined = input(false, { transform: booleanAttribute });
  readonly closeLabel = input(DEFAULT_CLOSE_LABEL);
  /** Skjuler luk-knappen og slår luk via scrim og Escape fra. */
  readonly hideClose = input(false, { transform: booleanAttribute });
  readonly layer = input<SheetLayer>('sheet');
  readonly maxHeight = input<SheetMaxHeight>('auto');
  /** Lader indholdet scrolle inden i panelet i stedet for at vokse ud af det. */
  readonly scrollable = input(false, { transform: booleanAttribute });
  /**
   * Gør indholdsområdet til en flex-kolonne, så indholdet selv kan holde en fast top og
   * kun lade en del af sig scrolle. Kombineres typisk med et barn, der har `scroll-area`.
   */
  readonly column = input(false, { transform: booleanAttribute });

  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly dismissible = computed(() => !this.hideClose());
  protected readonly hasTitle = computed(() => this.title() !== '' || this.titleAccent() !== '');
  protected readonly hasHeader = computed(() => this.hasTitle() || this.dismissible());
  protected readonly panelHeightClass = computed(() => `ui-sheet__panel--${this.maxHeight()}`);
  protected readonly scrimClass = computed(() => `ui-sheet__scrim--${this.layer()}`);
  protected readonly titleSizeClass = computed(() => `ui-sheet__title--${this.titleSize()}`);
  protected readonly isNegativeAccent = computed(() => this.titleAccentTone() === 'negative');
  protected readonly ariaLabel = computed<string | null>(() => {
    const parts = [this.title(), this.titleAccent()].filter((part) => part !== '');
    return parts.length > 0 ? parts.join(this.titleAccentJoined() ? '' : ' ') : null;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        registerOpen(this);
      } else {
        unregister(this);
      }
    });
    inject(DestroyRef).onDestroy(() => unregister(this));

    // Flyt fokus ind i panelet, når det åbner, medmindre indholdet selv har taget fokus.
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement;
      if (panel && !panel.contains(this.document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });
  }

  protected onScrimClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }

  protected onEscape(event: Event): void {
    if (!this.open() || !isTopmost(this)) {
      return;
    }
    event.preventDefault();
    this.requestClose();
  }

  protected requestClose(): void {
    if (this.dismissible()) {
      this.closed.emit();
    }
  }
}
