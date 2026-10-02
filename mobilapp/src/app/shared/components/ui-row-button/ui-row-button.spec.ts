import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiRowButton } from './ui-row-button';

@Component({
  imports: [UiRowButton],
  template: `<button app-ui-row-button label="Servicevilkår" value="Træk tilbage"></button>`,
})
class Host {}

describe('UiRowButton', () => {
  it('wraps a value that does not fit instead of cutting it off with an ellipsis', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const value = root.querySelector('.ui-row-button__value') as HTMLElement;

    const style = getComputedStyle(value);
    expect(value.textContent).toBe('Træk tilbage');
    expect(style.whiteSpace).not.toBe('nowrap');
    expect(style.textOverflow).not.toBe('ellipsis');
  });
});
