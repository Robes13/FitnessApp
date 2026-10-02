import config from '../capacitor.config';

describe('capacitor.config', () => {
  it('keeps plugin call data (login, tokens, steps) out of the device logs, debug builds too', () => {
    expect(config.loggingBehavior).toBe('none');
  });

  it("doesn't inject the --safe-area-inset-* variables (the app reads env())", () => {
    expect(config.plugins?.SystemBars?.insetsHandling).toBe('native');
  });
});
