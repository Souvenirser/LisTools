import { t, onLanguageChange } from './i18n.js';
import './support.css';

function translate() {
  document.title=`${t('support.title')} · LisTools`;
  document.getElementById('support-qr').alt=t('support.qrAlt');
}
onLanguageChange(translate);translate();
