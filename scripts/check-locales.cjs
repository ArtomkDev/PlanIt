const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const errors = [];
const pluralCategories = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const parse = (file) => babel.parseSync(fs.readFileSync(file, 'utf8'), {
  filename: file, configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
});
const readCatalog = (language) => {
  const ast = parse(path.join(root, 'src/locales', language + '.js'));
  const result = new Map();
  const visit = (node, prefix) => {
    const keys = new Set();
    for (const property of node.properties) {
      const name = property.key?.name ?? property.key?.value;
      const key = prefix ? prefix + '.' + name : name;
      if (keys.has(name)) errors.push(language + ': duplicate key ' + key);
      keys.add(name);
      if (property.value?.type === 'StringLiteral') {
        if (!property.value.value.trim()) errors.push(language + ': empty translation ' + key);
        result.set(key, property.value.value);
      } else if (property.value?.type === 'ObjectExpression') {
        visit(property.value, key);
      } else {
        errors.push(language + ': unsupported translation value ' + key);
      }
    }
  };
  visit(ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration').declaration, '');
  return result;
};
const catalogs = { en: readCatalog('en'), uk: readCatalog('uk') };
const logicalKey = (key) => {
  const parts = key.split('.');
  return pluralCategories.has(parts.at(-1)) ? parts.slice(0, -1).join('.') : key;
};
const logical = Object.fromEntries(Object.entries(catalogs).map(([lang, entries]) => [
  lang, new Set([...entries.keys()].map(logicalKey)),
]));
const placeholders = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort().join(',');
for (const lang of ['en', 'uk']) {
  const other = lang === 'en' ? 'uk' : 'en';
  for (const key of logical[lang]) {
    if (!logical[other].has(key)) errors.push(other + ': missing key ' + key);
    const values = [...catalogs[lang]].filter(([entry]) => logicalKey(entry) === key);
    const plural = values.some(([entry]) => entry !== key);
    if (plural) {
      for (const category of new Intl.PluralRules(lang).resolvedOptions().pluralCategories) {
        if (!catalogs[lang].has(key + '.' + category)) errors.push(lang + ': missing plural ' + key + '.' + category);
      }
    }
    const expected = catalogs.en.get(key) ?? catalogs.en.get(key + '.other');
    if (expected !== undefined) {
      for (const [entry, value] of values) {
        if (placeholders(value) !== placeholders(expected)) errors.push(lang + ': mismatched parameters in ' + entry);
      }
    }
  }
}
const nativeEn = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/native/en.json'), 'utf8')).ios;
const nativeUk = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/native/uk.json'), 'utf8')).ios;
for (const key of new Set([...Object.keys(nativeEn), ...Object.keys(nativeUk)])) {
  if (!nativeEn[key]?.trim() || !nativeUk[key]?.trim()) errors.push('Missing native translation: ' + key);
}
const references = new Set(['locale']);
const patterns = [];
let calls = 0;
const escapeRegex = (value) => value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const roots = new Set([...logical.en].map((key) => key.split('.')[0]));
const walk = (directory) => {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) {
      if (file !== path.join(root, 'src/locales')) walk(file);
    } else if (/\.(js|jsx)$/.test(item.name)) {
      babel.traverse(parse(file), {
        LogicalExpression({ node }) {
          if (node.operator === '||' && node.left.type === 'CallExpression'
              && node.left.callee.name === 't') {
            errors.push(path.relative(root, file) + ':' + node.loc.start.line + ': ineffective translation fallback');
          }
        },
        StringLiteral({ node }) {
          if (logical.en.has(node.value)) references.add(node.value);
        },
        ObjectProperty({ node }) {
          const name = node.key?.name ?? node.key?.value;
          const value = node.value?.value;
          if (typeof name === 'string' && name.endsWith('Key') && typeof value === 'string'
              && roots.has(value.split('.')[0]) && !logical.en.has(value)) {
            errors.push(path.relative(root, file) + ': unknown translation reference ' + value);
          }
        },
        TemplateLiteral({ node }) {
          const prefix = node.quasis[0].value.cooked;
          if (!prefix.includes('.') || !roots.has(prefix.split('.')[0])) return;
          patterns.push(new RegExp('^' + node.quasis.map((part) => escapeRegex(part.value.cooked)).join('.*') + '$'));
        },
        CallExpression({ node }) {
          if (node.callee.type === 'MemberExpression' && node.callee.property.name === 'replace'
              && node.callee.object.type === 'CallExpression' && node.callee.object.callee.name === 't') {
            errors.push(path.relative(root, file) + ':' + node.loc.start.line + ': use translation parameters instead of replace');
          }
          if (node.callee.type !== 'Identifier') return;
          // Password reset/add share a suffix-based translation selector.
          if (node.callee.name === 'actionTranslationKey' && node.arguments[0]?.type === 'StringLiteral') {
            for (const action of ['password_reset', 'password_add']) {
              const key = 'auth.' + action + '.' + node.arguments[0].value;
              references.add(key);
              if (!logical.en.has(key)) errors.push('Unknown dynamic key ' + key);
            }
          }
          if (node.callee.name !== 't') return;
          calls++;
          const key = node.arguments[0];
          if (key?.type !== 'StringLiteral') return;
          if (!logical.en.has(key.value)) errors.push(path.relative(root, file) + ':' + node.loc.start.line + ': unknown key ' + key.value);
        },
      });
    }
  }
};
walk(path.join(root, 'src'));
const unused = [...logical.en].filter((key) => !references.has(key) && !patterns.some((pattern) => pattern.test(key)));
if (unused.length) console.warn('Review unused candidates (dynamic references may apply):\n' + unused.join('\n'));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Localization OK: ' + logical.en.size + ' keys per language; ' + calls + ' translation calls checked.');
}
