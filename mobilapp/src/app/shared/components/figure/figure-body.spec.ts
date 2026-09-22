import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FigureBandTone, FigureBody, FigureExpression } from './figure-body';
import { computeFigureGeometry } from './figure-geometry';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Host component that uses FigureBody as an attribute on a `<g>` in a real `<svg>`. */
@Component({
  imports: [FigureBody],
  template: `
    <svg viewBox="0 0 200 300">
      <g
        app-figure-body
        [geometry]="geometry()"
        [bandTone]="bandTone()"
        [showDumbbell]="showDumbbell()"
        [showLeftArm]="showLeftArm()"
        [shaded]="shaded()"
        [expression]="expression()"
      />
    </svg>
  `,
})
class Host {
  readonly geometry = signal(computeFigureGeometry(75, 178));
  readonly bandTone = signal<FigureBandTone>('accent');
  readonly showDumbbell = signal(false);
  readonly showLeftArm = signal(true);
  readonly shaded = signal(false);
  readonly expression = signal<Partial<FigureExpression>>({});
}

describe('FigureBody', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const group = root.querySelector('g[app-figure-body]') as SVGGElement;
    const query = (selector: string): SVGElement | null => group.querySelector(selector);
    const queryAll = (selector: string): SVGElement[] =>
      Array.from(group.querySelectorAll(selector));
    return { fixture, host: fixture.componentInstance, group, query, queryAll };
  }

  it('renderer kroppen som SVG-elementer i SVG-navnerummet', async () => {
    const { group, query, queryAll } = await setup();

    expect(group.namespaceURI).toBe(SVG_NAMESPACE);
    expect(group.classList.contains('figure-body')).toBe(true);
    expect(group.classList.contains('figure-body--animated')).toBe(true);

    const body = query('.figure-body__body');
    expect(body?.namespaceURI).toBe(SVG_NAMESPACE);
    expect(body?.tagName.toLowerCase()).toBe('rect');
    expect(body?.getAttribute('x')).toBe('70');
    expect(body?.getAttribute('y')).toBe('166');
    expect(body?.getAttribute('width')).toBe('60');
    expect(body?.getAttribute('height')).toBe('76');
    expect(body?.getAttribute('rx')).toBe('30');

    expect(queryAll('.figure-body__leg')).toHaveLength(2);
    expect(queryAll('.figure-body__shoe')).toHaveLength(2);
    expect(queryAll('.figure-body__arm')).toHaveLength(2);
    expect(query('.figure-body__shadow')?.getAttribute('rx')).toBe('42');
    expect(query('.figure-body__arm')?.getAttribute('d')).toBe('M80 188 Q54 210 62 220.7');
    expect(query('.figure-body__skull')?.getAttribute('cy')).toBe('152');
    expect(query('.figure-body__band')?.getAttribute('y')).toBe('138');
    expect(query('.figure-body__smile')?.getAttribute('d')).toBe('M91 161 Q100 170 109 161');
    expect((query('.figure-body__smile') as SVGElement).style.opacity).toBe('1');
    expect(query('.figure-body__head')?.getAttribute('transform')).toBe('rotate(0 100 152)');
  });

  it('tegner rækkefølgen som designet: skygge, ben, sko, arme, krop, bælte, hoved', async () => {
    const { group } = await setup();
    const order = Array.from(group.children).map((child) => child.getAttribute('class') ?? '');

    expect(order[0]).toContain('figure-body__shadow');
    expect(order[1]).toContain('figure-body__leg');
    expect(order[3]).toContain('figure-body__shoe');
    expect(order[5]).toContain('figure-body__arm');
    expect(order[7]).toContain('figure-body__body');
    expect(order[8]).toContain('figure-body__belt');
    expect(order[9]).toContain('figure-body__head');
  });

  it('slår håndvægt og venstre arm til og fra', async () => {
    const { fixture, host, queryAll } = await setup();

    expect(queryAll('.figure-body__dumbbell-bar')).toHaveLength(0);
    expect(queryAll('.figure-body__dumbbell-cap')).toHaveLength(0);

    host.showDumbbell.set(true);
    host.showLeftArm.set(false);
    await fixture.whenStable();

    expect(queryAll('.figure-body__dumbbell-bar')).toHaveLength(1);
    expect(queryAll('.figure-body__dumbbell-cap')).toHaveLength(2);
    expect(queryAll('.figure-body__dumbbell-bar')[0]?.getAttribute('x')).toBe('118');
    expect(queryAll('.figure-body__dumbbell-bar')[0]?.getAttribute('y')).toBe('217.7');
    expect(queryAll('.figure-body__arm')).toHaveLength(1);
    expect(queryAll('.figure-body__arm')[0]?.getAttribute('d')).toBe('M120 188 Q152 210 138 220.7');
  });

  it('skifter pandebåndets tone og dybdeskygge via BEM-modifiers', async () => {
    const { fixture, host, query, queryAll } = await setup();

    expect(query('.figure-body__band')?.classList.contains('figure-body__band--accent')).toBe(true);

    host.bandTone.set('pink');
    host.shaded.set(true);
    await fixture.whenStable();

    const band = query('.figure-body__band');
    expect(band?.classList.contains('figure-body__band--pink')).toBe(true);
    expect(band?.classList.contains('figure-body__band--accent')).toBe(false);
    expect(queryAll('.figure-body__leg')[0]?.classList.contains('figure-body__leg--dark')).toBe(
      true,
    );
    expect(queryAll('.figure-body__leg')[1]?.classList.contains('figure-body__leg--dark')).toBe(
      false,
    );
    expect(queryAll('.figure-body__arm')[0]?.classList.contains('figure-body__arm--dark')).toBe(
      true,
    );
    expect(queryAll('.figure-body__arm')[1]?.classList.contains('figure-body__arm--light')).toBe(
      true,
    );
  });

  it('bruger geometriens udtryk som standard og lader expression overskrive felt for felt', async () => {
    const { fixture, host, query, queryAll } = await setup();

    const pupils = queryAll('.figure-body__pupil');
    expect(pupils[0]?.getAttribute('cx')).toBe('91');
    expect(pupils[1]?.getAttribute('cx')).toBe('111');
    expect(pupils[0]?.getAttribute('cy')).toBe('151');
    expect(query('.figure-body__cheek')?.getAttribute('r')).toBe('3.5');
    expect((query('.figure-body__eyes') as SVGElement).style.opacity).toBe('1');
    expect((query('.figure-body__eyes-closed') as SVGElement).style.opacity).toBe('0');
    expect((query('.figure-body__brow') as SVGElement).style.opacity).toBe('0');

    host.expression.set({
      pupilOffsetX: 1.6,
      pupilOffsetY: 2.2,
      cheekTone: 'negative-strong',
      cheekRadius: 5,
      browOpacity: 1,
      browRotation: -12,
      smileOpacity: 0,
      mouthRx: 4,
    });
    await fixture.whenStable();

    expect(pupils[0]?.getAttribute('cx')).toBe('92.6');
    expect(pupils[1]?.getAttribute('cx')).toBe('112.6');
    expect(pupils[0]?.getAttribute('cy')).toBe('153.2');
    const cheek = query('.figure-body__cheek');
    expect(cheek?.getAttribute('r')).toBe('5');
    expect(cheek?.classList.contains('figure-body__cheek--negative-strong')).toBe(true);
    const brow = query('.figure-body__brow') as SVGElement;
    expect(brow.style.opacity).toBe('1');
    expect(brow.getAttribute('transform')).toBe('rotate(-12 88 141)');
    expect((query('.figure-body__smile') as SVGElement).style.opacity).toBe('0');
    expect(query('.figure-body__mouth')?.getAttribute('rx')).toBe('4');
    // Fields that aren't set keep the geometry's value.
    expect(query('.figure-body__mouth')?.getAttribute('ry')).toBe('0');
  });

  it('viser lukkede øjne som to buer', async () => {
    const { fixture, host, query, queryAll } = await setup();

    host.expression.set({ eyesClosed: true });
    await fixture.whenStable();

    expect((query('.figure-body__eyes') as SVGElement).style.opacity).toBe('0');
    expect((query('.figure-body__eyes-closed') as SVGElement).style.opacity).toBe('1');
    const lids = queryAll('.figure-body__eyelid');
    expect(lids).toHaveLength(2);
    expect(lids[0]?.getAttribute('d')).toBe('M84 151 q 6 4 12 0');
    expect(lids[1]?.getAttribute('d')).toBe('M104 151 q 6 4 12 0');
  });

  it('drejer hovedet, når figuren dukker sig under loftet', async () => {
    const { fixture, host, query } = await setup();

    host.geometry.set(computeFigureGeometry(80, 250));
    await fixture.whenStable();

    expect(query('.figure-body__head')?.getAttribute('transform')).toBe('rotate(-26 100 116.2)');
  });
});
