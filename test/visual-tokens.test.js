import test from 'node:test';
import assert from 'node:assert/strict';
import { slate, blue, teal, green, amber, red } from '@radix-ui/colors';
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b) { const values = [luminance(a),luminance(b)].sort((x,y)=>y-x); return (values[0]+.05)/(values[1]+.05); }
test('semantic text, primary actions and status colors meet WCAG AA', () => {
  for (const [name,foreground,background] of [
    ['body',slate.slate12,slate.slate2],['helper',slate.slate11,'#ffffff'],['primary','#ffffff',blue.blue11],['result',teal.teal12,teal.teal2],
    ['success',green.green12,green.green3],['error',red.red12,red.red3],['warning',amber.amber12,amber.amber3]
  ]) assert.ok(contrast(foreground,background) >= 4.5, `${name}: ${contrast(foreground,background)}`);
});
