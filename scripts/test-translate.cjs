const keys = [
  'Hello {{name}}, you have {{count}} new sales',
  'Revenue today',
  '{{count}} products need attention',
  'Sign in to your workspace',
  'Save preferences',
];
(async () => {
  for (const lang of ['de', 'uz']) {
    const protectedKeys = keys.map((k, i) =>
      k.replace(/\{\{(\w+)\}\}/g, (_, n) => `__PH_${n.toUpperCase()}__`),
    );
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
      lang +
      '&dt=t&q=' +
      encodeURIComponent(protectedKeys.join('\n'));
    const res = await fetch(url);
    const json = await res.json();
    const text = json[0].map((x) => x[0]).join('');
    console.log('===', lang, '===');
    console.log(text);
    console.log('lines:', text.split('\n').length);
  }
})();
