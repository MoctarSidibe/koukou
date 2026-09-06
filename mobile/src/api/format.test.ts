import { describe, it, expect } from 'vitest';

import { givenName, initials } from './format';

describe('format', () => {
  it('initials : deux premières initiales en majuscules', () => {
    expect(initials('M. Joseph Ndong')).toBe('MJ');
    expect(initials('Jean-Marc Ondo')).toBe('JO');
    expect(initials('Binta')).toBe('B');
    expect(initials('  ')).toBe('');
  });

  it('givenName : ignore la civilité', () => {
    expect(givenName('M. Joseph Ndong')).toBe('Joseph');
    expect(givenName('Mme Binta Ako')).toBe('Binta');
    expect(givenName('Joseph Ndong')).toBe('Joseph');
    expect(givenName('Binta')).toBe('Binta');
  });
});