import { normalizeName } from './name';

describe('normalizeName', () => {
  it('trims and lowercases with Danish rules', () => {
    expect(normalizeName('  Æble GRØD ')).toBe('æble grød');
    expect(normalizeName(' meal PREP ')).toBe(normalizeName('Meal prep'));
  });
});
