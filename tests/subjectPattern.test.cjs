const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;

test('Android patterns share a PNG source across card sizes, colors and opacity', async () => {
  const source = { uri: 'math.png' };
  const filename = path.resolve(__dirname, '../src/components/SubjectPattern.android.jsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => {
    if (name === 'react-native') return { Image: 'Image', StyleSheet: { create: value => value } };
    if (name === '../config/subjectPatternImages.android') return { SUBJECT_PATTERN_IMAGES: { math: source } };
    return originalRequire(name);
  };
  loaded._compile(babel.transformFileSync(filename).code, filename);
  const Pattern = loaded.exports.default;
  const render = props => React.createElement(Pattern, { icon: 'math', width: 360, height: 100, ...props });
  let tree;
  await act(async () => { tree = create(render({ color: '#fff', opacity: 0.2 })); });
  try {
    const image = tree.root.findByType('Image');
    assert.equal(image.props.source, source);
    assert.equal(image.props.resizeMode, 'repeat');
    assert.equal(image.props.fadeDuration, 0);
    assert.equal(image.props.importantForAccessibility, 'no-hide-descendants');
    await act(async () => tree.update(render({ width: 720, height: 220, color: '#111', opacity: 0.07 })));
    assert.equal(tree.root.findByType('Image').props.source, source);
    await act(async () => tree.update(render({ icon: 'unknown' })));
    assert.equal(tree.toJSON(), null, 'unknown icons do not fall back to runtime SVG');
    await act(async () => tree.update(render({ width: 0 })));
    assert.equal(tree.toJSON(), null);
  } finally {
    await act(async () => tree.unmount());
  }
});

test('generated tiles cover every subject icon at all three pixel densities', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/config/subjectIcons.js'), 'utf8');
  const ast = babel.parseSync(source, { filename: 'subjectIcons.js', configFile: false, babelrc: false });
  const icons = ast.program.body.find(node => node.declaration?.declarations?.[0]?.id.name === 'SUBJECT_ICONS')
    .declaration.declarations[0].init.properties;
  const manifest = fs.readFileSync(path.join(root, 'src/config/subjectPatternImages.android.js'), 'utf8');
  for (const icon of icons) {
    const key = icon.key.name;
    assert.ok(manifest.includes(`  ${key}: require('../../assets/subject-patterns/${key}.png')`));
    for (const scale of [1, 2, 3]) {
      const png = fs.readFileSync(path.join(root, 'assets/subject-patterns', `${key}${scale === 1 ? '' : `@${scale}x`}.png`));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 92 * scale);
      assert.equal(png.readUInt32BE(20), 76 * scale);
    }
  }
});
