import { describe, expect, it } from 'vitest';
import { filterSuggestions, findSuggestion, normalizeSuggestionText } from './autocomplete';

describe('autocomplete helpers', () => {
  it('normalizes text to lowercase trimmed string', () => {
    expect(normalizeSuggestionText('  FooBar  ')).toBe('foobar');
  });

  it('finds the first suggestion that starts with the current value', () => {
    expect(findSuggestion(['apple', 'apricot', 'banana'], 'ap')).toBe('apple');
  });

  it('returns undefined when there is no suggestion', () => {
    expect(findSuggestion(['apple', 'banana'], 'orange')).toBeUndefined();
  });

  it('filters suggestions using a prefix and limits the result count', () => {
    expect(filterSuggestions(['apple', 'apricot', 'apartment', 'banana'], 'ap', undefined, 2)).toEqual([
      'apple',
      'apricot',
    ]);
  });

  it('ignores exact matches when filtering suggestions', () => {
    expect(filterSuggestions(['apple', 'appletree', 'apricot'], 'apple')).toEqual(['appletree']);
  });
});
