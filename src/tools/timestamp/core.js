import { Temporal } from 'temporal-polyfill/implementation';

function fail(code, message) { throw Object.assign(new RangeError(message), { code: `timestamp.${code}` }); }

function validateTimeZone(timeZone) {
  try {
    if (!timeZone || /^[+-]/.test(timeZone)) throw new RangeError();
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    fail('invalidZone', '请选择有效的 IANA 时区，例如 Asia/Shanghai 或 UTC。');
  }
}

function formatInstant(instant, timeZone) {
  const zoned = instant.toZonedDateTimeISO(timeZone);
  const milliseconds = instant.epochMilliseconds;
  const localISO = zoned.toPlainDateTime().toString({ fractionalSecondDigits: 3 });
  return {
    status: 'ready',
    seconds: String(Math.floor(milliseconds / 1000)),
    milliseconds: String(milliseconds),
    localTime: localISO.replace('T', ' '),
    utcTime: instant.toString({ fractionalSecondDigits: 3 }),
    isoTime: `${localISO}${zoned.offset}`,
    timeZone, offset: zoned.offset
  };
}

export function timestampToTime(value, unit, timeZone) {
  const text = value.trim();
  if (!text) return { status: 'empty' };
  try {
    validateTimeZone(timeZone);
    if (!/^[+-]?\d+$/.test(text)) fail('integer', '请输入十进制整数时间戳，不支持小数或科学计数法。');
    const number = Number(text);
    if (unit === 'auto') {
      const length = text.replace(/^[+-]/, '').length;
      if (number === 0 || length === 10) unit = 'seconds';
      else if (length === 13) unit = 'milliseconds';
      else fail('unknownUnit', '无法确定时间戳单位，请手动选择秒或毫秒单位。');
    }
    if (unit !== 'seconds' && unit !== 'milliseconds') fail('invalidUnit', '请选择秒或毫秒单位。');
    const milliseconds = unit === 'seconds' ? number * 1000 : number;
    if (!Number.isSafeInteger(number) || !Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > 8640000000000000) {
      fail('range', '时间戳超出支持范围，请检查数值和单位。');
    }
    return { ...formatInstant(Temporal.Instant.fromEpochMilliseconds(milliseconds), timeZone), unit };
  } catch (error) {
    return { status: 'error', message: error.message, code: error.code || 'timestamp.range' };
  }
}

export function timeToTimestamp(value, timeZone) {
  const text = value.trim();
  if (!text) return { status: 'empty' };
  try {
    validateTimeZone(timeZone);
    const match = /^((?:\d{4}|[+-]\d{6})-\d{2}-\d{2})[T ](\d{2}:\d{2}:[0-5]\d)(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}(?::[0-5]\d)?)?$/.exec(text);
    if (!match) fail('format', '请输入 YYYY-MM-DD HH:mm:ss，可带最多三位小数秒，或带 Z / ±HH:mm 偏移的 ISO 时间。');
    const normalized = text.replace(' ', 'T');
    const hasOffset = Boolean(match[4]);
    let instant;
    if (hasOffset) {
      try { instant = Temporal.Instant.from(normalized); }
      catch { fail('invalidOffset', '日期时间或 UTC 偏移无效，请检查年月日、时分秒和偏移。'); }
    } else {
      let plain;
      try { plain = Temporal.PlainDateTime.from(normalized, { overflow: 'reject' }); }
      catch { fail('invalidDate', '日期时间无效，请检查年月日和时分秒。'); }
      try { instant = plain.toZonedDateTime(timeZone, { disambiguation: 'reject' }).toInstant(); }
      catch { fail('ambiguous', '该当地时间因夏令时或时区切换不存在或重复，请修改时间；重复时可补充明确的 UTC 偏移，例如 -04:00 或 -05:00。'); }
    }
    return { ...formatInstant(instant, timeZone), hasOffset };
  } catch (error) {
    return { status: 'error', message: error.message, code: error.code || 'timestamp.range' };
  }
}

export function getDeviceTimeZone() {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    validateTimeZone(timeZone);
    return { timeZone, fallback: false };
  } catch {
    return { timeZone: 'UTC', fallback: true };
  }
}
