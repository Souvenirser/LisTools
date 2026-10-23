import {t} from '../../i18n-runtime.js';
// Stable keys keep the original bilingual metadata API available to callers.
import {textKey} from './label-key.js';
export {textKey} from './label-key.js';
export const textLabel=(original,english=original)=>t(textKey(english),{defaultValue:english});
