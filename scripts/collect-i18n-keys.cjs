const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.join(process.cwd(), 'apps/web/src');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
  }
}
walk(root);

const keys = new Set();
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch {
    continue;
  }
  traverse(ast, {
    CallExpression(p) {
      if (p.node.callee.type !== 'Identifier' || p.node.callee.name !== 't') return;
      const [arg] = p.node.arguments;
      if (arg?.type !== 'StringLiteral') return;
      keys.add(arg.value);
    },
  });
}

// Values reached through dynamic helpers such as ROLE_LABELS or t(option.label)
// are not literal arguments, so they are tracked separately.
const extrasPath = path.join(__dirname, 'i18n-extra-keys.json');
if (fs.existsSync(extrasPath)) {
  for (const key of JSON.parse(fs.readFileSync(extrasPath, 'utf8'))) keys.add(key);
}

const list = [...keys].sort((a, b) => a.localeCompare(b));
const outPath = path.join(process.cwd(), 'apps/web/src/lib/translations/keys.json');
fs.writeFileSync(outPath, JSON.stringify(list, null, 2) + '\n', 'utf8');
console.log(`Collected ${list.length} unique keys from ${files.length} files.`);
