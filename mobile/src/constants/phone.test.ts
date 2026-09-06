import { describe, expect, it } from 'vitest';

import { GABON_FLAG, GABON_PREFIX, isGabonPhoneValid, normalizeGabonPhone } from './phone';

describe('normalizeGabonPhone', () => {
  it('keeps a valid 9-digit number starting with 0', () => {
    expect(normalizeGabonPhone('077724499')).toBe('077724499');
    expect(normalizeGabonPhone('062951317')).toBe('062951317');
  });

  it('adds the leading 0 when the user typed it without', () => {
    expect(normalizeGabonPhone('77724499')).toBe('077724499');
    expect(normalizeGabonPhone('62951317')).toBe('062951317');
  });

  it('drops the +241 country code when pasted', () => {
    expect(normalizeGabonPhone('+241 77 72 44 99')).toBe('077724499');
    expect(normalizeGabonPhone('241077724499')).toBe('077724499');
    expect(normalizeGabonPhone('24177724499')).toBe('077724499');
  });

  it('strips spaces, dashes and other symbols', () => {
    expect(normalizeGabonPhone('077-72-44-99')).toBe('077724499');
    expect(normalizeGabonPhone('0 77 72 44 99')).toBe('077724499');
  });

  it('caps input at 9 digits', () => {
    expect(normalizeGabonPhone('0777244999')).toBe('077724499');
  });

  it('keeps a partial entry as-is while the user is typing', () => {
    expect(normalizeGabonPhone('062')).toBe('062');
    expect(normalizeGabonPhone('06295131')).toBe('06295131');
    expect(normalizeGabonPhone('629')).toBe('629');
  });
});

describe('isGabonPhoneValid', () => {
  it('accepts a full 9-digit number starting with 0', () => {
    expect(isGabonPhoneValid('077724499')).toBe(true);
    expect(isGabonPhoneValid('062951317')).toBe(true);
  });

  it('rejects incomplete or badly shaped entries', () => {
    expect(isGabonPhoneValid('')).toBe(false);
    expect(isGabonPhoneValid('062')).toBe(false);
    expect(isGabonPhoneValid('62951317')).toBe(false);
    expect(isGabonPhoneValid('0777244999')).toBe(false);
  });
});

describe('phone constants', () => {
  it('exposes the Gabon flag and prefix', () => {
    expect(GABON_FLAG).toBe('🇬🇦');
    expect(GABON_PREFIX).toBe('+241');
  });
});