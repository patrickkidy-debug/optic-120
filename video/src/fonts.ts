import { loadFont as loadManrope } from '@remotion/google-fonts/Manrope';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const { fontFamily: manropeFamily } = loadManrope('normal', { weights: ['700', '800'] });
const { fontFamily: interFamily } = loadInter('normal', { weights: ['400', '500', '600', '700'] });

export const manrope = manropeFamily;
export const inter = interFamily;
