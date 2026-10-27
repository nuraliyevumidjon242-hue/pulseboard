const fs = require('fs');

const files = [
  'apps/web/src/features/stores/create-store-modal.tsx',
  'apps/web/src/features/inventory/product-modal.tsx',
  'apps/web/src/pages/auth/accept-invitation.tsx',
  'apps/web/src/pages/auth/register.tsx',
  'apps/web/src/pages/settings.tsx',
  'apps/web/src/pages/auth/login.tsx',
];

const replacements = [
  ["{t('Kiez Markt')}", '"Kiez Markt"'],
  ["{t('MLK-120')}", '"MLK-120"'],
  ["{t('Anna')}", '"Anna"'],
  ["{t('Weber')}", '"Weber"'],
  ["{t('https://example.com/avatar.jpg')}", '"https://example.com/avatar.jpg"'],
  ["{t('https://yourstore.com/logo.png')}", '"https://yourstore.com/logo.png"'],
  ["{t('Warschauer Str. 12')}", '"Warschauer Str. 12"'],
  ["{t('PulseDemo2026!')}", '"PulseDemo2026!"'],
];

for (const file of files) {
  let contents = fs.readFileSync(file, 'utf8');
  for (const [from, to] of replacements) contents = contents.split(from).join(to);
  fs.writeFileSync(file, contents);
}
console.log('Unwrapped data placeholders.');
