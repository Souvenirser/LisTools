export function bindFileDrop(target, { onFile, onFiles, allowMultiple = () => false, onActive, onError, multipleMessage = '请一次拖入一个 JSON 文件' }) {
  let depth = 0;
  const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')
    || event.dataTransfer?.files.length > 0;
  function reset() {
    depth = 0;
    onActive(false);
  }
  target.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    onActive(true);
  }, true);
  target.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, true);
  target.addEventListener('dragleave', () => {
    if (depth > 0 && --depth === 0) onActive(false);
  }, true);
  target.addEventListener('dragend', () => {
    if (depth) reset();
  }, true);
  target.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    reset();
    const files = event.dataTransfer.files;
    if (allowMultiple()) {
      onFiles(Array.from(files), event);
      return;
    }
    if (files.length !== 1) {
      onError(multipleMessage);
      return;
    }
    onFile(files[0], event);
  }, true);
}
