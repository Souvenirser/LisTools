import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { timestampToTime, timeToTimestamp, getDeviceTimeZone } from '../src/tools/timestamp/core.js';

test('零时间戳按所选时区展示，秒与毫秒均为零', () => {
  const utc = timestampToTime('0', 'auto', 'UTC');
  assert.equal(utc.status, 'ready');
  assert.equal(utc.localTime, '1970-01-01 00:00:00.000');
  assert.equal(utc.utcTime, '1970-01-01T00:00:00.000Z');
  assert.equal(utc.seconds, '0');
  assert.equal(utc.milliseconds, '0');
  const shanghai = timestampToTime('0', 'auto', 'Asia/Shanghai');
  assert.equal(shanghai.localTime, '1970-01-01 08:00:00.000');
  assert.equal(shanghai.isoTime, '1970-01-01T08:00:00.000+08:00');
  assert.equal(shanghai.offset, '+08:00');
});

test('自动识别十位秒和十三位毫秒，手动单位支持其他长度', () => {
  for (const value of ['1704067200', '+1704067200', ' 1704067200000 ']) {
    assert.equal(timestampToTime(value, 'auto', 'UTC').milliseconds, '1704067200000');
  }
  assert.equal(timestampToTime('-1704067200', 'auto', 'UTC').seconds, '-1704067200');
  assert.equal(timestampToTime('1', 'seconds', 'UTC').milliseconds, '1000');
  assert.equal(timestampToTime('1', 'milliseconds', 'UTC').milliseconds, '1');
  assert.match(timestampToTime('123', 'auto', 'UTC').message, /选择.*单位/);
});

test('毫秒往返保留三位精度，负时间戳的整数秒向下取整', () => {
  const result = timestampToTime('1704067200123', 'milliseconds', 'Asia/Shanghai');
  assert.equal(result.localTime, '2024-01-01 08:00:00.123');
  assert.equal(result.seconds, '1704067200');
  assert.equal(timeToTimestamp(result.localTime, 'Asia/Shanghai').milliseconds, '1704067200123');
  const negative = timestampToTime('-1', 'milliseconds', 'UTC');
  assert.equal(negative.localTime, '1969-12-31 23:59:59.999');
  assert.equal(negative.seconds, '-1');
  assert.equal(timeToTimestamp(negative.isoTime, 'Asia/Shanghai').milliseconds, '-1');
});

test('偏移按目标日期计算，覆盖半小时、四十五分钟和纽约夏冬时间', () => {
  assert.equal(timestampToTime('1704067200', 'seconds', 'Asia/Kathmandu').localTime, '2024-01-01 05:45:00.000');
  assert.equal(timestampToTime('1704067200', 'seconds', 'Asia/Kolkata').offset, '+05:30');
  assert.equal(timeToTimestamp('2024-01-01 12:00:00', 'America/New_York').offset, '-05:00');
  assert.equal(timeToTimestamp('2024-07-01 12:00:00', 'America/New_York').offset, '-04:00');
});

test('无偏移输入按所选时区，显式偏移和 Z 确定绝对时间点', () => {
  assert.equal(timeToTimestamp('2024-01-01 08:00:00', 'Asia/Shanghai').milliseconds, '1704067200000');
  for (const value of ['2024-01-01T00:00:00Z', '2024-01-01T08:00:00+08:00']) {
    for (const zone of ['Asia/Shanghai', 'America/New_York', 'UTC']) {
      const result = timeToTimestamp(value, zone);
      assert.equal(result.milliseconds, '1704067200000');
      assert.equal(result.hasOffset, true);
    }
  }
  assert.equal(timeToTimestamp('2024-01-01T08:00:00.1', 'Asia/Shanghai').milliseconds, '1704067200100');
  assert.equal(timeToTimestamp('2024-01-01 08:00:00.12', 'Asia/Shanghai').milliseconds, '1704067200120');
});

