const fs = require('fs');
const path = require('path');
const keys = new Set(
  JSON.parse(fs.readFileSync('apps/web/src/lib/translations/keys.json', 'utf8')),
);
const roots = [
  'apps/web/src/pages',
  'apps/web/src/components',
  'apps/web/src/features',
  'apps/web/src/hooks',
];
const ignore =
  /^[\s'"`]*(?:[a-z0-9-]+\s+){0,6}[a-z0-9-]+$|^[A-Z_]+$|^#[0-9a-f]{3,8}$|^https?:|^\/|^[a-z]+\.[a-z]+$|^[@./]/i;
const out = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.tsx') && !p.includes('.test.')) scan(p);
  }
}
function scan(p) {
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/^\s*(import|export \*|type |interface )/.test(line)) return;
    if (
      /className|(?:from|to|href|src|id|htmlFor|autoComplete|name|type|value|key|variant|tone|size|icon|method|path|role)=/.test(
        line,
      )
    )
      return;
    // JSX text nodes
    const jsx = line.match(/>([^<>{}]{3,})</);
    if (jsx) {
      const txt = jsx[1].trim();
      if (/[A-Za-z]{3}/.test(txt) && !keys.has(txt) && !/^[\d\s.,%€$·—–-]+$/.test(txt))
        out.push(`JSX ${p}:${i + 1}: ${txt}`);
    }
    // string literals that are sentences
    const re = /'([^']{4,})'|"([^"]{4,})"/g;
    let m;
    while ((m = re.exec(line))) {
      const s = m[1] || m[2];
      if (keys.has(s)) continue;
      if (!/^[A-Z]/.test(s)) continue;
      if (/^[A-Za-z0-9_-]+$/.test(s) && s.length < 12) continue;
      if (/\b[A-Z][a-z]+[A-Z]/.test(s)) continue;
      out.push(`STR ${p}:${i + 1}: ${s}`);
    }
  });
}
roots.forEach(walk);
console.log(out.join('\n'));
console.log('TOTAL', out.length);
