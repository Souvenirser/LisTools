import { generatePasswords, generatePassphrases } from './core.js';

export function createPasswordController({wordlist, onChange}) {
  let values = [], visible = false, error;
  const render = () => onChange({values, visible, error});
  return {
    generate(mode, options) {
      values = []; visible = false; error = undefined;
      try { values = mode === 'passphrase' ? generatePassphrases(wordlist, options) : generatePasswords(options); }
      catch (failure) { error = failure.code || 'generation'; }
      render();
    },
    invalidate() { values = []; error = undefined; render(); },
    clear() { values = []; visible = false; error = undefined; render(); },
    toggleVisibility() { visible = !visible; render(); },
    text(index) { return index === undefined ? values.join('\n') : values[index] || ''; }
  };
}
