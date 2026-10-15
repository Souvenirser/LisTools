import { transformJson } from './core.js';

self.onmessage = ({ data: { source, action, indent } }) => {
  self.postMessage(transformJson(source, { action, indent }));
};
