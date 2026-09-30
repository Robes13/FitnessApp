import { TestBed } from '@angular/core/testing';
import { AdaptiveGoalService } from '../../../core/services/adaptive-goal/adaptive-goal';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { NumberEditDefinition, OptionsEditDefinition, ProfileEditService } from './profile-edit';

describe('ProfileEditService', () => {
  function setup(): { editor: ProfileEditService; profiles: UserProfileService } {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    return {
      editor: TestBed.inject(ProfileEditService),
      profiles: TestBed.inject(UserProfileService),
    };
  }

  it('describes the goal row as a list of options with none selected yet', () => {
    const { editor } = setup();
    const definition = editor.definitionFor('goal') as OptionsEditDefinition;

    expect(definition.title).toBe('Dit mål');
    expect(definition.kind).toBe('options');
    expect(definition.selectedId).toBeNull();
    expect(definition.options.map((option) => option.label)).toEqual([
      'Tabe mig',
      'Holde vægten',
      'Tage på',
    ]);
  });

  it('puts the rate in front of the pace description', () => {
    const { editor } = setup();
    const definition = editor.definitionFor('pace') as OptionsEditDefinition;

    expect(definition.options.map((option) => option.description)).toContain(
      '0,5 kg/uge · Anbefalet for de fleste',
    );
  });

  it('seeds number rows with the current value and the design bounds', () => {
    const { editor } = setup();
    const height = editor.definitionFor('height') as NumberEditDefinition;

    expect(height).toMatchObject({ kind: 'number', unit: 'cm', min: 120, max: 230, step: 1 });
    expect(height.value).toBe(178);
  });

  it('suggests the calculated target on the daily calorie row', () => {
    const { editor } = setup();
    const kcal = editor.definitionFor('kcal') as NumberEditDefinition;

    expect(kcal.title).toBe('Dagligt kaloriemål');
    expect(kcal.hint).toBe('Beregnet forslag: 2.530 kcal');
    expect(kcal.value).toBe(2530);
  });

  it('shows the current weight as a hint on the goal weight row', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 74.5 });

    expect(editor.definitionFor('goalWeight').hint).toBe('Nu: 74,5 kg');
  });

  it('applies an option straight to the profile', () => {
    const { editor, profiles } = setup();

    expect(editor.applyOption('goal', 'tabe')).toEqual({ kind: 'saved' });
    editor.applyOption('gender', 'kvinde');
    editor.applyOption('units', 'imperial');
    editor.applyOption('trainInt', 'haardt');

    expect(profiles.profile().goal).toBe('tabe');
    expect(profiles.profile().gender).toBe('kvinde');
    expect(profiles.profile().units).toBe('imperial');
    expect(profiles.profile().trainingRpe).toBe(9);
  });

  it('ignores an option id that is not in the list', () => {
    const { editor, profiles } = setup();

    editor.applyOption('goal', 'noget-andet');

    expect(profiles.profile().goal).toBeNull();
  });

  it('bounds the goal weight row by the goal, like the sign-up scale', () => {
    const { editor, profiles } = setup();

    profiles.update({ goal: 'tabe', weightKg: 75 });
    expect(editor.definitionFor('goalWeight')).toMatchObject({ min: 35, max: 74 });

    profiles.update({ goal: 'tage', goalWeightKg: 80 });
    expect(editor.definitionFor('goalWeight')).toMatchObject({ min: 76, max: 200 });
  });

  it('requires a goal weight below today when losing and above today when gaining', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 75, heightCm: 178 });

    expect(editor.goalWeightError(75, 'tabe')).toBe(
      'Målvægten skal være under din nuværende vægt (75 kg).',
    );
    expect(editor.goalWeightError(70, 'tabe')).toBeNull();
    expect(editor.goalWeightError(75, 'tage')).toBe(
      'Målvægten skal være over din nuværende vægt (75 kg).',
    );
    expect(editor.goalWeightError(80, 'tage')).toBeNull();
    expect(editor.goalWeightError(75, 'hold')).toBeNull();
  });

  it('blocks an unrealistic BMI with the sign-up warnings', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 75, heightCm: 178 });

    // 178 cm: BMI 17 ≈ 53.9 kg, BMI 35 ≈ 110.9 kg.
    expect(editor.goalWeightError(50, 'tabe')).toBe('Det mål er for lavt for din højde.');
    expect(editor.goalWeightError(120, 'tage')).toBe('Det mål er meget højt for din højde.');
  });

  it('refuses to save a goal weight that breaks the current goal', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });

    expect(editor.applyNumber('goalWeight', 80)).toBe(false);
    expect(profiles.profile().goalWeightKg).toBe(70);

    expect(editor.applyNumber('goalWeight', 68)).toBe(true);
    expect(profiles.profile().goalWeightKg).toBe(68);
  });

  it('holds back a goal change the stored goal weight no longer fits', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });

    expect(editor.applyOption('goal', 'tage')).toEqual({ kind: 'needs-goal-weight', goal: 'tage' });
    expect(profiles.profile().goal).toBe('tabe');

    expect(editor.applyGoalWithGoalWeight('tage', 72)).toBe(false);
    expect(editor.applyGoalWithGoalWeight('tage', 80)).toBe(true);
    expect(profiles.profile()).toMatchObject({ goal: 'tage', goalWeightKg: 80 });
  });

  it('switches to "hold" without asking for a goal weight', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });

    expect(editor.applyOption('goal', 'hold')).toEqual({ kind: 'saved' });
    expect(profiles.profile().goal).toBe('hold');
  });

  it('turns a training-day count into the first N weekdays', () => {
    const { editor, profiles } = setup();

    editor.applyNumber('trainFreq', 4);

    expect(profiles.profile().trainingDays).toEqual([true, true, true, true, false, false, false]);
  });

  it('writes the calorie override, so the target stops following the calculation', () => {
    const { editor, profiles } = setup();

    editor.applyNumber('kcal', 2300);

    expect(profiles.profile().kcalOverride).toBe(2300);
    const adaptiveGoal = TestBed.inject(AdaptiveGoalService);
    expect(adaptiveGoal.kcalTarget()).toBe(2300);
    expect(adaptiveGoal.suggestedKcalTarget()).toBe(2530);
  });

  it('trims the e-mail before saving it', () => {
    const { editor, profiles } = setup();

    editor.applyEmail('  mads@mail.dk ');

    expect(profiles.profile().email).toBe('mads@mail.dk');
  });
});
