import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsSearch } from '@/hooks/useSettingsSearch';

describe('useSettingsSearch', () => {
  it('should return empty array when query is empty', () => {
    const { result } = renderHook(() => useSettingsSearch(''));
    expect(result.current).toEqual([]);
  });

  it('should return empty array when query is only whitespace', () => {
    const { result } = renderHook(() => useSettingsSearch('   '));
    expect(result.current).toEqual([]);
  });

  it('should find settings by title', () => {
    const { result } = renderHook(() => useSettingsSearch('Trello'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.some(r => r.title.includes('Trello'))).toBe(true);
  });

  it('should find settings by description', () => {
    const { result } = renderHook(() => useSettingsSearch('webhook'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.some(r => r.description?.includes('webhook'))).toBe(true);
  });

  it('should find settings by tab name', () => {
    const { result } = renderHook(() => useSettingsSearch('Notifications'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.some(r => r.tab === 'Notifications')).toBe(true);
  });

  it('should find settings by section name', () => {
    const { result } = renderHook(() => useSettingsSearch('Integration'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.some(r => r.section.includes('Integration'))).toBe(true);
  });

  it('should be case insensitive', () => {
    const { result: result1 } = renderHook(() => useSettingsSearch('trello'));
    const { result: result2 } = renderHook(() => useSettingsSearch('TRELLO'));
    const { result: result3 } = renderHook(() => useSettingsSearch('Trello'));

    expect(result1.current.length).toBe(result2.current.length);
    expect(result1.current.length).toBe(result3.current.length);
  });

  it('should prioritize exact title matches', () => {
    const { result } = renderHook(() => useSettingsSearch('Trello Chatbot'));
    const firstResult = result.current[0];
    expect(firstResult.title.toLowerCase()).toContain('trello chatbot');
  });

  it('should prioritize tabs over settings', () => {
    const { result } = renderHook(() => useSettingsSearch('Notifications'));
    const tabResults = result.current.filter(r => r.category === 'tab');
    const settingResults = result.current.filter(r => r.category === 'setting');

    if (tabResults.length > 0 && settingResults.length > 0) {
      expect(result.current.indexOf(tabResults[0])).toBeLessThan(
        result.current.indexOf(settingResults[0])
      );
    }
  });

  it('should return results from all sections', () => {
    const { result } = renderHook(() => useSettingsSearch('settings'));
    const sections = new Set(result.current.map(r => r.section));
    expect(sections.size).toBeGreaterThan(1);
  });

  it('should handle partial word matches', () => {
    const { result } = renderHook(() => useSettingsSearch('cache'));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.some(r => 
      r.title.toLowerCase().includes('cache') || 
      r.description?.toLowerCase().includes('cache')
    )).toBe(true);
  });

  it('should return consistent results for same query', () => {
    const { result: result1 } = renderHook(() => useSettingsSearch('AI'));
    const { result: result2 } = renderHook(() => useSettingsSearch('AI'));

    expect(result1.current.length).toBe(result2.current.length);
    expect(result1.current.map(r => r.title)).toEqual(result2.current.map(r => r.title));
  });
});
