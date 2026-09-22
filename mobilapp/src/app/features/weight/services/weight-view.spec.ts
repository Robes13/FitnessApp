import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../../core/constants/profile-defaults';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { weighHistory } from '../../../core/testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { WeightViewService, weightChangeTone } from './weight-view';

describe('WeightViewService', () => {
  let storage: FakeStorage;

  function setup(profile: Partial<typeof DEFAULT_PROFILE> = {}): WeightViewService {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ ...DEFAULT_PROFILE, ...profile }));
    if (storage.getItem(STORAGE_KEY.WEIGHT_LOG) === null) {
      storage.setItem(STORAGE_KEY.WEIGHT_LOG, JSON.stringify(weighHistory(TEST_NOW)));
    }
    TestBed.configureTestingModule({
      providers: [provideCoreTestEnvironment({ storage }), WeightViewService],
    });
    return TestBed.inject(WeightViewService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starter kladden på profilens vægt og viser afstanden til målet', () => {
    const view = setup();

    expect(view.draftKg()).toBe(75);
    expect(view.draftText()).toBe('75,0');
    expect(view.draftIsWide()).toBe(false);
    expect(view.lastWeighedKg()).toBe(75);
    expect(view.deltaText()).toBe('0,0');
    expect(view.deltaTone()).toBe('muted');
    expect(view.goalWeightKg()).toBe(70);
    expect(view.toGoalText()).toBe('5,0');
    expect(view.lastWeighLabel()).toBe('Sidst vejet 3 dage siden');
  });

  it('skifter til det smalle taltrin fra 100 kg', () => {
    const view = setup({ weightKg: 104 });

    expect(view.draftIsWide()).toBe(true);
  });

  it('klemmer kladden fast mellem 30 og 300 kg og skruer i trin på 0,1', () => {
    const view = setup();

    view.adjustDraftKg(-0.1);
    expect(view.draftKg()).toBe(74.9);

    view.setDraftKg(1000);
    expect(view.draftKg()).toBe(300);

    view.setDraftKg(0);
    expect(view.draftKg()).toBe(30);
  });

  it('farver et vægttab grønt, når målet er at tabe sig', () => {
    const view = setup({ goal: 'tabe' });

    view.setDraftKg(73.5);

    expect(view.deltaText()).toBe('−1,5');
    expect(view.deltaTone()).toBe('positive');
    expect(view.progressKg()).toBeCloseTo(1.5, 5);
  });

  it('farver en stigning rødt, når målet er at tabe sig', () => {
    const view = setup({ goal: 'tabe' });

    view.setDraftKg(76.5);

    expect(view.deltaText()).toBe('+1,5');
    expect(view.deltaTone()).toBe('negative');
    expect(view.progressKg()).toBeCloseTo(-1.5, 5);
  });

  it('sigter mod den nuværende vægt, når målet er at holde vægten', () => {
    const view = setup({ goal: 'hold', goalWeightKg: 60 });

    expect(view.goalWeightKg()).toBe(75);
    expect(view.toGoalText()).toBe('0,0');
    expect(view.progressKg()).toBeCloseTo(0.3, 5);
  });

  it('bygger grafen for det valgte interval og vender fodnoten om', () => {
    const view = setup({ goal: 'tabe' });

    expect(view.rangeLabel()).toBe('Sidste 4 uger');
    expect(view.rangeStartLabel()).toBe('-4 uger');
    expect(view.seriesKg()).toEqual([76.1, 75.6, 75]);
    expect(view.rangeDeltaTone()).toBe('positive');
    expect(view.rangeDeltaText()).toBe('−1,1 kg');

    view.selectRange('1u');

    expect(view.range()).toBe('1u');
    expect(view.rangeLabel()).toBe('Sidste uge');
    expect(view.rangeStartLabel()).toBe('-uge');
    expect(view.seriesKg()).toEqual([75]);
  });

  it('viser vejningerne med forskel til den forrige og "Start" på den ældste', () => {
    const view = setup({ goal: 'tabe' });

    expect(view.logRows()).toHaveLength(3);
    expect(view.logRows().map((row) => row.kg)).toEqual(['75,0', '75,6', '76,1']);
    expect(view.logRows().map((row) => row.delta)).toEqual(['−0,6', '−0,5', 'Start']);
    expect(view.logRows().map((row) => row.deltaTone)).toEqual(['positive', 'positive', 'muted']);
    expect(view.logRows()[0]?.date).toBe('3 dage siden');
  });

  it('gemmer kladden som en ny vejning og opdaterer profilens vægt', () => {
    const view = setup();
    view.setDraftKg(73.4);

    const entry = view.save();

    expect(entry.kg).toBe(73.4);
    expect(view.logRows()).toHaveLength(4);
    expect(view.logRows()[0]?.date).toBe('I dag');
    expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(73.4);
    expect(TestBed.inject(WeightLogService).weighedToday()).toBe(true);
    expect(view.lastWeighLabel()).toBe('Sidst vejet i dag');
  });

  it('fortæller, når der ikke er vejet endnu', () => {
    storage.setItem(STORAGE_KEY.WEIGHT_LOG, JSON.stringify([]));

    const view = setup();

    expect(view.hasEntries()).toBe(false);
    expect(view.logRows()).toHaveLength(0);
    expect(view.lastWeighLabel()).toBe('Ingen vejninger endnu');
  });
});

describe('weightChangeTone', () => {
  it('er neutral under 0,05 kg', () => {
    expect(weightChangeTone(0.04, 'tabe')).toBe('muted');
    expect(weightChangeTone(-0.04, 'tage')).toBe('muted');
  });

  it('belønner en stigning, når målet er at tage på', () => {
    expect(weightChangeTone(0.6, 'tage')).toBe('positive');
    expect(weightChangeTone(-0.6, 'tage')).toBe('negative');
  });

  it('belønner en lille bevægelse, når målet er at holde vægten', () => {
    expect(weightChangeTone(0.4, 'hold')).toBe('positive');
    expect(weightChangeTone(0.8, 'hold')).toBe('negative');
  });

  it('bruger "tabe"-reglen, når målet mangler', () => {
    expect(weightChangeTone(-0.6, null)).toBe('positive');
    expect(weightChangeTone(0.6, null)).toBe('negative');
  });
});
