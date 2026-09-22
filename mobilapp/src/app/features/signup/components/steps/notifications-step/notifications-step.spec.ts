import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { NotificationsStep } from './notifications-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('NotificationsStep', () => {
  let fixture: ComponentFixture<NotificationsStep>;
  let element: HTMLElement;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), SignupStateService],
    });
    fixture = TestBed.createComponent(NotificationsStep);
    element = fixture.nativeElement as HTMLElement;
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function choices(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.ui-segmented-control__option'));
  }

  function caption(): string {
    return element.querySelector('.notifications-step__caption')?.textContent?.trim() ?? '';
  }

  it('viser overskriften og de to svar', () => {
    expect(element.textContent).toContain('Et lille');
    expect(element.textContent).toContain('puf');
    expect(choices().map((choice) => choice.textContent?.trim())).toEqual(['Ja tak', 'Nej tak']);
  });

  it('beder om et svar, når intet er valgt', () => {
    state.notifications.set(null);
    fixture.detectChanges();

    expect(caption()).toBe('Vælg om vi må sende dig påmindelser – du kan altid skifte i Profil.');
  });

  it('lader klokken ringe ved "Ja tak"', () => {
    choices()[0]?.click();
    fixture.detectChanges();

    expect(state.notifications()).toBe(true);
    expect(caption()).toBe(
      'Vi minder dig om vejning om morgenen, måltider i løbet af dagen og din ugestatus.',
    );
    expect(element.querySelector('.notifications-step__bell--ringing')).not.toBeNull();
  });

  it('slukker klokken og lukker øjnene ved "Nej tak"', () => {
    choices()[1]?.click();
    fixture.detectChanges();

    expect(state.notifications()).toBe(false);
    expect(caption()).toBe('Ingen påmindelser. Du finder alt i appen, når du selv åbner den.');
    expect(element.querySelector('.notifications-step__bell--ringing')).toBeNull();
    expect(element.querySelector('.notifications-step__snore')?.textContent?.trim()).toBe('z z z');
    expect(element.querySelector<SVGElement>('.figure-body__eyes-closed')?.style.opacity).toBe('1');
  });

  it('flytter klokken med figurens hoved', () => {
    const before = element.querySelector('.notifications-step__bell g')?.getAttribute('transform');

    state.heightCm.set(210);
    fixture.detectChanges();

    const after = element.querySelector('.notifications-step__bell g')?.getAttribute('transform');
    expect(after).not.toBe(before);
  });
});
