/**
 * check-theme.mjs
 * ---------------
 * Fails if a raw colour literal appears anywhere outside src/theme/.
 *
 * Why this exists: the app drifted to 166 hardcoded hex values - mostly
 * Tailwind's default palette (#059669 emerald, #0284C7 sky, #F1F5F9 slate)
 * - because screens reached for a colour the theme did not offer. They were
 * migrated to tokens on 30 Aug 2026. This script stops it happening again.
 *
 * If you need a colour that isn't in the theme: add it to src/theme/colors.ts
 * with a name that says what it's FOR, then use the token. Don't inline it.
 *
 * Run:  npm run check:theme
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');
const THEME_DIR = path.join(SRC, 'theme');

/** Files allowed to contain literal colours, with the reason why. */
const ALLOW = {
  'components/GoogleMark.tsx': "Google's official brand colours - must not be themed",
};

const HEX = /(['"])(#[0-9A-Fa-f]{3,8})\1/g;
const RGBA = /(['"])(rgba?\([^)]*\))\1/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (p === THEME_DIR || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const offences = [];
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (ALLOW[rel]) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
    for (const re of [HEX, RGBA]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) offences.push({ rel, line: i + 1, value: m[2] });
    }
  });
}

if (offences.length === 0) {
  console.log('check:theme  OK - every colour comes from src/theme/');
  process.exit(0);
}

console.error(`check:theme  FAILED - ${offences.length} raw colour literal(s) outside src/theme/\n`);
for (const o of offences) console.error(`  ${o.rel}:${o.line}  ${o.value}`);
console.error('\nAdd the colour to src/theme/colors.ts with a descriptive name, then use the token.');
process.exit(1);
