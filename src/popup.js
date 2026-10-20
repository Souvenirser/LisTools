import {t,language,languages} from './i18n-runtime.js';
import {mountToolMenu} from './tools/shared/menu.js';
import './popup.css';

document.documentElement.lang=language();
document.documentElement.dir=languages.find(item=>item.code===language()).dir;
document.getElementById('popup-caption').textContent=t('common.tools');
mountToolMenu(document.getElementById('popup-menu'),{popup:true}).open();
