/**
 * Reads a resolved design token off the document root.
 *
 * Canvas-rendered surfaces — the ECharts chart, the Leaflet markers — cannot
 * consume CSS custom properties directly the way DOM nodes can, so they read
 * the computed value here. Going through the same variables the stylesheets
 * use is what keeps the chart and the map on the same palette as everything
 * else instead of drifting into hardcoded hexes.
 */
export function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Several tokens in one pass over the computed style. */
export function cssVars<K extends string>(names: Readonly<Record<K, string>>): Record<K, string> {
  const style = getComputedStyle(document.documentElement);
  const result = {} as Record<K, string>;
  for (const [key, name] of Object.entries(names) as [K, string][]) {
    result[key] = style.getPropertyValue(name).trim();
  }
  return result;
}
