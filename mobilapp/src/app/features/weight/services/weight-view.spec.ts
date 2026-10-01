import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { UserProfile } from '../../../core/models/profile';
import { WeightLogDto } from '../../../core/models/weight';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import {
  TEST_GOAL,
  flushTestWeighIns,
  weighHistory,
  weightLogDto,
} from '../../../core/testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { COLLAPSED_LOG_ROWS, WeightViewService, weightChangeTone } from './weight-view';

const LOGS_URL = '/api/v1/me/weight-logs';
const LIST_URL = `${LOGS_URL}?limit=100`;
const SAVE_ERROR = 'Vejningen blev ikke gemt. Prøv igen.';
const SERVER_ERROR = 'Serveren svarer ikke lige nu. Prøv igen om lidt.';

describe('WeightViewService', () => {
  let http: HttpTestingController;

  function setup(
    profile: Partial<UserProfile> = {},
    weighIns: readonly WeightLogDto[] = weighHistory(TEST_NOW),
  ): WeightViewService {
    TestBed.configureTestingModule({
      providers: [provideCoreTestEnvironment(), WeightViewService],
    });
    http = TestBed.inject(HttpTestingController);
    flushTestWeighIns(weighIns);
    TestBed.inject(UserProfileService).update(profile);
    return TestBed.inject(WeightViewService);
  }

  /** The API recalculated the goal on the mutation – the store reloads it. */
  function flushGoal(): void {
    http.expectOne({ method: 'GET', url: '/api/v1/me/goals/current' }).flush(TEST_GOAL);
  }

  /** Subscribes like the page does and records whether the action emitted. */
  function run(action: Observable<void>): { emitted: boolean } {
    const result = { emitted: false };
    action.subscribe(() => (result.emitted = true));
    return result;
  }

  afterEach(() => http.verify());

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
    expect(view.loadStatus()).toBe('ready');
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

  it('starter grafen på 3 uger og vender fodnoten om', () => {
    const view = setup({ goal: 'tabe' });

    expect(view.range()).toBe('3u');
    expect(view.rangeLabel()).toBe('Sidste 3 uger');
    expect(view.rangeStartLabel()).toBe('-3 uger');
    expect(view.seriesKg()).toEqual([76.1, 75.6, 75]);
    expect(view.rangeDeltaTone()).toBe('positive');
    expect(view.rangeDeltaText()).toBe('−1,1 kg');

    view.selectRange('1u');

    expect(view.range()).toBe('1u');
    expect(view.rangeLabel()).toBe('Sidste uge');
    expect(view.rangeStartLabel()).toBe('-uge');
    expect(view.seriesKg()).toEqual([75]);
    expect(view.rangeDeltaTone()).toBe('muted');
  });

  it('viser vejningerne med forskel til den forrige og "Start" på den ældste', () => {
    const view = setup({ goal: 'tabe' });

    expect(view.logRows()).toHaveLength(3);
    expect(view.logRows().map((row) => row.kg)).toEqual(['75,0', '75,6', '76,1']);
    expect(view.logRows().map((row) => row.delta)).toEqual(['−0,6', '−0,5', 'Start']);
    expect(view.logRows().map((row) => row.deltaTone)).toEqual(['positive', 'positive', 'muted']);
    expect(view.logRows()[0]?.date).toBe('3 dage siden');
  });

  it('har en dag til brug inde i en sætning: "i dag", "i går" og ellers datoen', () => {
    const view = setup({ goal: 'tabe' }, [
      weightLogDto(1, 75, 0, TEST_NOW),
      weightLogDto(2, 75.2, 1, TEST_NOW),
      weightLogDto(3, 75.4, 3, TEST_NOW),
    ]);

    expect(view.logRows().map((row) => row.date)).toEqual(['I dag', 'I går', '3 dage siden']);
    expect(view.logRows().map((row) => row.dateInSentence)).toEqual(['i dag', 'i går', '18. sep']);
  });

  describe('gem', () => {
    it('gemmer kladden som en ny vejning og opdaterer profilens vægt', () => {
      const view = setup();
      view.setDraftKg(73.4);

      const save = run(view.save());
      expect(view.saving()).toBe(true);
      const post = http.expectOne({ method: 'POST', url: LOGS_URL });
      expect(post.request.body).toEqual({ weight: 73.4, recordedAt: TEST_NOW.toISOString() });
      post.flush(weightLogDto(9, 73.4, 0, TEST_NOW));
      flushGoal();

      expect(save.emitted).toBe(true);
      expect(view.saving()).toBe(false);
      expect(view.logRows()).toHaveLength(4);
      expect(view.logRows()[0]?.date).toBe('I dag');
      expect(TestBed.inject(UserProfileService).profile().weightKg).toBe(73.4);
      expect(TestBed.inject(WeightLogService).weighedToday()).toBe(true);
      expect(view.lastWeighLabel()).toBe('Sidst vejet i dag');
    });

    it('ignorerer et ekstra tryk, mens der gemmes', () => {
      const view = setup();

      run(view.save());
      run(view.save());

      http.expectOne({ method: 'POST', url: LOGS_URL }).flush(weightLogDto(9, 75, 0, TEST_NOW));
      flushGoal();
    });

    it('spørger ved en vejning samme dag og overskriver først efter "Ja"', () => {
      const view = setup();
      view.setDraftKg(73.1);

      const save = run(view.save());
      http
        .expectOne({ method: 'POST', url: LOGS_URL })
        .flush(
          { title: 'Conflict', status: 409, existingWeightLogId: 42 },
          { status: 409, statusText: 'Conflict' },
        );

      expect(save.emitted).toBe(false);
      expect(view.overwriteId()).toBe('42');
      expect(view.saving()).toBe(false);
      http.expectNone({ method: 'PATCH' });

      const confirm = run(view.confirmOverwrite());
      const patch = http.expectOne({ method: 'PATCH', url: `${LOGS_URL}/42` });
      expect(patch.request.body).toEqual({ weight: 73.1, recordedAt: TEST_NOW.toISOString() });
      patch.flush(weightLogDto(42, 73.1, 0, TEST_NOW));
      flushGoal();

      expect(confirm.emitted).toBe(true);
      expect(view.overwriteId()).toBeNull();
      expect(view.logRows()[0]?.kg).toBe('73,1');
    });

    it('lukker spørgsmålet ved "Annuller" uden at sende noget', () => {
      const view = setup();

      run(view.save());
      http
        .expectOne({ method: 'POST', url: LOGS_URL })
        .flush({ existingWeightLogId: 42 }, { status: 409, statusText: 'Conflict' });

      view.cancelOverwrite();

      expect(view.overwriteId()).toBeNull();
      expect(view.logRows()).toHaveLength(3);
    });

    it('viser en fejl, når vejningen ikke kan gemmes', () => {
      const view = setup();

      const save = run(view.save());
      http.expectOne({ method: 'POST', url: LOGS_URL }).error(new ProgressEvent('error'));

      expect(save.emitted).toBe(false);
      expect(view.saving()).toBe(false);
      expect(view.saveError()).toBe(SAVE_ERROR);
      expect(view.logRows()).toHaveLength(3);
    });

    it('siger ikke "ikke gemt", når kun genindlæsningen af målet fejler efter gem', () => {
      const view = setup();

      const save = run(view.save());
      http.expectOne({ method: 'POST', url: LOGS_URL }).flush(weightLogDto(9, 75, 0, TEST_NOW));
      http
        .expectOne({ method: 'GET', url: '/api/v1/me/goals/current' })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(save.emitted).toBe(false);
      expect(view.saving()).toBe(false);
      expect(view.saveError()).toBe(SERVER_ERROR);
      expect(view.logRows()[0]?.date).toBe('I dag');
    });

    it('lukker spørgsmålet, når kun genindlæsningen af målet fejler efter overskrivningen', () => {
      const view = setup();
      run(view.save());
      http
        .expectOne({ method: 'POST', url: LOGS_URL })
        .flush({ existingWeightLogId: 42 }, { status: 409, statusText: 'Conflict' });

      run(view.confirmOverwrite());
      http
        .expectOne({ method: 'PATCH', url: `${LOGS_URL}/42` })
        .flush(weightLogDto(42, 75, 0, TEST_NOW));
      http
        .expectOne({ method: 'GET', url: '/api/v1/me/goals/current' })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(view.overwriteId()).toBeNull();
      expect(view.overwriteError()).toBeNull();
      expect(view.saveError()).toBe(SERVER_ERROR);
      expect(view.saving()).toBe(false);
    });

    it('holder spørgsmålet åbent med en fejl, når overskrivningen fejler', () => {
      const view = setup();
      run(view.save());
      http
        .expectOne({ method: 'POST', url: LOGS_URL })
        .flush({ existingWeightLogId: 42 }, { status: 409, statusText: 'Conflict' });

      run(view.confirmOverwrite());
      http
        .expectOne({ method: 'PATCH', url: `${LOGS_URL}/42` })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(view.overwriteId()).toBe('42');
      expect(view.overwriteError()).toBe(SAVE_ERROR);
      expect(view.saveError()).toBeNull();
    });
  });

  it('viser kun vejninger fra de sidste 3 mdr. og sammenligner stadig med den før', () => {
    const view = setup({ goal: 'tabe' }, [
      weightLogDto(1, 75, 5, TEST_NOW),
      weightLogDto(2, 77, 100, TEST_NOW),
    ]);

    expect(view.allLogRows().map((row) => row.id)).toEqual(['1']);
    expect(view.logRows()[0]?.delta).toBe('−2,0');
  });

  it('folder listen ud til alle vejninger fra de sidste 3 mdr.', () => {
    const view = setup(
      {},
      Array.from({ length: 10 }, (_, index) =>
        weightLogDto(index + 1, 75 + index / 10, index * 10 + 1, TEST_NOW),
      ),
    );

    // Entries 0–8 are within 90 days; entry 9 (91 days) is not.
    expect(view.logRows()).toHaveLength(COLLAPSED_LOG_ROWS);
    expect(view.hiddenLogCount()).toBe(3);

    view.toggleLogExpanded();

    expect(view.logExpanded()).toBe(true);
    expect(view.logRows()).toHaveLength(9);
  });

  describe('ret-arket', () => {
    it('retter og sletter den vejning, der er åben i arket', () => {
      const view = setup();
      const profile = TestBed.inject(UserProfileService);

      view.startEdit('1');
      expect(view.editingRow()?.kgValue).toBe(75);

      run(view.saveEdit(74.2));
      expect(view.editBusy()).toBe(true);
      const patch = http.expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` });
      expect(patch.request.body).toEqual({ weight: 74.2 });
      patch.flush(weightLogDto(1, 74.2, 3, TEST_NOW));
      flushGoal();
      expect(view.editBusy()).toBe(false);
      expect(view.editingRow()).toBeNull();
      expect(view.logRows()[0]?.kg).toBe('74,2');
      expect(profile.profile().weightKg).toBe(74.2);

      view.startEdit('1');
      run(view.removeEditing());
      http
        .expectOne({ method: 'DELETE', url: `${LOGS_URL}/1` })
        .flush(null, { status: 204, statusText: 'No Content' });
      flushGoal();
      expect(view.editingRow()).toBeNull();
      expect(view.logRows().map((row) => row.id)).toEqual(['2', '3']);
      expect(profile.profile().weightKg).toBe(75.6);

      view.startEdit('2');
      view.cancelEdit();
      expect(view.editingRow()).toBeNull();
    });

    it('bliver åbent og siger hvorfor, når rettelsen fejler', () => {
      const view = setup();
      view.startEdit('1');

      run(view.saveEdit(74.2));
      http
        .expectOne({ method: 'PATCH', url: `${LOGS_URL}/1` })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(view.editingRow()?.id).toBe('1');
      expect(view.editBusy()).toBe(false);
      expect(view.editError()).toBe('Serveren svarer ikke lige nu. Prøv igen om lidt.');

      view.cancelEdit();
      expect(view.editError()).toBeNull();
    });
  });

  it('viser startvægten fra registreringen, når der ikke er vejet endnu', () => {
    const view = setup({ weightKg: 81 }, []);

    expect(view.hasEntries()).toBe(false);
    expect(view.logRows()).toHaveLength(0);
    expect(view.lastWeighedKg()).toBe(81);
    expect(view.profileWeightText()).toBe('81');
    expect(view.lastWeighLabel()).toBe('Startvægt fra registreringen');
    expect(view.logEmptyMessage()).toBe(
      'Ingen vejninger endnu. Startvægten fra registreringen kan ikke rettes – registrér en ny vejning først.',
    );
  });

  describe('indlæsning', () => {
    function setupBare(): WeightViewService {
      TestBed.configureTestingModule({
        providers: [provideCoreTestEnvironment(), WeightViewService],
      });
      http = TestBed.inject(HttpTestingController);
      return TestBed.inject(WeightViewService);
    }

    it('venter på vejningerne og tilbyder "Prøv igen" kun for den store, der fejlede', () => {
      const view = setupBare();
      TestBed.inject(WeightLogService).load().subscribe();
      expect(view.loadStatus()).toBe('loading');

      http.expectOne(LIST_URL).flush(null, { status: 500, statusText: 'Server Error' });
      expect(view.loadStatus()).toBe('error');

      run(view.retryLoad());
      expect(view.loadStatus()).toBe('loading');
      http.expectOne(LIST_URL).flush({ items: [], nextCursor: null, hasMore: false });

      expect(view.loadStatus()).toBe('ready');
    });

    it('genindlæser kun profilen, når det var den, der fejlede', () => {
      const view = setupBare();
      flushTestWeighIns([]);
      const profiles = TestBed.inject(UserProfileService);
      profiles.load().subscribe();
      // The first of the profile's parallel requests fails; the others are cancelled.
      http.match(() => true)[0]?.flush(null, { status: 500, statusText: 'Server Error' });
      expect(view.loadStatus()).toBe('error');

      run(view.retryLoad());

      http.expectNone(LIST_URL);
      expect(http.match(() => true).length).toBeGreaterThan(0);
      expect(profiles.status()).toBe('loading');
    });
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
