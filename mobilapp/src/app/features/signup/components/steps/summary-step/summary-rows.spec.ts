import { TestBed } from '@angular/core/testing';
import { INTENSITIES } from '../../../../../core/constants/nutrition';
import { injectTranslate } from '../../../../../core/services/language/translate';
import { SummaryDraft, SummaryRow, buildSummaryRows } from './summary-rows';

const BASE: SummaryDraft = {
  username: 'mads',
  age: 28,
  gender: 'mand',
  weightKg: 75,
  heightCm: 178,
  stepsPerDay: 6000,
  activityLabel: 'Aktiv',
  trainingDayCount: 3,
  trainingMinutes: 45,
  intensity: INTENSITIES[1] ?? null,
  goal: 'tabe',
  goalWeightKg: 70,
  pace: 'moderat',
  notifications: true,
};

function summaryRows(draft: SummaryDraft): readonly SummaryRow[] {
  return buildSummaryRows(
    TestBed.runInInjectionContext(() => injectTranslate()),
    draft,
  );
}

function valueOf(draft: SummaryDraft, label: string): string {
  const row = summaryRows(draft).find((candidate) => candidate.label === label);
  if (!row) {
    throw new Error(`Linjen "${label}" mangler`);
  }
  return row.value;
}

describe('buildSummaryRows', () => {
  it('bygger designets ni linjer i rækkefølge', () => {
    const labels = summaryRows(BASE).map((row) => row.label);

    expect(labels).toEqual([
      'Bruger',
      'Alder',
      'Køn',
      'Vægt',
      'Højde',
      'Aktivitet',
      'Træning',
      'Mål',
      'Påmindelser',
    ]);
  });

  it('fremhæver kun målet', () => {
    const accented = summaryRows(BASE).filter((row) => row.accent);

    expect(accented.map((row) => row.label)).toEqual(['Mål']);
  });

  it('sender hver linje tilbage til sit eget trin', () => {
    const steps = summaryRows(BASE).map((row) => row.step);

    expect(steps).toEqual([
      'account',
      'birthday',
      'gender',
      'weight',
      'height',
      'activity',
      'training-frequency',
      'goal',
      'notifications',
    ]);
  });

  it('samler målet af mål, målvægt og tempo', () => {
    expect(valueOf(BASE, 'Mål')).toBe('Tabe mig · 70 kg · moderat');
  });

  it('udelader målvægten, når vægten skal holdes', () => {
    expect(valueOf({ ...BASE, goal: 'hold', pace: null }, 'Mål')).toBe('Holde vægten');
  });

  it('udelader tempoet, når det ikke er valgt', () => {
    expect(valueOf({ ...BASE, pace: null }, 'Mål')).toBe('Tabe mig · 70 kg');
  });

  it('viser en tankestreg, når målet mangler', () => {
    expect(valueOf({ ...BASE, goal: null, pace: null }, 'Mål')).toBe('–');
  });

  it('samler træningen af antal, varighed og intensitet', () => {
    expect(valueOf(BASE, 'Træning')).toBe('3 × 45 min · moderat');
  });

  it('udelader intensiteten, når den ikke er valgt', () => {
    expect(valueOf({ ...BASE, intensity: null }, 'Træning')).toBe('3 × 45 min');
  });

  it('skriver "Ingen faste træninger" uden træningsdage', () => {
    expect(valueOf({ ...BASE, trainingDayCount: 0 }, 'Træning')).toBe('Ingen faste træninger');
  });

  it('skriver skridt med tusindtalspunktum og niveauets navn', () => {
    expect(valueOf(BASE, 'Aktivitet')).toBe('6.000 skridt · Aktiv');
  });

  it('skriver hele kilo uden decimal og halve med komma', () => {
    expect(valueOf(BASE, 'Vægt')).toBe('75 kg');
    expect(valueOf({ ...BASE, weightKg: 74.5 }, 'Vægt')).toBe('74,5 kg');
  });

  it('viser tankestreg for tomme svar', () => {
    const empty: SummaryDraft = {
      ...BASE,
      username: '',
      age: 0,
      gender: null,
      notifications: null,
    };

    expect(valueOf(empty, 'Bruger')).toBe('–');
    expect(valueOf(empty, 'Alder')).toBe('–');
    expect(valueOf(empty, 'Køn')).toBe('–');
    expect(valueOf(empty, 'Påmindelser')).toBe('–');
  });

  it('skriver påmindelsernes svar som i designet', () => {
    expect(valueOf(BASE, 'Påmindelser')).toBe('Ja tak');
    expect(valueOf({ ...BASE, notifications: false }, 'Påmindelser')).toBe('Nej tak');
  });
});
