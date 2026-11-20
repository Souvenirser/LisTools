import { parse, stringify } from 'lossless-json';

export function transformJson(source, { action = 'format', indent = 2 } = {}) {
  if (!source.trim()) return { status: 'empty' };
  try {
    let nodeCount = 0;
    const value = parse(source, (_key, value) => {
      nodeCount += 1;
      return value;
    });
    const text = action === 'preserve' ? source : stringify(value, null, action === 'compact' ? undefined : indent);
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(source).length;
    return {
      status: 'ready', text, nodeCount,
      inputBytes,
      outputBytes: action === 'preserve' ? inputBytes : encoder.encode(text).length
    };
  } catch (error) {
    const match = error.message.match(/at position (\d+)/);
    const position = match ? Number(match[1]) : undefined;
    const lines = position === undefined ? [] : source.slice(0, position).split('\n');
    return {
      status: 'error', message: error.message, position,
      line: lines.length || undefined,
      column: lines.length ? lines.at(-1).length + 1 : undefined
    };
  }
}
