import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEMO_PROFILE_DEFAULTS } from '../../../../core/constants/demo-data';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { WeightLogService } from '../../../../core/services/weight-log';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { WeightPage } from './weight-page';

/**
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Storage seedes før hver test.
 */
describe('WeightPage', () => {
  let fixture: ComponentFixture<WeightPage>;

  async function setup(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: provideComponentTestEnvironment(),
    });
    fixture = TestBed.createComponent(WeightPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    resetComponentTestStorage({
      [STORAGE_KEY.PROFILE]: { ...DEMO_PROFILE_DEFAULTS, goal: 'tabe' },
    });
  });

  it('viser overskrift, kladdevægt, nøgletal og hvornår der sidst er vejet', async () => {
    const root = await setup();

    expect(root.querySelector('.weight-page__title')?.textContent).toContain('Registrér');
    expect(root.querySelector('.weight-page__title-accent')?.textContent).toBe('vægt');
    expect(root.querySelector('.weight-page__last-weighed')?.textContent?.trim()).toBe(
      'Sidst vejet 3 dage siden',
    );
    expect(root.querySelector('.weight-page__draft-value')?.textContent?.trim()).toBe('75,0');
    expect(
      [...root.querySelectorAll('.weight-page__tile-label')].map((el) => el.textContent?.trim()),
    ).toEqual(['Siden sidst', 'Til mål']);
    expect(root.querySelector('app-weight-scale-scene')).not.toBeNull();
    expect(root.querySelector('app-ui-ruler')).not.toBeNull();
  });

  it('skruer på kladden med −/+ knapperne', async () => {
    const root = await setup();
    const plus = root.querySelector<HTMLButtonElement>('.weight-page__step--plus');
    const minus = root.querySelector<HTMLButtonElement>('.weight-page__step--minus');

    plus?.click();
    await fixture.whenStable();
    expect(root.querySelector('.weight-page__draft-value')?.textContent?.trim()).toBe('75,1');

    minus?.click();
    minus?.click();
    await fixture.whenStable();
    expect(root.querySelector('.weight-page__draft-value')?.textContent?.trim()).toBe('74,9');
    expect(root.querySelector('.weight-page__tile-value')?.textContent).toContain('−0,1');
  });

  it('gemmer vejningen og kvitterer med "Gemt ✓"', async () => {
    const root = await setup();
    const save = root.querySelector<HTMLButtonElement>('.weight-page__save');
    expect(save?.textContent?.trim()).toBe('Gem vejning');

    save?.click();
    await fixture.whenStable();

    expect(save?.textContent?.trim()).toBe('Gemt ✓');
    expect(TestBed.inject(WeightLogService).weighedToday()).toBe(true);
    expect(root.querySelector('.weight-log-list__date')?.textContent?.trim()).toBe('I dag');
  });

  it('rydder de kortlivede timere, når siden forlades', async () => {
    const root = await setup();
    vi.useFakeTimers();
    try {
      root.querySelector<HTMLButtonElement>('.weight-page__step--plus')?.click();
      root.querySelector<HTMLButtonElement>('.weight-page__save')?.click();
      const pending = vi.getTimerCount();
      expect(pending).toBeGreaterThanOrEqual(2);

      fixture.destroy();

      expect(vi.getTimerCount()).toBeLessThanOrEqual(pending - 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('har intervalchipsene under grafen og kan skifte periode', async () => {
    const root = await setup();
    const chart = root.querySelector('app-weight-chart');
    const chips = [...root.querySelectorAll<HTMLButtonElement>('.weight-page__range')];
    const blocks = [...(root.querySelector('.weight-page__scroll')?.children ?? [])];

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['1 uge', '4 uger', '3 mdr.']);
    expect(blocks.findIndex((el) => el.classList.contains('weight-page__ranges'))).toBeGreaterThan(
      blocks.findIndex((el) => el.classList.contains('weight-page__chart')),
    );
    expect(root.querySelector('.weight-chart__caption')?.textContent?.trim()).toBe('Vægt');
    expect(chart?.textContent).toContain('Sidste 4 uger');

    chips[2]?.click();
    await fixture.whenStable();

    expect(chart?.textContent).toContain('Sidste 3 mdr.');
    expect(chart?.textContent).toContain('– mål 70 kg');
  });

  it('viser de seneste vejninger med forskel og enhed', async () => {
    const root = await setup();

    expect(root.querySelector('.weight-log-list__title')?.textContent?.trim()).toBe(
      'Seneste vejninger',
    );
    expect(
      [...root.querySelectorAll('.weight-log-list__delta')].map((el) => el.textContent?.trim()),
    ).toEqual(['−0,6', '−0,5', 'Start']);
  });
});
