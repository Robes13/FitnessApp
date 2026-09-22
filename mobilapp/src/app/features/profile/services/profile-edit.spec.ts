import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { UserProfileService } from '../../../core/services/user-profile';
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

    editor.applyOption('goal', 'tage');
    editor.applyOption('gender', 'kvinde');
    editor.applyOption('units', 'imperial');
    editor.applyOption('trainInt', 'haardt');

    expect(profiles.profile().goal).toBe('tage');
    expect(profiles.profile().gender).toBe('kvinde');
    expect(profiles.profile().units).toBe('imperial');
    expect(profiles.profile().trainingRpe).toBe(9);
  });

  it('ignores an option id that is not in the list', () => {
    const { editor, profiles } = setup();

    editor.applyOption('goal', 'noget-andet');

    expect(profiles.profile().goal).toBeNull();
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
    expect(profiles.kcalTarget()).toBe(2300);
    expect(profiles.suggestedKcalTarget()).toBe(2530);
  });

  it('trims the e-mail before saving it', () => {
    const { editor, profiles } = setup();

    editor.applyEmail('  mads@mail.dk ');

    expect(profiles.profile().email).toBe('mads@mail.dk');
  });

  it('cannot change the password without a backend', async () => {
    const { editor } = setup();

    await expect(firstValueFrom(editor.changePassword('langnokkode'))).rejects.toEqual({
      message: 'Der er ingen forbindelse til en server endnu.',
    });
  });
});
