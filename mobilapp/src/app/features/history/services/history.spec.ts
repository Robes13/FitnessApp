import { TestBed } from '@angular/core/testing';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { formatInteger } from '../../../core/utils/date-format';
import { HistoryEntry } from '../models/history';
import { HistoryService, RELOGGED_DURATION_MS, RELOGGED_LABEL, RELOG_LABEL } from './history';

interface Context {
  readonly history: HistoryService;
  readonly foodLog: FoodLogService;
  readonly profile: UserProfileService;
  readonly weightLog: WeightLogService;
}

function setup(): Context {
  TestBed.configureTestingModule({
    providers: [...provideCoreTestEnvironment(), HistoryService],
  });
  return {
    history: TestBed.inject(HistoryService),
    foodLog: TestBed.inject(FoodLogService),
    profile: TestBed.inject(UserProfileService),
    weightLog: TestBed.inject(WeightLogService),
  };
}

function titlesIn(history: HistoryService, label: string): readonly string[] {
  const group = history.groups().find((candidate) => candidate.label === label);
  return (group?.entries ?? []).map((entry) => entry.title);
}

function findEntry(history: HistoryService, title: string): HistoryEntry {
  const entry = history.entries().find((candidate) => candidate.title === title);
  if (!entry) {
    throw new Error(`Fandt ingen post med titlen "${title}".`);
  }
  return entry;
}

describe('HistoryService', () => {
  it('grupperer posterne pr. dag i faldende rækkefølge med designets etiketter', () => {
    const { history } = setup();

    expect(history.groups().map((group) => group.label)).toEqual([
      'I går · 20. sep',
      'Lør. · 19. sep',
      'Fre. · 18. sep',
      'Tor. · 17. sep',
      'Ons. · 16. sep',
      'Tir. · 15. sep',
      'Man. · 14. sep',
      'Man. · 7. sep',
    ]);
  });

  it('fletter vejninger, måltider, dagsopsamlinger og målændringer som i designet', () => {
    const { history } = setup();

    expect(titlesIn(history, 'I går · 20. sep')).toEqual([
      'Dagsmål nået',
      'Skyr-bowl med bær',
      'Kyllingesalat',
    ]);
    expect(titlesIn(history, 'Lør. · 19. sep')).toEqual([
      'Dagligt mål ændret',
      'Laks med kartofler',
      'Proteinbar',
    ]);
    expect(titlesIn(history, 'Fre. · 18. sep')).toEqual(['Vejning', 'Over dagsmål']);
    expect(titlesIn(history, 'Ons. · 16. sep')).toEqual(['Dagsmål nået', 'Højde opdateret']);
  });

  it('bruger de rigtige vejninger fra WeightLogService', () => {
    const { history, weightLog } = setup();

    const weighs = history.entries().filter((entry) => entry.kind === 'vejning');

    expect(weighs).toHaveLength(weightLog.entries().length);
    expect(weighs.map((entry) => entry.value)).toEqual(['75,0 kg', '75,6 kg', '76,1 kg']);
    expect(weighs.map((entry) => entry.subtitle)).toEqual([
      'Morgen, før morgenmad',
      'Morgen',
      'Morgen',
    ]);
  });

  it('regner dagsopsamlingerne ud fra det aktuelle kaloriemål', () => {
    const { history, profile } = setup();
    const target = profile.kcalTarget();

    const hit = findEntry(history, 'Dagsmål nået');
    const over = findEntry(history, 'Over dagsmål');

    expect(hit.subtitle).toBe(`${formatInteger(target - 40)} af ${formatInteger(target)} kcal`);
    expect(hit.value).toBe('−40 kcal');
    expect(hit.valueTone).toBe('positive');
    expect(over.value).toBe('+180 kcal');
    expect(over.valueTone).toBe('negative');
  });

  it('filtrerer på posttype og melder tom, når filteret ikke rammer noget', () => {
    const { history } = setup();

    history.setFilter('vejning');
    expect(history.visibleEntries().every((entry) => entry.kind === 'vejning')).toBe(true);
    expect(history.isEmpty()).toBe(false);

    history.setFilter('maal');
    expect(history.visibleEntries().map((entry) => entry.title)).toEqual([
      'Dagligt mål ændret',
      'Målvægt ændret',
      'Højde opdateret',
      'Tempo ændret',
    ]);

    history.setFilter('alle');
    expect(history.visibleEntries()).toHaveLength(history.entries().length);
  });

  it('kun måltidsposter kan logges igen', () => {
    const { history } = setup();

    expect(findEntry(history, 'Proteinbar').food?.kcal).toBe(210);
    expect(findEntry(history, 'Vejning').food).toBeUndefined();
    expect(findEntry(history, 'Tempo ændret').food).toBeUndefined();
  });

  it('logger måltidet igen og viser "Logget i dag" i 2,6 sekunder', () => {
    vi.useFakeTimers();
    try {
      const { history, foodLog } = setup();
      const entry = findEntry(history, 'Laks med kartofler');
      const before = foodLog.entries().length;

      history.relog(entry);

      expect(foodLog.entries()).toHaveLength(before + 1);
      expect(foodLog.entries().at(-1)?.meal).toBe('aften');
      expect(history.isRelogged(entry)).toBe(true);
      expect(history.relogLabel(entry)).toBe(RELOGGED_LABEL);

      vi.advanceTimersByTime(RELOGGED_DURATION_MS);

      expect(history.isRelogged(entry)).toBe(false);
      expect(history.relogLabel(entry)).toBe(RELOG_LABEL);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rydder "Logget i dag"-timeren, når siden lukkes', () => {
    vi.useFakeTimers();
    try {
      const { history } = setup();
      history.relog(findEntry(history, 'Proteinbar'));

      TestBed.resetTestingModule();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
