const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const babel = require('@babel/core');
const plugin = require('../plugins/babelPhosphorImports');

test('every application icon resolves through the library public subpaths with its original export and alias', () => {
  const root = path.resolve(__dirname, '../src');
  let icons = 0;
  for (const relative of fs.readdirSync(root, { recursive: true }).filter(file => /\.jsx?$/.test(file))) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    if (!source.includes('phosphor-react-native')) continue;
    const options = { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } };
    const original = babel.parseSync(source, options);
    const transformed = babel.transformFromAstSync(original, source, { ...options, plugins: [plugin], ast: true, code: false }).ast;
    const imports = ast => ast.program.body.filter(node => node.type === 'ImportDeclaration' && node.source.value.startsWith('phosphor-react-native'));
    const names = nodes => nodes.flatMap(node => node.specifiers.map(item => `${item.imported.name}:${item.local.name}`)).sort();
    assert.deepEqual(names(imports(transformed)), names(imports(original)), relative);
    for (const declaration of imports(transformed)) {
      assert.notEqual(declaration.source.value, 'phosphor-react-native', relative);
      assert.doesNotThrow(() => require.resolve(declaration.source.value));
      icons++;
    }
  }
  assert.ok(icons > 200);
});

test('the production import transform preserves the optional shared icon context', () => {
  const source = 'import { IconContext, Clock as Time } from "phosphor-react-native";';
  const result = babel.transformSync(source, { configFile: false, babelrc: false, plugins: [plugin] }).code;
  assert.match(result, /IconContext.*from "phosphor-react-native"/);
  assert.match(result, /Clock as Time.*from "phosphor-react-native\/src\/icons\/Clock"/);
});

for (const isDev of [true, false]) {
  test(`Metro ${isDev ? 'development' : 'release'} avoids loading the full icon barrel`, () => {
    const result = babel.transformSync('import { CalendarDots } from "phosphor-react-native";', {
      filename: path.resolve(__dirname, '../src/navigation/TabNavigator.jsx'),
      caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev },
    }).code;
    assert.match(result, /phosphor-react-native\/src\/icons\/CalendarDots/);
    assert.doesNotMatch(result, /["']phosphor-react-native["']/);
  });
}

test('loading navigation defers secondary screens and every lazy route resolves a default export', () => {
  const filename = path.resolve(__dirname, '../src/navigation/TabNavigator.jsx');
  const source = fs.readFileSync(filename, 'utf8');
  const options = { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'] };
  const transformed = babel.transformSync(source, { ...options, filename }).code;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = name => {
    assert.ok(!name.includes('/pages/Settings/') && !name.includes('/pages/Tasks/'), `eager screen: ${name}`);
    if (name === 'react') return require('react');
    if (name === 'react-native') return { Platform: { OS: 'android' }, StyleSheet: { create: value => value } };
    if (name === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => ({}) };
    if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({}) };
    if (name === 'react-native-reanimated') return { Easing: { bezier() {} } };
    return {};
  };
  loaded._compile(transformed, filename);
  assert.equal(typeof loaded.exports.default, 'function');
  let routes = 0;
  babel.traverse(babel.parseSync(source, options), {
    JSXAttribute(attribute) {
      if (attribute.node.name.name !== 'getComponent') return;
      routes++;
      const request = attribute.node.value.expression.body.object.arguments[0].value;
      const target = require.resolve(path.resolve(path.dirname(filename), `${request}.jsx`));
      assert.ok(babel.parseSync(fs.readFileSync(target, 'utf8'), options).program.body.some(node => node.type === 'ExportDefaultDeclaration'), target);
    },
  });
  assert.equal(routes, 19);
});

for (const [file, deferred] of [
  ['src/Root.jsx', './layouts/MainLayout'],
  ['src/layouts/MainLayout.jsx', '../navigation/TabNavigator'],
  ['src/context/AttachmentImagePreviewContext.jsx', '../components/attachments/AttachmentImagePreview'],
]) {
  test(`loading ${file} leaves its optional interface module unevaluated`, () => {
    const filename = path.resolve(__dirname, '..', file);
    const code = babel.transformFileSync(filename, {
      configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
    }).code;
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.require = name => {
      assert.notEqual(name, deferred, `eager interface: ${name}`);
      if (name === 'react') return require('react');
      if (name === 'react-native') return { StyleSheet: { create: value => value } };
      if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({}) };
      if (name === 'expo-splash-screen') return { preventAutoHideAsync: async () => {} };
      if (name === './utils/analytics/crashlytics') return { initGlobalErrorHandling() {} };
      if (name === 'expo-linking') return { createURL: () => 'planit://' };
      return {};
    };
    loaded._compile(code, filename);
  });
}

for (const [screen, editor] of [['Schedule', 'LessonEditor'], ['Tasks', 'TaskEditor']]) {
  test(`loading ${screen} leaves its editor module unevaluated`, () => {
    const filename = path.resolve(__dirname, `../src/pages/${screen}/${screen}.jsx`);
    const transformed = babel.transformFileSync(filename, {
      configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
    }).code;
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.require = name => {
      assert.ok(!name.includes(editor), `eager editor: ${name}`);
      if (name === 'react') return require('react');
      if (name === 'react-native') return {
        Animated: { createAnimatedComponent: component => component },
        Platform: { OS: 'android', select: value => value.android || value.default },
        StyleSheet: { create: value => value },
      };
      return {};
    };
    loaded._compile(transformed, filename);
    assert.equal(typeof loaded.exports.default, 'function');
  });
}

test('the patched Zod dependency preserves Expo developer tool schema validation', () => {
  const cliRoot = path.dirname(require.resolve('@expo/cli/package.json'));
  const { PluginSchema, DevToolsPluginOutputSchema } = require(path.join(cliRoot, 'build/src/start/server/DevToolsPlugin.schema.js'));
  const { createMCPDevToolsExtensionSchema } = require(path.join(cliRoot, 'build/src/start/server/createMCPDevToolsExtensionSchema.js'));
  const plugin = PluginSchema.parse({
    packageName: 'planit-test', packageRoot: __dirname,
    cliExtensions: {
      description: 'Test commands', entryPoint: 'test.js',
      commands: [{ name: 'inspect', title: 'Inspect', environments: ['mcp'], parameters: [{ name: 'count', type: 'number' }] }],
    },
  });
  const commands = createMCPDevToolsExtensionSchema(plugin);
  assert.deepEqual(commands.parse({ command: 'inspect', count: 2 }), { command: 'inspect', count: 2 });
  assert.equal(commands.safeParse({ command: 'unknown' }).success, false);
  assert.equal(commands.safeParse({ command: 'inspect', count: 'invalid' }).success, false);
  assert.equal(commands.safeParse({ command: 'inspect', unexpected: true }).success, false);
  assert.equal(PluginSchema.safeParse({ packageName: '' }).success, false);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 'Ready', level: 'info' }]).success, true);
  assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'unknown' }]).success, false);
});
