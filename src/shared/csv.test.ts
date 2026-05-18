import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeCSVField, parseCSVLine, today } from './csv';

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current date in YYYY-MM-DD format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));
    expect(today()).toBe('2026-03-15');
  });

  it('returns a string matching the ISO date pattern', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zero-pads single-digit months and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T00:00:00.000Z'));
    expect(today()).toBe('2026-01-05');
  });
});

describe('parseCSVLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns a single-element array when there are no commas', () => {
    expect(parseCSVLine('hello')).toEqual(['hello']);
  });

  it('returns an array with one empty string for an empty line', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCSVLine('"hello, world",foo')).toEqual(['hello, world', 'foo']);
  });

  it('handles escaped double-quotes inside a quoted field', () => {
    expect(parseCSVLine('"say ""hi""",end')).toEqual(['say "hi"', 'end']);
  });

  it('handles a quoted field that spans the whole line', () => {
    expect(parseCSVLine('"only field"')).toEqual(['only field']);
  });

  it('handles adjacent empty fields', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles a trailing comma', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles a leading comma', () => {
    expect(parseCSVLine(',a,b')).toEqual(['', 'a', 'b']);
  });

  it('does not treat commas outside quotes as field separators', () => {
    expect(parseCSVLine('"a,b,c"')).toEqual(['a,b,c']);
  });

  it('handles a quoted field followed by an unquoted field', () => {
    expect(parseCSVLine('"quoted",unquoted')).toEqual(['quoted', 'unquoted']);
  });

  it('handles numeric-looking values as strings', () => {
    expect(parseCSVLine('1,2,3')).toEqual(['1', '2', '3']);
  });
});

describe('escapeCSVField', () => {
  it('wraps a plain string in double quotes', () => {
    expect(escapeCSVField('hello')).toBe('"hello"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it('preserves commas inside the quoted field', () => {
    expect(escapeCSVField('a,b,c')).toBe('"a,b,c"');
  });

  it('wraps an empty string in double quotes', () => {
    expect(escapeCSVField('')).toBe('""');
  });

  it('converts a number to a quoted string', () => {
    expect(escapeCSVField(42)).toBe('"42"');
  });

  it('converts null to an empty quoted string', () => {
    expect(escapeCSVField(null)).toBe('""');
  });

  it('converts undefined to an empty quoted string', () => {
    expect(escapeCSVField(undefined)).toBe('""');
  });

  it('is round-trip compatible with parseCSVLine for single fields', () => {
    const value = 'hello, "world"';
    const escaped = escapeCSVField(value);
    expect(parseCSVLine(escaped)).toEqual([value]);
  });

  it('is round-trip compatible with parseCSVLine for multi-field lines', () => {
    const fields = ['first', 'sec,ond', 'thi"rd'];
    const line = fields.map(escapeCSVField).join(',');
    expect(parseCSVLine(line)).toEqual(fields);
  });
});
