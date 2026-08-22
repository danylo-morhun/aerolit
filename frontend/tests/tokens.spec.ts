import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The design-token set, checked against the code that reads it.
 *
 * A misspelled custom property is the quietest failure in CSS: `var(--typo)`
 * resolves to nothing, the declaration is dropped, and the element renders
 * without the background it was supposed to have. That is exactly what happened
 * here — three of the four KPI tiles referenced `--aq-status-*-bg` tokens that
 * were never declared, so their icon plates were invisible while the fourth,
 * which used a token that did exist, looked like the odd one out.
 *
 * Three assertions make the token layer verifiable rather than assumed: a name
 * the base `:root` block does not declare fails the build, a token nothing reads
 * fails it too, and so does a role that exists only inside the dark block — the
 * dark theme may re-point a token, never introduce one, or the light theme is
 * the one rendering without it.
 */

const SRC = join(import.meta.dirname, '../src');
const TOKENS_FILE = join(SRC, 'theme/tokens.css');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.(vue|ts|css)$/.test(path) ? [path] : [];
  });
}

const tokensCss = readFileSync(TOKENS_FILE, 'utf8');

/** Declarations inside the `.dark { … }` block, and everything before it. */
const darkBlockStart = tokensCss.indexOf('.dark {');
const declarationsIn = (css: string): Set<string> =>
  new Set([...css.matchAll(/^\s*(--aq-[a-z0-9-]+)\s*:/gm)].map((match) => match[1]!));

const declaredAtRoot = declarationsIn(tokensCss.slice(0, darkBlockStart));
const declaredInDark = declarationsIn(tokensCss.slice(darkBlockStart));
const declared = new Set([...declaredAtRoot, ...declaredInDark]);

/**
 * Two ways a token is consumed: `var(--aq-x)` from a stylesheet, and the bare
 * name as a string from `cssVar()` — the chart and the map draw to a canvas and
 * cannot resolve custom properties themselves. Both count as use.
 */
const TOKEN_USE = /(?:var\(\s*|['"])(--aq-[a-z0-9-]+)/g;

const referenced = new Map<string, string[]>();
for (const file of filesUnder(SRC)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(TOKEN_USE)) {
    const name = match[1]!;
    referenced.set(name, [...(referenced.get(name) ?? []), file.slice(SRC.length + 1)]);
  }
}

describe('design tokens', () => {
  it('declares every token the app reads, in the base block', () => {
    const missing = [...referenced.entries()]
      .filter(([name]) => !declaredAtRoot.has(name))
      .map(([name, files]) => `${name} (used in ${[...new Set(files)].join(', ')})`);

    expect(missing).toEqual([]);
  });

  it('carries no token nothing reads', () => {
    // Self-references inside tokens.css (a semantic role pointing at a
    // primitive) count as use; only names that reach neither are dead.
    const usedInTokens = new Set([...tokensCss.matchAll(TOKEN_USE)].map((match) => match[1]!));

    const unused = [...declared].filter((name) => !referenced.has(name) && !usedInTokens.has(name));

    expect(unused).toEqual([]);
  });

  it('lets the dark theme re-point roles, never invent them', () => {
    const darkOnly = [...declaredInDark].filter((name) => !declaredAtRoot.has(name));

    expect(darkOnly).toEqual([]);
  });
});
