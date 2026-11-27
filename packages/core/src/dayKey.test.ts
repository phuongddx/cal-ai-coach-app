declare const process: { env: Record<string, string | undefined> };

import { dayKey } from './dayKey';

// DayKey.swift pins the user's LOCAL calendar day; its `calendar` parameter is
// the time-zone carrier, so the twin's carrier is the `timeZone` argument.
// Each describe block also sets `process.env.TZ` per the brief — the Jest
// worker resolves ICU's zone at spawn, so the jest.config.js pins `TZ` for
// the process and these writes are kept (harmless) for runtimes where the
// environment re-resolves.

const utcInstant = (isoUtc: string) => new Date(isoUtc);

describe('DayKey under Asia/Ho_Chi_Minh', () => {
  const zone = 'Asia/Ho_Chi_Minh';
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('formats the local calendar day of the instant, not the UTC day', () => {
    // 2026-02-01T00:30Z is 07:30 local on Feb 1 in +07:00.
    expect(dayKey(utcInstant('2026-02-01T00:30:00Z'), zone)).toBe('2026-02-01');
    // 2026-03-10T23:30Z is already Mar 11 locally.
    expect(dayKey(utcInstant('2026-03-10T23:30:00Z'), zone)).toBe('2026-03-11');
  });

  it('keeps zero padding for single digit months and days', () => {
    // 2026-01-05T02:00Z is 16:00 on Jan 5 in +14:00 — safely mid-day.
    expect(dayKey(utcInstant('2026-01-05T02:00:00Z'), zone)).toBe('2026-01-05');
  });

  it('keeps an invalid date as an empty string instead of throwing', () => {
    expect(dayKey(new Date('nope'), zone)).toBe('');
  });
});

describe('DayKey under America/Los_Angeles', () => {
  const zone = 'America/Los_Angeles';
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('formats the local calendar day of the instant, not the UTC day', () => {
    // 2026-02-01T00:30Z is still Jan 31 locally in −08:00.
    expect(dayKey(utcInstant('2026-02-01T00:30:00Z'), zone)).toBe('2026-01-31');
    expect(dayKey(utcInstant('2026-03-10T23:30:00Z'), zone)).toBe('2026-03-10');
  });

  it('keeps zero padding for single digit months and days', () => {
    // 2026-01-05T20:00Z is 12:00 on Jan 5 in −08:00.
    expect(dayKey(utcInstant('2026-01-05T20:00:00Z'), zone)).toBe('2026-01-05');
  });

  it('keeps an invalid date as an empty string instead of throwing', () => {
    expect(dayKey(new Date('nope'), zone)).toBe('');
  });
});

describe('DayKey under Pacific/Kiritimati', () => {
  const zone = 'Pacific/Kiritimati';
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('formats the local calendar day of the instant, not the UTC day', () => {
    // UTC+14: 2026-02-01T00:30Z is 14:30 on Feb 1 — the earliest zone on earth.
    expect(dayKey(utcInstant('2026-02-01T00:30:00Z'), zone)).toBe('2026-02-01');
    expect(dayKey(utcInstant('2026-03-10T23:30:00Z'), zone)).toBe('2026-03-11');
  });

  it('keeps zero padding for single digit months and days', () => {
    // 2026-01-05T02:00Z is 16:00 on Jan 5 in +14:00 — safely mid-day.
    expect(dayKey(utcInstant('2026-01-05T02:00:00Z'), zone)).toBe('2026-01-05');
  });

  it('keeps an invalid date as an empty string instead of throwing', () => {
    expect(dayKey(new Date('nope'), zone)).toBe('');
  });
});

describe('DayKey with the process zone (the Swift `.current` default)', () => {
  it('matches the explicit zone of the process', () => {
    const instant = utcInstant('2026-02-01T00:30:00Z');
    expect(dayKey(instant)).toBe(dayKey(instant, process.env.TZ));
  });

  it('keeps an invalid date as an empty string instead of throwing', () => {
    expect(dayKey(new Date('nope'))).toBe('');
  });
});
