import {
  SAVE_SPARKS,
  puddleSize,
  sceneBandTone,
  sceneMood,
  steamPath,
  steamPuffs,
  sweatDrops,
  sweatPath,
} from './scale-scene-geometry';

describe('scale-scene-geometry', () => {
  describe('sceneMood', () => {
    it('mætter humøret ved ±1,5 kg', () => {
      expect(sceneMood(0)).toBe(0);
      expect(sceneMood(0.75)).toBe(0.5);
      expect(sceneMood(1.5)).toBe(1);
      expect(sceneMood(9)).toBe(1);
      expect(sceneMood(-9)).toBe(-1);
    });
  });

  describe('sceneBandTone', () => {
    it('mørkner pandebåndet ved 0,5 og 1 kg fremgang', () => {
      expect(sceneBandTone(0.4)).toBe('accent');
      expect(sceneBandTone(0.5)).toBe('accent-strong');
      expect(sceneBandTone(1)).toBe('accent-deep');
    });
  });

  describe('sweatDrops', () => {
    it('giver én dråbe pr. 0,2 kg fremgang', () => {
      expect(sweatDrops(0, 100, 150)).toHaveLength(0);
      expect(sweatDrops(-3, 100, 150)).toHaveLength(0);
      expect(sweatDrops(0.9, 100, 150)).toHaveLength(4);
      expect(sweatDrops(50, 100, 150)).toHaveLength(10);
    });

    it('placerer dråberne i forhold til hoved og krop med figurens forskydning', () => {
      const [first, second] = sweatDrops(0.9, 100, 150);

      expect(first).toEqual({ x: 72, y: 72, duration: 1.1, delay: 0 });
      expect(second).toEqual({ x: 128, y: 76, duration: 1.5, delay: 0.2 });
    });

    it('tegner dråben som designets drypformede path', () => {
      expect(sweatPath({ x: 72, y: 72, duration: 1.1, delay: 0 })).toBe(
        'M72 72 c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z',
      );
    });
  });

  describe('puddleSize', () => {
    it('vokser med fremgangen og stopper ved 52 × 5', () => {
      expect(puddleSize(0)).toEqual({ rx: 0, ry: 0 });
      expect(puddleSize(-2)).toEqual({ rx: 0, ry: 0 });
      expect(puddleSize(2)).toEqual({ rx: 28, ry: 2.8 });
      expect(puddleSize(9)).toEqual({ rx: 52, ry: 5 });
    });
  });

  describe('steamPuffs', () => {
    it('damper først fra 2,5 kg fremgang', () => {
      expect(steamPuffs(2.4, 100)).toHaveLength(0);
      expect(steamPuffs(2.5, 100)).toEqual([
        { x: 80, y: 70, delay: 0 },
        { x: 100, y: 66, delay: 0.6 },
        { x: 120, y: 70, delay: 1.2 },
      ]);
    });

    it('tegner dampen som en slynget streg', () => {
      expect(steamPath({ x: 80, y: 70, delay: 0 })).toBe('M80 70 q 4 -6 0 -12 q -4 -6 0 -12');
    });
  });

  it('har fem gnister til den gemte vejning', () => {
    expect(SAVE_SPARKS).toHaveLength(5);
    expect(SAVE_SPARKS.map((spark) => spark.tone)).toEqual([
      'accent',
      'positive',
      'selected',
      'accent',
      'positive',
    ]);
  });
});