test('历史秒级时区偏移原样显示，ISO 往返不能因偏移舍入改变时间戳', () => {
  for (const [zone, isoTime, offset] of [
    ['Asia/Shanghai', '1900-01-01T08:05:43.000+08:05:43', '+08:05:43'],
    ['Europe/Paris', '1900-01-01T00:09:21.000+00:09:21', '+00:09:21']
  ]) {
    const result = timestampToTime('-2208988800000', 'milliseconds', zone);
    assert.equal(result.isoTime, isoTime);
    assert.equal(result.offset, offset);
    assert.equal(timeToTimestamp(result.isoTime, zone).milliseconds, '-2208988800000');
  }
});

test('夏令时跳过和重复时刻报错，显式偏移可区分重复时刻', () => {
  for (const value of ['2024-03-10 02:30:00', '2024-11-03 01:30:00']) {
    const result = timeToTimestamp(value, 'America/New_York');
    assert.equal(result.status, 'error');
    assert.match(result.message, /夏令时|时区切换/);
    assert.equal(result.milliseconds, undefined);
  }
  assert.equal(timeToTimestamp('2024-11-03T01:30:00-04:00', 'America/New_York').utcTime, '2024-11-03T05:30:00.000Z');
  assert.equal(timeToTimestamp('2024-11-03T01:30:00-05:00', 'America/New_York').utcTime, '2024-11-03T06:30:00.000Z');
});

test('严格拒绝非法日期、闰秒、超出毫秒精度和不明确的日期格式', () => {
  for (const value of ['2024-02-30 12:00:00', '2023-02-29 12:00:00', '2024-01-01 24:00:00', '2024-01-01 00:00:60', '2024-01-01T00:00:00.1234Z', '01/02/2024', '2024-01-01', '2024-01-01T00:00:00+99:00']) {
    const result = timeToTimestamp(value, 'UTC');
    assert.equal(result.status, 'error', value);
    assert.equal(result.milliseconds, undefined);
  }
  assert.equal(timeToTimestamp('2024-02-29 12:00:00', 'UTC').status, 'ready');
});

test('空输入不产生时间零，非法数字和超范围输入不返回结果', () => {
  assert.deepEqual(timestampToTime(' \n ', 'auto', 'UTC'), { status: 'empty' });
  assert.deepEqual(timeToTimestamp(' ', 'UTC'), { status: 'empty' });
  for (const value of ['1.2', '1e3', 'Infinity', '123abc', '1,000', '9007199254740993', '8640000000000001']) {
    const result = timestampToTime(value, 'milliseconds', 'UTC');
    assert.equal(result.status, 'error', value);
    assert.equal(result.localTime, undefined);
  }
  assert.equal(timestampToTime('8640000000000000', 'seconds', 'UTC').status, 'error');
});

test('无效时区报错，不能把未知时区静默转换为本地时区', () => {
  for (const zone of ['Mars/Olympus', '', '+08:00']) {
    assert.equal(timestampToTime('0', 'auto', zone).status, 'error');
    assert.equal(timeToTimestamp('2024-01-01T00:00:00Z', zone).status, 'error');
  }
});

test('设备时区读取失败回退 UTC 并标记提示', () => {
  assert.equal(getDeviceTimeZone().fallback, false);
  mock.method(Intl, 'DateTimeFormat', () => { throw new Error('unavailable'); });
  try { assert.deepEqual(getDeviceTimeZone(), { timeZone: 'UTC', fallback: true }); }
  finally { mock.restoreAll(); }
});

test('owned conversion errors include stable localization codes', () => {
  assert.equal(timestampToTime('123', 'auto', 'UTC').code, 'timestamp.unknownUnit');
  assert.equal(timeToTimestamp('2024-02-30 12:00:00', 'UTC').code, 'timestamp.invalidDate');
  assert.equal(timeToTimestamp('2024-11-03 01:30:00', 'America/New_York').code, 'timestamp.ambiguous');
});
