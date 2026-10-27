import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects, toCsv } from './csv';

describe('csv helpers', () => {
  it('serialises rows with headers and escapes special characters', () => {
    const csv = toCsv([
      { name: 'Espresso', notes: 'Strong, dark', price: 2.5 },
      { name: 'Quote "Coffee"', notes: 'Line\r\nbreak', price: 3 },
    ]);

    expect(csv.split('\r\n')[0]).toBe('name,notes,price');
    expect(csv).toContain('"Strong, dark"');
    expect(csv).toContain('"Quote ""Coffee"""');
    expect(csv).toContain('"Line\r\nbreak"');
  });

  it('honours an explicit column order and renders nullish values as empty', () => {
    const csv = toCsv([{ b: 2, a: 'x', c: null, d: undefined }], ['a', 'b', 'c', 'd']);
    expect(csv).toBe('a,b,c,d\r\nx,2,,');
  });

  it('returns an empty string when there are no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('parses quoted fields, escaped quotes and CRLF line endings', () => {
    const rows = parseCsv(
      '\uFEFFname,notes\r\n"Espresso","Strong, dark"\r\n"Quote ""Coffee""","line1\nline2"\r\n',
    );
    expect(rows).toEqual([
      ['name', 'notes'],
      ['Espresso', 'Strong, dark'],
      ['Quote "Coffee"', 'line1\nline2'],
    ]);
  });

  it('skips blank lines and trims unquoted values', () => {
    expect(parseCsv('a, b \r\n\r\n1,2\r\n,,\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('maps rows to objects with normalised lower-case headers', () => {
    const objects = parseCsvObjects(' SKU , Name \nABC-1, Coffee \nABC-2, Tea ');
    expect(objects).toEqual([
      { sku: 'ABC-1', name: 'Coffee' },
      { sku: 'ABC-2', name: 'Tea' },
    ]);
    expect(parseCsvObjects('only-header')).toEqual([]);
    expect(parseCsvObjects('')).toEqual([]);
  });

  it('round-trips awkward values through serialisation and parsing', () => {
    const source = [{ name: 'A "quoted" name', note: 'comma, newline\nand more' }];
    const parsed = parseCsvObjects(toCsv(source));
    expect(parsed).toEqual([{ name: 'A "quoted" name', note: 'comma, newline\nand more' }]);
  });
});
