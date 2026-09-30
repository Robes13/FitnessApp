import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { LoggedFood } from '../../../core/models/food';
import { createFakeStorage } from '../../../core/testing/fake-document';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { addDays, toIsoDate } from '../../../core/utils/date-format';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { ProfileRow, ProfileRowsService } from './profile-rows';

function labels(rows: readonly ProfileRow[]): readonly string[] {
  return rows.map((row) => row.label);
}

function valueOf(rows: readonly ProfileRow[], label: string): string | undefined {
  return rows.find((row) => row.label === label)?.value;
}

describe('ProfileRowsService', () => {
  function setup(): { rows: ProfileRowsService; profiles: UserProfileService } {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    return {
      rows: TestBed.inject(ProfileRowsService),
      profiles: TestBed.inject(UserProfileService),
    };
  }

  it('shows an en dash for everything the user has not chosen yet', () => {
    const { rows } = setup();

    expect(valueOf(rows.planRows(), 'Mål')).toBe('–');
    expect(valueOf(rows.planRows(), 'Tempo')).toBe('–');
    expect(valueOf(rows.planRows(), 'Køn')).toBe('–');
  });

  it('formats the plan from the profile', () => {
    const { rows, profiles } = setup();
    profiles.update({ trainingDays: [true, false, true, false, true, false, false] });

    expect(valueOf(rows.planRows(), 'Højde')).toBe('178 cm');
    expect(valueOf(rows.planRows(), 'Aktivitet')).toBe('6.000 skridt · Aktiv');
    expect(valueOf(rows.planRows(), 'Træningsdage')).toBe('3 / uge');
    expect(valueOf(rows.planRows(), 'Længde')).toBe('45 min');
    // 2530 kcal by BMR × PAL + ~96 kcal/day for three moderate 45-minute sessions.
    expect(valueOf(rows.planRows(), 'Dagligt kaloriemål')).toBe('2.630 kcal');
  });

  it('says when the target is adapted to the weight trend', () => {
    const days: Record<string, readonly LoggedFood[]> = {};
    for (let offset = 1; offset <= 12; offset += 1) {
      const day = addDays(TEST_NOW, -offset);
      days[toIsoDate(day)] = [
        {
          id: 'food-test',
          name: 'Test',
          quantity: '1 portion',
          kcal: 2410,
          protein: 0,
          carbs: 0,
          fat: 0,
          logId: `log-${offset}`,
          meal: 'frokost',
          loggedAt: day.toISOString(),
        },
      ];
    }
    const weighIns = [1, 20].map((daysAgo) => ({
      id: `w${daysAgo}`,
      kg: 75,
      at: addDays(TEST_NOW, -daysAgo).toISOString(),
    }));
    TestBed.configureTestingModule({
      providers: provideCoreTestEnvironment({
        storage: createFakeStorage({
          [STORAGE_KEY.FOOD_LOG]: { days },
          [STORAGE_KEY.WEIGHT_LOG]: weighIns,
        }),
      }),
    });
    const rows = TestBed.inject(ProfileRowsService);

    expect(valueOf(rows.planRows(), 'Dagligt kaloriemål')).toBe('2.410 kcal · tilpasset −120');
  });

  it('hides Målvægt until a goal other than "hold" is chosen', () => {
    const { rows, profiles } = setup();

    expect(labels(rows.planRows())).not.toContain('Målvægt');

    profiles.update({ goal: 'hold' });
    expect(labels(rows.planRows())).not.toContain('Målvægt');

    profiles.update({ goal: 'tabe' });
    expect(valueOf(rows.planRows(), 'Målvægt')).toBe('70 kg');
  });

  it('hides Tempo when the goal is "hold"', () => {
    const { rows, profiles } = setup();

    expect(labels(rows.planRows())).toContain('Tempo');

    profiles.update({ goal: 'hold' });
    expect(labels(rows.planRows())).not.toContain('Tempo');

    profiles.update({ goal: 'tage' });
    expect(labels(rows.planRows())).toContain('Tempo');
  });

  it('hides Længde and Intensitet when there are no training days', () => {
    const { rows, profiles } = setup();

    profiles.update({ trainingDays: [false, false, false, false, false, false, false] });

    expect(valueOf(rows.planRows(), 'Træningsdage')).toBe('Ingen');
    expect(labels(rows.planRows())).not.toContain('Længde');
    expect(labels(rows.planRows())).not.toContain('Intensitet');
  });

  it('names the chosen intensity once an RPE is set', () => {
    const { rows, profiles } = setup();
    profiles.update({ trainingDays: [true, false, true, false, true, false, false] });

    expect(valueOf(rows.planRows(), 'Intensitet')).toBe('–');

    profiles.update({ trainingRpe: 9 });
    expect(valueOf(rows.planRows(), 'Intensitet')).toBe('Hårdt');
  });

  it('falls back to the placeholder e-mail', () => {
    const { rows, profiles } = setup();

    expect(labels(rows.accountRows())).toEqual(['E-mail', 'Enheder']);
    expect(valueOf(rows.accountRows(), 'E-mail')).toBe('dig@mail.dk');
    expect(valueOf(rows.accountRows(), 'Enheder')).toBe('kg · cm');

    profiles.update({ email: 'mads@mail.dk', units: 'imperial' });
    expect(valueOf(rows.accountRows(), 'E-mail')).toBe('mads@mail.dk');
    expect(valueOf(rows.accountRows(), 'Enheder')).toBe('lb · in');
  });

  it('formats the three key figures like the design', () => {
    const { rows, profiles } = setup();

    expect(rows.weightText()).toBe('75');
    expect(rows.heightText()).toBe('178');
    expect(rows.bmiText()).toBe('23,7');

    profiles.update({ weightKg: 74.5 });
    expect(rows.weightText()).toBe('74,5');
  });
});
