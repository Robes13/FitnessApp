import { Gender } from '../../../core/models/profile';
import { FigureBandTone } from './figure-body';

/**
 * Designets `bandColor`: figurens pandebånd farves efter det valgte køn og bruges på alle de
 * skærme, der viser figuren (fødselsdag, vægt, højde, aktivitet, notifikationer,
 * mål og opsummering).
 *
 * Kvinde → pink, andet → hvidt, mand eller ikke valgt → orange.
 */
export function bandToneForGender(gender: Gender | null): FigureBandTone {
  switch (gender) {
    case 'kvinde':
      return 'pink';
    case 'andet':
      return 'white';
    default:
      return 'accent';
  }
}
