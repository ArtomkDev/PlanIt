const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const gradientColorsPath = path.resolve(__dirname, '../src/utils/gradientColors.js');
const gradientBackgroundPath = path.resolve(__dirname, '../src/components/ui/GradientBackground.jsx');
const gradientGridPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/LessonEditor/ui/GradientGrid.jsx',
);
const reactNativeBackgroundParserPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/StyleSheet/processBackgroundImage.js',
);
const lessonCardPath = path.resolve(__dirname, '../src/pages/Schedule/components/LessonCard.jsx');
const tasksPath = path.resolve(__dirname, '../src/pages/Tasks/Tasks.jsx');
const lessonViewerPath = path.resolve(__dirname, '../src/pages/Schedule/components/LessonViewer.jsx');
const breakCardPath = path.resolve(__dirname, '../src/pages/Schedule/components/BreakCard.jsx');
const taskEditorPath = path.resolve(__dirname, '../src/pages/Tasks/components/TaskEditor.jsx');
const mainScreenPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/LessonEditor/screens/MainScreen.jsx',
);
const gradientScreenPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/LessonEditor/screens/GradientScreen.jsx',
);
const advancedColorPickerPath = path.resolve(__dirname, '../src/components/ui/AdvancedColorPicker.jsx');
const authScreenPath = path.resolve(__dirname, '../src/auth/AuthScreen.jsx');
const onboardingPath = path.resolve(__dirname, '../src/pages/Onboarding/OnboardingWizard.jsx');
const stagedAttachmentImagePath = path.resolve(
  __dirname,
  '../src/components/attachments/StagedAttachmentImage.jsx',
);

