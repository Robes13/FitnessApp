import { Injectable } from '@angular/core';

const RADIX_BASE36 = 36;

/** Genererer unikke id'er til lokale poster: `<prefix>-<tid i base36>-<løbenummer>`. */
@Injectable({ providedIn: 'root' })
export class IdService {
  private counter = 0;

  next(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${Date.now().toString(RADIX_BASE36)}-${this.counter}`;
  }
}
