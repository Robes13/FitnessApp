import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeightLogDto } from '../../../../core/models/weight';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../../core/services/weight-log/weight-log';
import {
  TEST_GOAL,
  flushTestWeighIns,
  weighHistory,
  weightLogDto,
} from '../../../../core/testing/fixtures';
import {
  TEST_NOW,
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { WeightPage } from './weight-page';

const LOGS_URL = '/api/v1/me/weight-logs';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`,
 * a frozen `NOW` and 0 ms mock delays. The weigh-ins come from the API (`HttpTestingController`).
 */
describe('WeightPage', () => {
  let fixture: ComponentFixture<WeightPage>;
  let http: HttpTestingController;

  async function setup(
    weighIns: readonly WeightLogDto[] = weighHistory(TEST_NOW),
  ): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: provideComponentTestEnvironment(),
    });
    http = TestBed.inject(HttpTestingController);
    flushTestWeighIns(weighIns);
    TestBed.inject(UserProfileService).update({ goal: 'tabe' });
    fixture = TestBed.createComponent(WeightPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function click(root: HTMLElement, selector: string): void {
    root.querySelector<HTMLButtonElement>(selector)?.click();
  }

  function flushGoal(): void {
    http.expectOne({ method: 'GET', url: '/api/v1/me/goals/current' }).flush(TEST_GOAL);
  }

  beforeEach(() => {
    resetComponentTestStorage();
  });

  afterEach(() => http.verify());

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

  it('viser startvægten fra registreringen uden vejninger', async () => {
    const root = await setup([]);
    TestBed.inject(UserProfileService).update({ weightKg: 81 });
    await fixture.whenStable();

    expect(root.querySelector('.weight-page__last-weighed')?.textContent?.trim()).toBe(
      'Startvægt fra registreringen',
    );
    expect(root.querySelector('.weight-page__draft-value')?.textContent?.trim()).toBe('81,0');
    expect(root.querySelector('app-weight-chart')?.textContent).toContain('81');
    expect(root.querySelector('app-weight-log-list')?.textContent).toContain(
      'Startvægten fra registreringen kan ikke rettes',
    );
  });

  it('viser en spinner under indlæsningen og "Prøv igen", når den fejler', async () => {
    TestBed.configureTestingModule({ providers: provideComponentTestEnvironment() });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(WeightLogService).load().subscribe();
    fixture = TestBed.createComponent(WeightPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-ui-spinner')).not.toBeNull();
    expect(root.querySelector('.weight-page__save')).toBeNull();

    http.expectOne(`${LOGS_URL}?limit=100`).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(root.querySelector('app-ui-empty-state')?.textContent).toContain(
      'Vejningerne kunne ikke hentes.',
    );
    expect(root.querySelector('.weight-page__last-weighed')).toBeNull();

    click(root, '.weight-page__status button');
    http
      .expectOne(`${LOGS_URL}?limit=100`)
      .flush({ items: weighHistory(TEST_NOW), nextCursor: null, hasMore: false });
    await fixture.whenStable();

    expect(root.querySelector('.weight-page__save')).not.toBeNull();
  });

  it('skruer på kladden med −/+ knapperne', async () => {
    const root = await setup();

    click(root, '.weight-ruler-input__step--plus');
    await fixture.whenStable();
    expect(root.querySelector('.weight-page__draft-value')?.textContent?.trim()).toBe('75,1');

    // Each click steps from the rendered value, so let change detection run in between.
    click(root, '.weight-ruler-input__step--minus');
    await fixture.whenStable();
    click(root, '.weight-ruler-input__step--minus');
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
    expect(save?.getAttribute('aria-busy')).toBe('true');
    http.expectOne({ method: 'POST', url: LOGS_URL }).flush(weightLogDto(9, 75, 0, TEST_NOW));
    flushGoal();
    await fixture.whenStable();

    expect(save?.textContent?.trim()).toBe('Gemt ✓');
    expect(TestBed.inject(WeightLogService).weighedToday()).toBe(true);
    expect(root.querySelector('.weight-log-list__date')?.textContent?.trim()).toBe('I dag');
  });

  it('spørger før dagens vejning overskrives – Annuller sender intet, Ja overskriver', async () => {
    const root = await setup();
    const conflict = { title: 'Conflict', status: 409, existingWeightLogId: 1 };

    click(root, '.weight-page__save');
    http
      .expectOne({ method: 'POST', url: LOGS_URL })
      .flush(conflict, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(root.querySelector('.weight-page__overwrite-body')?.textContent).toContain(
      'Vil du overskrive vejningen med 75,0 kg?',
    );
    click(root, '.weight-page__overwrite-cancel');
    await fixture.whenStable();
    expect(root.querySelector('.weight-page__overwrite-body')).toBeNull();

    click(root, '.weight-page__save');
    http
      .expectOne({ method: 'POST', url: LOGS_URL })
      .flush(conflict, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(root.querySelector('.weight-page__overwrite-confirm')?.textContent?.trim()).toBe(
      'Ja, overskriv',
    );

    click(root, '.weight-page__overwrite-confirm');
    http
      .expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` })
      .flush(weightLogDto(1, 75, 0, TEST_NOW));
    flushGoal();
    await fixture.whenStable();

    expect(root.querySelector('.weight-page__overwrite-body')).toBeNull();
    expect(root.querySelector('.weight-page__save')?.textContent?.trim()).toBe('Gemt ✓');
    expect(root.querySelector('.weight-log-list__date')?.textContent?.trim()).toBe('I dag');
  });

  it('viser en fejl under knappen, når vejningen ikke kan gemmes', async () => {
    const root = await setup();

    click(root, '.weight-page__save');
    http.expectOne({ method: 'POST', url: LOGS_URL }).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(root.querySelector('.weight-page__save-error')?.textContent?.trim()).toBe(
      'Vejningen blev ikke gemt. Prøv igen.',
    );
    expect(root.querySelector('.weight-page__save')?.textContent?.trim()).toBe('Gem vejning');
  });

  it('rydder de kortlivede timere, når siden forlades', async () => {
    const root = await setup();
    vi.useFakeTimers();
    try {
      click(root, '.weight-ruler-input__step--plus');
      click(root, '.weight-page__save');
      http.expectOne({ method: 'POST', url: LOGS_URL }).flush(weightLogDto(9, 75, 0, TEST_NOW));
      flushGoal();
      const pending = vi.getTimerCount();
      expect(pending).toBeGreaterThanOrEqual(2);

      fixture.destroy();

      expect(vi.getTimerCount()).toBeLessThanOrEqual(pending - 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gør vejningen færdig, selv om fanen forlades undervejs', async () => {
    const root = await setup();

    click(root, '.weight-page__save');
    fixture.destroy();
    http.expectOne({ method: 'POST', url: LOGS_URL }).flush(weightLogDto(9, 75, 0, TEST_NOW));
    flushGoal();

    expect(TestBed.inject(WeightLogService).weighedToday()).toBe(true);
  });

  it('har intervalchipsene under grafen og kan skifte periode', async () => {
    const root = await setup();
    const chart = root.querySelector('app-weight-chart');
    const chips = [...root.querySelectorAll<HTMLButtonElement>('.weight-page__range')];
    const blocks = [...(root.querySelector('.weight-page__scroll')?.children ?? [])];

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['1 uge', '3 uger', '3 mdr.']);
    expect(blocks.findIndex((el) => el.classList.contains('weight-page__ranges'))).toBeGreaterThan(
      blocks.findIndex((el) => el.classList.contains('weight-page__chart')),
    );
    expect(root.querySelector('.weight-chart__caption')?.textContent?.trim()).toBe('Vægt');
    expect(chart?.textContent).toContain('Sidste 3 uger');

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

  it('retter en vejning i arket og opdaterer listen og profilens vægt', async () => {
    const root = await setup();
    expect(root.querySelector('app-weight-edit-sheet .ui-sheet__panel')).toBeNull();

    click(root, '.weight-log-list__row');
    await fixture.whenStable();

    expect(root.querySelector('.weight-edit-sheet__when')?.textContent).toContain(
      '3 dage siden kl.',
    );
    expect(root.querySelector('.weight-edit-sheet__number')?.textContent?.trim()).toBe('75,0');

    click(root, '.weight-edit-sheet__ruler .weight-ruler-input__step--minus');
    await fixture.whenStable();
    expect(root.querySelector('.weight-edit-sheet__number')?.textContent?.trim()).toBe('74,9');

    click(root, '.weight-edit-sheet__save');
    const patch = http.expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` });
    expect(patch.request.body).toEqual({ weight: 74.9 });
    patch.flush(weightLogDto(1, 74.9, 3, TEST_NOW));
    flushGoal();
    await fixture.whenStable();

    expect(root.querySelector('.weight-edit-sheet__save')).toBeNull();
    expect(root.querySelector('.weight-log-list__kg')?.textContent).toContain('74,9');
    expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(74.9);
  });

  it('holder ret-arket åbent med en fejl, når rettelsen fejler', async () => {
    const root = await setup();
    click(root, '.weight-log-list__row');
    await fixture.whenStable();

    click(root, '.weight-edit-sheet__save');
    http
      .expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root.querySelector('.weight-edit-sheet__save')).not.toBeNull();
    expect(root.querySelector('.weight-edit-sheet__error')?.textContent?.trim()).toBe(
      'Serveren svarer ikke lige nu. Prøv igen om lidt.',
    );
  });

  it('sletter først en vejning, når sletningen er bekræftet', async () => {
    const root = await setup();
    click(root, '.weight-log-list__row');
    await fixture.whenStable();

    click(root, '.weight-edit-sheet__delete');
    await fixture.whenStable();

    // An older weigh-in is named by its date – "fra 3 dage siden" doesn't read.
    expect(root.querySelector('.weight-edit-sheet__confirm')?.textContent?.trim()).toBe(
      'Vil du slette vejningen fra 18. sep kl. 10:30? Det kan ikke fortrydes.',
    );
    http.expectNone({ method: 'DELETE' });

    click(root, '.weight-edit-sheet__confirm-delete');
    http
      .expectOne({ method: 'DELETE', url: `${LOGS_URL}/1` })
      .flush(null, { status: 204, statusText: 'No Content' });
    flushGoal();
    await fixture.whenStable();

    expect(TestBed.inject(WeightLogService).entries()).toHaveLength(2);
    expect(root.querySelectorAll('.weight-log-list__row')).toHaveLength(2);
    expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(75.6);
  });

  it('skriver "i dag" med lille i sletteadvarslen, men stort øverst i arket', async () => {
    const root = await setup([weightLogDto(1, 75, 0, TEST_NOW)]);
    click(root, '.weight-log-list__row');
    await fixture.whenStable();
    click(root, '.weight-edit-sheet__delete');
    await fixture.whenStable();

    expect(root.querySelector('.weight-edit-sheet__when')?.textContent?.trim()).toBe(
      'I dag kl. 10:30',
    );
    expect(root.querySelector('.weight-edit-sheet__confirm')?.textContent?.trim()).toBe(
      'Vil du slette vejningen fra i dag kl. 10:30? Det kan ikke fortrydes.',
    );
  });

  it('viser fejlen under knappen, når den sidste vejning er slettet, men profilen ikke hentes', async () => {
    const root = await setup([weightLogDto(1, 75, 3, TEST_NOW)]);
    click(root, '.weight-log-list__row');
    await fixture.whenStable();
    click(root, '.weight-edit-sheet__delete');
    await fixture.whenStable();

    click(root, '.weight-edit-sheet__confirm-delete');
    http
      .expectOne({ method: 'DELETE', url: `${LOGS_URL}/1` })
      .flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne({ method: 'GET', url: `${LOGS_URL}/latest` })
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root.querySelector('.weight-edit-sheet__save')).toBeNull();
    expect(root.querySelector('.weight-page__save-error')?.textContent?.trim()).toBe(
      'Serveren svarer ikke lige nu. Prøv igen om lidt.',
    );
  });
});