const loadGradientColors = () => {
  const source = fs.readFileSync(gradientColorsPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: gradientColorsPath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(gradientColorsPath, module);
  testModule.filename = gradientColorsPath;
  testModule.paths = Module._nodeModulePaths(path.dirname(gradientColorsPath));
  testModule._compile(transformed, gradientColorsPath);
  return testModule.exports;
};

const colors = loadGradientColors();

const loadGradientBackground = (os) => {
  const source = fs.readFileSync(gradientBackgroundPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: gradientBackgroundPath,
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(gradientBackgroundPath, module);
  testModule.filename = gradientBackgroundPath;
  testModule.paths = Module._nodeModulePaths(path.dirname(gradientBackgroundPath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => {
    if (request === 'react-native') {
      return { Platform: { OS: os }, View: 'View' };
    }
    if (request === '../../utils/gradientColors') return colors;
    return originalRequire(request);
  };
  testModule._compile(transformed, gradientBackgroundPath);
  return testModule.exports;
};

const loadReactNativeBackgroundParser = () => {
  const source = fs.readFileSync(reactNativeBackgroundParserPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: reactNativeBackgroundParserPath,
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(reactNativeBackgroundParserPath, module);
  testModule.filename = reactNativeBackgroundParserPath;
  testModule.paths = Module._nodeModulePaths(path.dirname(reactNativeBackgroundParserPath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => {
    if (request === './processColor') {
      return { __esModule: true, default: (color) => color };
    }
    return originalRequire(request);
  };
  testModule._compile(transformed, reactNativeBackgroundParserPath);
  return testModule.exports.default;
};

test('normalizes legacy string stops to safe colors and locations', () => {
  assert.deepEqual(
    colors.normalizeGradientStops({ colors: ['#4facfe', '#00f2fe'] }),
    [
      { color: 'rgb(79, 172, 254)', position: 0 },
      { color: 'rgb(0, 242, 254)', position: 1 },
    ],
  );
});

test('preserves valid object stop locations and repairs broken ones', () => {
  assert.deepEqual(
    colors.normalizeGradientStops({
      colors: [
        { color: '#ff0000', position: 0.2 },
        { color: '#0000ff', position: 0.8 },
      ],
    }).map((stop) => stop.position),
    [0.2, 0.8],
  );

  assert.deepEqual(
    colors.normalizeGradientStops({
      colors: [
        { color: '#ff0000', position: 1 },
        { color: 'not-a-color', position: 0.5 },
        { color: '#0000ff', position: 0 },
      ],
    }).map((stop) => stop.position),
    [0, 1],
  );
});

test('keeps white as the card default and switches only for consistently light surfaces', () => {
  assert.equal(
    colors.getReadableForeground({ colors: ['#4facfe', '#00f2fe'] }),
    '#ffffff',
  );
  assert.equal(
    colors.getReadableForeground({ colors: ['#25112e', '#4a1235'] }),
    '#ffffff',
  );
  assert.equal(
    colors.getReadableForeground({ colors: ['#ffffff', '#f8fafc'] }),
    '#111827',
  );
  assert.equal(
    colors.getReadableForeground({ colors: ['#fde68a', '#a7f3d0'] }),
    '#111827',
  );
  assert.equal(
    colors.getReadableForeground({ colors: ['#ffffff', '#1e3a8a'] }),
    '#ffffff',
  );
  assert.equal(colors.getReadableForeground('#ffffff'), '#111827');
  assert.equal(colors.getReadableForeground('#f97316'), '#ffffff');
  assert.equal(colors.isLightForeground('#fff'), true);
  assert.equal(colors.isLightForeground('#ffffff'), true);
});

test('builds a Fabric-native background image instead of an absolute native gradient view', () => {
  const ios = loadGradientBackground('ios');
  const web = loadGradientBackground('web');
  const gradient = {
    type: 'linear',
    angle: 0,
    colors: [
      { color: '#4facfe', position: 0 },
      { color: '#00f2fe', position: 1 },
    ],
  };

  assert.deepEqual(ios.getGradientBackgroundStyle(gradient), {
    backgroundColor: 'rgb(79, 172, 254)',
    experimental_backgroundImage: 'linear-gradient(90deg, rgb(79, 172, 254) 0%, rgb(0, 242, 254) 100%)',
  });
  assert.equal(
    web.getGradientBackgroundStyle(gradient).backgroundImage,
    'linear-gradient(90deg, rgb(79, 172, 254) 0%, rgb(0, 242, 254) 100%)',
  );

  const parsedByReactNative = loadReactNativeBackgroundParser()(
    ios.getGradientBackgroundStyle(gradient).experimental_backgroundImage,
  );
  assert.equal(parsedByReactNative.length, 1);
  assert.deepEqual(parsedByReactNative[0].direction, { type: 'angle', value: 90 });
  assert.deepEqual(
    parsedByReactNative[0].colorStops.map((stop) => stop.position),
    ['0%', '100%'],
  );
});

test('supports point directions, layered surfaces, and alpha without a second renderer', () => {
  const ios = loadGradientBackground('ios');
  const web = loadGradientBackground('web');
  const layers = [
    { colors: ['transparent', '#000'], angle: 90, opacity: 0.5 },
    {
      colors: ['#fff', '#f00'],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  ];

  assert.equal(ios.getGradientAngleFromPoints({ x: 0, y: 0 }, { x: 1, y: 1 }), 45);
  assert.equal(
    ios.createGradientDefinition({
      colors: ['#fff', '#000'],
      start: { x: 1, y: 0 },
      end: { x: 0, y: 1 },
    }).angle,
    135,
  );

  const iosStyle = ios.getGradientSurfaceStyle({ layers, fallbackColor: '#fff' });
  const webStyle = web.getGradientSurfaceStyle({ layers, fallbackColor: '#fff' });
  assert.equal(iosStyle.backgroundColor, 'rgb(255, 255, 255)');
  assert.equal(webStyle.backgroundImage, iosStyle.experimental_backgroundImage);

  const parsedByReactNative = loadReactNativeBackgroundParser()(
    iosStyle.experimental_backgroundImage,
  );
  assert.equal(parsedByReactNative.length, 2);
  assert.deepEqual(
    parsedByReactNative.map((layer) => layer.direction),
    [
      { type: 'angle', value: 180 },
      { type: 'angle', value: 135 },
    ],
  );
  assert.match(iosStyle.experimental_backgroundImage, /rgba\(0, 0, 0, 0\.5\)/);
});

test('all UI gradient call sites use the shared surface component', () => {
  const gradientSource = fs.readFileSync(gradientBackgroundPath, 'utf8');
  const gridSource = fs.readFileSync(gradientGridPath, 'utf8');
  const lessonSource = fs.readFileSync(lessonCardPath, 'utf8');
  const taskSource = fs.readFileSync(tasksPath, 'utf8');
  const lessonViewerSource = fs.readFileSync(lessonViewerPath, 'utf8');
  const breakCardSource = fs.readFileSync(breakCardPath, 'utf8');
  const taskEditorSource = fs.readFileSync(taskEditorPath, 'utf8');
  const mainScreenSource = fs.readFileSync(mainScreenPath, 'utf8');
  const migratedGradientSources = [
    gradientScreenPath,
    advancedColorPickerPath,
    authScreenPath,
    onboardingPath,
    stagedAttachmentImagePath,
  ].map((filePath) => fs.readFileSync(filePath, 'utf8'));

  assert.match(gradientSource, /normalizeGradientStops\(gradient\)/);
  assert.match(gradientSource, /experimental_backgroundImage: backgroundImage/);
  assert.match(gradientSource, /component: Component = View/);
  assert.match(gradientSource, /const composedStyle = typeof style === "function"/);
  assert.match(gridSource, /<GradientBackground[\s\S]*component=\{TouchableOpacity\}[\s\S]*gradient=\{item\}/);
  assert.match(lessonSource, /<GradientBackground[\s\S]*component=\{TouchableOpacity\}[\s\S]*gradient=\{activeGrad\}[\s\S]*fallbackColor=\{subjectColor\}/);
  assert.match(taskSource, /<GradientBackground[\s\S]*component=\{AnimatedTouchableOpacity\}[\s\S]*gradient=\{activeGradient\}[\s\S]*fallbackColor=\{cardColor\}/);
  assert.match(lessonViewerSource, /<GradientBackground[\s\S]*gradient=\{headerGradient\}[\s\S]*fallbackColor=\{headerColor\}[\s\S]*style=\{styles\.headerContainer\}/);
  assert.doesNotMatch(lessonViewerSource, /getHeaderBackground|headerBackground/);
  assert.match(breakCardSource, /<GradientBackground[\s\S]*gradientOpacity=\{bgOpacity\}/);
  assert.match(taskEditorSource, /<GradientBackground[\s\S]*gradientOpacity=\{0\.1\}/);
  assert.match(mainScreenSource, /<GradientBackground[\s\S]*gradient=\{gradient\}[\s\S]*fallbackColor=\{color\}/);
  for (const source of migratedGradientSources) {
    assert.doesNotMatch(source, /expo-linear-gradient/);
    assert.match(source, /GradientBackground/);
  }
  assert.doesNotMatch(lessonSource, /activeGrad\.colors\[0\]/);
  assert.match(lessonSource, /const BackgroundPattern = React\.memo/);
  assert.match(lessonSource, /<BackgroundPattern[\s\S]*MainIcon=\{MainIcon\}[\s\S]*color=\{contentColor\}[\s\S]*width=\{cardSize\.width\}[\s\S]*height=\{cardSize\.height\}/);
  assert.match(lessonSource, /colorWithAlpha\(color, PATTERN_ICON_OPACITY, color\)/);
  assert.match(lessonSource, /onLayout=\{handleCardLayout\}/);
  assert.doesNotMatch(lessonSource, /backgroundWrapper/);
  assert.match(lessonSource, /patternLayer:[\s\S]*borderRadius: CARD_BORDER_RADIUS[\s\S]*overflow: 'hidden'/);
  assert.match(taskSource, /const TaskIconPattern = React\.memo/);
  assert.match(taskSource, /<TaskIconPattern[\s\S]*Icon=\{SubjectIcon\}[\s\S]*color=\{withAlpha\(textOnCard, iconPatternOpacity\)\}[\s\S]*width=\{cardSize\.width\}[\s\S]*height=\{cardSize\.height\}/);
  assert.match(taskSource, /onLayout=\{handleCardLayout\}/);
  assert.doesNotMatch(lessonSource, /onLayout=\{handleLayout\}/);
  assert.doesNotMatch(taskSource, /onLayout=\{handleLayout\}/);
  assert.match(lessonSource, /importantForAccessibility="no-hide-descendants"/);
  assert.match(taskSource, /importantForAccessibility="no-hide-descendants"/);
  assert.doesNotMatch(lessonSource, /<MainIcon size=\{18\}/);
  assert.doesNotMatch(taskSource, /<SubjectIcon size=\{17\}/);
  assert.match(lessonSource, /isLightForeground\(contentColor\)/);
  assert.match(taskSource, /isLightForeground\(textOnCard\)/);
  assert.doesNotMatch(taskSource, /textOnCard === "#fff"/);
});
