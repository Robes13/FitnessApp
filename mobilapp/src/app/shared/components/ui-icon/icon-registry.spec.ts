import { COLLECTION_ICON_NAMES } from '../../../core/constants/collection-icons';
import { ICON_NAMES, ICON_PATHS, UI_ICON_NAMES } from './icon-registry';

describe('icon registry', () => {
  it('has path data for every collection icon', () => {
    for (const name of COLLECTION_ICON_NAMES) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(0);
    }
  });

  it('has path data for every UI icon', () => {
    for (const name of UI_ICON_NAMES) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(0);
    }
  });

  it('lists every registered icon exactly once', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES.length).toBe(Object.keys(ICON_PATHS).length);
    expect(ICON_NAMES.length).toBe(COLLECTION_ICON_NAMES.length + UI_ICON_NAMES.length);
  });

  it('only contains SVG path data starting with a move command', () => {
    for (const [name, paths] of Object.entries(ICON_PATHS)) {
      for (const d of paths) {
        expect(d, name).toMatch(/^[Mm]/);
      }
    }
  });

  it('draws the tab icons with two paths (except food, which is a single path)', () => {
    expect(ICON_PATHS['tab-food']).toHaveLength(1);
    expect(ICON_PATHS['tab-weight']).toHaveLength(2);
    expect(ICON_PATHS['tab-home']).toHaveLength(2);
    expect(ICON_PATHS['tab-collections']).toHaveLength(2);
    expect(ICON_PATHS['tab-history']).toHaveLength(2);
  });
});
