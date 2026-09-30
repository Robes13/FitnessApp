import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEST_GOAL, flushTestGoal } from '../../../core/testing/fixtures';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
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

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows an en dash for everything the user has not chosen yet', () => {
    const { rows } = setup();

    expect(valueOf(rows.planRows(), 'Mål')).toBe('–');
    expect(valueOf(rows.planRows(), 'Tempo')).toBe('–');
    expect(valueOf(rows.planRows(), 'Køn')).toBe('–');
    expect(valueOf(rows.planRows(), 'Fødselsdato')).toBe('–');
  });

  it('formats the plan from the profile', () => {
    const { rows, profiles } = setup();
    profiles.update({ trainingDays: [true, false, true, false, true, false, false] });

    expect(valueOf(rows.planRows(), 'Højde')).toBe('178 cm');
    expect(valueOf(rows.planRows(), 'Aktivitet')).toBe('6.000 skridt · Aktiv');
    expect(valueOf(rows.planRows(), 'Træningsdage')).toBe('3 / uge');
    expect(valueOf(rows.planRows(), 'Længde')).toBe('45 min');
    expect(valueOf(rows.planRows(), 'Dagligt kaloriemål')).toBe('0 kcal');
  });

  it('shows the birthday with the age', () => {
    const { rows, profiles } = setup();
    profiles.update({ birthday: '1998-05-16' });

    expect(valueOf(rows.planRows(), 'Fødselsdato')).toBe('16. maj 1998 · 28 år');
  });

  it("shows the API's calorie target as a row that can't be edited", () => {
    const { rows } = setup();
    flushTestGoal();

    const kcal = rows.planRows().find((row) => row.id === 'kcal');
    expect(kcal).toMatchObject({ value: '2.500 kcal', editable: false });
    expect(rows.planRows().filter((row) => row.editable === false)).toHaveLength(1);
  });

  it('says when the API lifted the target to the safe minimum', () => {
    const { rows, profiles } = setup();
    profiles.update({ gender: 'kvinde' });
    flushTestGoal({ ...TEST_GOAL, targetDailyCalories: 1200 });

    expect(valueOf(rows.planRows(), 'Dagligt kaloriemål')).toBe('1.200 kcal · sikkert minimum');
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

    expect(labels(rows.accountRows())).toEqual(['E-mail']);
    expect(valueOf(rows.accountRows(), 'E-mail')).toBe('dig@mail.dk');

    profiles.update({ email: 'mads@mail.dk' });
    expect(valueOf(rows.accountRows(), 'E-mail')).toBe('mads@mail.dk');
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
