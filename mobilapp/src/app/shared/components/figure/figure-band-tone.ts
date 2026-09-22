import { Gender } from '../../../core/models/profile';
import { FigureBandTone } from './figure-body';

/**
 * Design's `bandColor`: the figure's headband is colored according to the selected gender and is
 * used on all the screens that show the figure (birthday, weight, height, activity,
 * notifications, goal and summary).
 *
 * Woman → pink, other → white, man or not selected → orange.
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
