import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TextInputType, TextInputValue, UiTextInput } from './ui-text-input';

@Component({
  imports: [UiTextInput, ReactiveFormsModule],
  template: `
    <app-ui-text-input
      [formControl]="control"
      [type]="type()"
      placeholder="Brugernavn"
      ariaLabel="Brugernavn"
      [invalid]="invalid()"
    />
  `,
})
class Host {
  readonly control = new FormControl<TextInputValue>('');
  readonly type = signal<TextInputType>('text');
  readonly invalid = signal(false);
}

describe('UiTextInput', () => {
  async function setup(type: TextInputType = 'text') {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.type.set(type);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('input') as HTMLInputElement;
    return { fixture, host: fixture.componentInstance, root, field };
  }

  function typeInto(field: HTMLInputElement, text: string): void {
    field.value = text;
    field.dispatchEvent(new Event('input'));
  }

  it('writes the form value into the native field', async () => {
    const { fixture, host, field } = await setup();

    host.control.setValue('mads');
    await fixture.whenStable();

    expect(field.value).toBe('mads');
    expect(field.placeholder).toBe('Brugernavn');
    expect(field.getAttribute('aria-label')).toBe('Brugernavn');
  });

  it('propagates typing to the form control and marks it touched on blur', async () => {
    const { fixture, host, field } = await setup();

    typeInto(field, 'nutrify');
    expect(host.control.value).toBe('nutrify');
    expect(host.control.touched).toBe(false);

    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(host.control.touched).toBe(true);
  });

  it('follows the disabled state of the control', async () => {
    const { fixture, host, field } = await setup();

    host.control.disable();
    await fixture.whenStable();
    expect(field.disabled).toBe(true);

    host.control.enable();
    await fixture.whenStable();
    expect(field.disabled).toBe(false);
  });

  it('reflects the invalid input as aria-invalid and a modifier class', async () => {
    const { fixture, host, root, field } = await setup();
    const component = root.querySelector('app-ui-text-input') as HTMLElement;

    host.invalid.set(true);
    await fixture.whenStable();

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(component.classList.contains('ui-text-input--invalid')).toBe(true);
  });

  it('adds an eye toggle for passwords that reveals the value', async () => {
    const { fixture, root, field } = await setup('password');
    const toggle = root.querySelector('.ui-text-input__reveal') as HTMLButtonElement;

    expect(field.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Vis adgangskode');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await fixture.whenStable();

    expect(field.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('has no eye toggle on plain text fields', async () => {
    const { root } = await setup('text');
    expect(root.querySelector('.ui-text-input__reveal')).toBeNull();
  });

  it('emits numbers (or null when empty) for number fields', async () => {
    const { host, field } = await setup('number');

    typeInto(field, '42.5');
    expect(host.control.value).toBe(42.5);

    typeInto(field, '');
    expect(host.control.value).toBeNull();
  });

  it('reads a decimal comma in number fields, which are text fields with a decimal keypad', async () => {
    const { host, field } = await setup('number');

    typeInto(field, '45,5');

    expect(host.control.value).toBe(45.5);
    expect(field.type).toBe('text');
    expect(field.getAttribute('inputmode')).toBe('decimal');
  });

  // iOS keeps an intrinsic width on native date/time fields, so they would overflow the sheet.
  it.each<TextInputType>(['time', 'date'])(
    'lays a %s field out as a block that fits its container',
    async (type) => {
      const { field } = await setup(type);

      expect(field.type).toBe(type);
      expect(getComputedStyle(field).display).toBe('block');
    },
  );

  it('keeps password text verbatim but lets plain text be auto-capitalized', async () => {
    const { fixture, host, field } = await setup('password');

    expect(field.getAttribute('autocapitalize')).toBe('none');
    expect(field.getAttribute('autocorrect')).toBe('off');
    expect(field.getAttribute('spellcheck')).toBe('false');

    host.type.set('text');
    await fixture.whenStable();

    expect(field.hasAttribute('autocapitalize')).toBe(false);
  });
});
