import { TestBed } from '@angular/core/testing';
import { IdService } from './id';

describe('IdService', () => {
  it('prefixes ids and never repeats them', () => {
    TestBed.configureTestingModule({});
    const ids = TestBed.inject(IdService);

    const first = ids.next('log');
    const second = ids.next('log');

    expect(first).toMatch(/^log-[0-9a-z]+-1$/);
    expect(second).toMatch(/^log-[0-9a-z]+-2$/);
    expect(first).not.toBe(second);
  });
});
