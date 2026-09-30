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
import { injectTranslate } from '../../../core/services/language/translate';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';

/** Layer order: `sheet` 20 · `sheet-high` 25 · `overlay` 30 · `top` 40 (`--z-index-*`). */
export type SheetLayer = 'sheet' | 'sheet-high' | 'overlay' | 'top';
/**
 * `auto` = up to 78% of the screen, `medium` = 88%, `tall` = 96%,
 * `full` = nearly the whole screen (100% − 24 px).
 */
export type SheetMaxHeight = 'auto' | 'medium' | 'tall' | 'full';
/** The heading's size: `sm` 26 · `md` 28 · `lg` 30 px (`--font-size-display-sm/md/lg`). */
export type SheetTitleSize = 'sm' | 'md' | 'lg';
/** The color of `titleAccent`: orange (default) or red – the design's "Log <red>out?</red>". */
export type SheetTitleAccentTone = 'accent' | 'negative';

/**
 * The elements in the panel that Tab is allowed to land on. Used to keep focus inside the open
 * sheet – and by `BarcodeScanner`, whose fullscreen overlay has the same need.
 */
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Open sheets in the order they were opened. Only the topmost reacts to Escape, so
 * stacked sheets (e.g. "New collection" with a nested item search) close one at a time.
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
 * Bottom sheet: a dimmed, blurred scrim over the whole app root with a panel at the bottom
 * (the design's `var(--sheet)` sheet with 28 px radius). The sheet closes on clicking the
 * scrim, the close button or Escape – all three emit `closed`; the parent owns `open`.
 *
 * `hideClose` makes the sheet non-dismissible (no close button, scrim and Escape are ignored) –
 * used for "Check your email", which the user must not be able to close.
 *
 * The title is composed of `title` + `titleAccent` (orange or red, with or without a space) in
 * three sizes, so all of the design's sheets can be expressed with inputs alone.
 *
 * Slots: default content, `[sheetLeading]` (above the heading – the design's icon circle and
 * log-out badge), `[sheetTitle]` (custom content in the title's spot, when `title` and
 * `titleAccent` are empty – e.g. a badge), `[sheetHeaderExtra]` (to the right of the title,
 * before the close button) and `[sheetFooter]`.
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
    '(document:keydown.tab)': 'onTab($event, false)',
    '(document:keydown.shift.tab)': 'onTab($event, true)',
  },
})
export class UiSheet {
  readonly open = input.required<boolean>();
  readonly title = input('');
  /** Shown in orange after `title`, e.g. title `New` + titleAccent `collection`. */
  readonly titleAccent = input('');
  /** The design varies: "Log out?" 26 (`sm`), "Add food" 28 (`md`), "Check your email" 30 (`lg`). */
  readonly titleSize = input<SheetTitleSize>('sm');
  readonly titleAccentTone = input<SheetTitleAccentTone>('accent');
  /** No space between `title` and `titleAccent`: "Profile" + "picture" → "Profilepicture". */
  readonly titleAccentJoined = input(false, { transform: booleanAttribute });
  readonly closeLabel = input<string>();
  /** Hides the close button and disables closing via the scrim and Escape. */
  readonly hideClose = input(false, { transform: booleanAttribute });
  readonly layer = input<SheetLayer>('sheet');
  readonly maxHeight = input<SheetMaxHeight>('auto');
  /** Lets the content scroll inside the panel instead of growing out of it. */
  readonly scrollable = input(false, { transform: booleanAttribute });
  /**
   * Makes the content area a flex column, so the content can keep a fixed top and let
   * only part of itself scroll. Typically combined with a child that has `scroll-area`.
   */
  readonly column = input(false, { transform: booleanAttribute });

  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly t = injectTranslate();
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** The element that had focus when the sheet opened – focus is returned there on close. */
  private previouslyFocused: HTMLElement | null = null;

  protected readonly closeLabelText = computed(() => this.closeLabel() ?? this.t('common.close'));
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
        this.restoreFocus();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      unregister(this);
      this.restoreFocus();
    });

    // Move focus into the panel when it opens, unless the content has already taken focus.
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement;
      if (panel && !panel.contains(this.document.activeElement)) {
        this.rememberTrigger();
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

  /**
   * Keeps Tab inside the panel, so an `aria-modal` sheet can't be tabbed away from. Only the
   * topmost sheet captures the key, so stacked sheets behave like they do with Escape. The
   * direction comes from the host binding (`keydown.tab` / `keydown.shift.tab`), since `$event`
   * here is only typed as `Event`.
   */
  protected onTab(event: Event, backwards: boolean): void {
    if (!this.open() || !isTopmost(this)) {
      return;
    }
    const panel = this.panel()?.nativeElement;
    if (!panel) {
      return;
    }
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }
    const active = this.document.activeElement;
    if (!panel.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (backwards && (active === first || active === panel)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }
    if (!backwards && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  protected requestClose(): void {
    if (this.dismissible()) {
      this.closed.emit();
    }
  }

  /** Remembers the element that opened the sheet – only the first time the sheet takes focus. */
  private rememberTrigger(): void {
    if (this.previouslyFocused === null) {
      const active = this.document.activeElement;
      this.previouslyFocused = active instanceof HTMLElement ? active : null;
    }
  }

  /** Returns focus to the remembered element. Does nothing if the sheet never took focus. */
  private restoreFocus(): void {
    this.previouslyFocused?.focus({ preventScroll: true });
    this.previouslyFocused = null;
  }
}
