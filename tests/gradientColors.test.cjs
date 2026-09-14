const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const gradientColorsPath = path.resolve(__dirname, '../src/utils/gradientColors.js');
const gradientBackgroundPath = path.resolve(__dirname, '../src/components/ui/GradientBackground.jsx');
const gradientAnglesPath = path.resolve(__dirname, '../src/utils/gradientAngles.js');
const gradientGridPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/LessonEditor/ui/GradientGrid.jsx',
);
const reactNativeBackgroundParserPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/StyleSheet/processBackgroundImage.js',
);
const reactNativeBackgroundRepeatParserPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/StyleSheet/processBackgroundRepeat.js',
);
const reactNativeBackgroundSizeParserPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/StyleSheet/processBackgroundSize.js',
);
const reactNativeBackgroundPositionParserPath = path.resolve(
  __dirname,
  '../node_modules/react-native/Libraries/StyleSheet/processBackgroundPosition.js',
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
const colorSpectrumPickerPath = path.resolve(__dirname, '../src/components/ui/ColorSpectrumPicker.jsx');
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

const loadEsmUtility = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const angles = loadEsmUtility(gradientAnglesPath);

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

const loadReactNativeSimpleStyleParser = (parserPath) => {
  const source = fs.readFileSync(parserPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: parserPath,
    presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(parserPath, module);
  testModule.filename = parserPath;
  testModule.paths = Module._nodeModulePaths(path.dirname(parserPath));
  testModule._compile(transformed, parserPath);
  return testModule.exports.default;
};

const loadReactNativeBackgroundRepeatParser = () => (
  loadReactNativeSimpleStyleParser(reactNativeBackgroundRepeatParserPath)
);
const loadReactNativeBackgroundSizeParser = () => (
  loadReactNativeSimpleStyleParser(reactNativeBackgroundSizeParserPath)
);
const loadReactNativeBackgroundPositionParser = () => (
  loadReactNativeSimpleStyleParser(reactNativeBackgroundPositionParserPath)
);

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

test('adds perceptually even intermediate stops without changing saved endpoints', () => {
  const stops = colors.createPerceptualGradientStops({
    colors: ['#4f46ff', '#ff007a'],
  });

  assert.equal(stops.length, 7);
  assert.deepEqual(stops[0], { color: 'rgb(79, 70, 255)', position: 0 });
  assert.deepEqual(stops.at(-1), { color: 'rgb(255, 0, 122)', position: 1 });
  assert.equal(stops[3].position, 0.5);
  assert.notEqual(
    stops[3].color,
    require('tinycolor2').mix('#4f46ff', '#ff007a', 50).toRgbString(),
  );

  assert.equal(
    colors.createPerceptualGradientStops({ colors: ['transparent', '#000'] }).length,
    2,
  );
});

test('softly attracts angle changes to cardinal values and snaps only near them', () => {
  assert.equal(angles.applySoftCardinalMagnet(90), 90);
  assert.equal(angles.applySoftCardinalMagnet(91.5), 90);
  assert.ok(angles.applySoftCardinalMagnet(95) < 95);
  assert.ok(angles.applySoftCardinalMagnet(98) < 98);
  assert.ok(angles.applySoftCardinalMagnet(98) > 90);
  assert.equal(angles.applySoftCardinalMagnet(101), 101);
  assert.equal(angles.snapGradientAngleOnRelease(264.5), 270);
  assert.equal(angles.snapGradientAngleOnRelease(263), 263);
  assert.equal(angles.clampGradientSliderAngle(360), 0);
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

  const smoothStyle = ios.getGradientBackgroundStyle(gradient);
  const iosStyle = ios.getGradientBackgroundStyle(gradient, null, { smoothColors: false });
  const webStyle = web.getGradientBackgroundStyle(gradient, null, { smoothColors: false });
  assert.equal(
    loadReactNativeBackgroundParser()(smoothStyle.experimental_backgroundImage)[0].colorStops.length,
    7,
  );

  assert.deepEqual(iosStyle, {
    experimental_backgroundImage: 'linear-gradient(90deg, rgb(79, 172, 254) 0%, rgb(0, 242, 254) 100%)',
    experimental_backgroundSize: '102% 102%',
    experimental_backgroundPosition: 'center',
    experimental_backgroundRepeat: 'no-repeat',
  });
  assert.equal(
    webStyle.backgroundImage,
    'linear-gradient(90deg, rgb(79, 172, 254) 0%, rgb(0, 242, 254) 100%)',
  );
  assert.equal(webStyle.backgroundRepeat, 'no-repeat');
  assert.equal(webStyle.backgroundColor, undefined);

  assert.deepEqual(
    loadReactNativeBackgroundRepeatParser()(
      iosStyle.experimental_backgroundRepeat,
    ),
    [{ x: 'no-repeat', y: 'no-repeat' }],
  );
  assert.deepEqual(
    loadReactNativeBackgroundSizeParser()(
      iosStyle.experimental_backgroundSize,
    ),
    [{ x: '102%', y: '102%' }],
  );
  assert.deepEqual(
    loadReactNativeBackgroundPositionParser()(
      iosStyle.experimental_backgroundPosition,
    ),
    [{ top: '50%', left: '50%' }],
  );
  assert.deepEqual(
    ios.getGradientSurfaceStyle({
      colors: ['not-a-color'],
      fallbackColor: '#fff',
    }),
    { backgroundColor: 'rgb(255, 255, 255)' },
  );

  const parsedByReactNative = loadReactNativeBackgroundParser()(
    iosStyle.experimental_backgroundImage,
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
  assert.equal(iosStyle.backgroundColor, undefined);
  assert.equal(webStyle.backgroundImage, iosStyle.experimental_backgroundImage);
  assert.equal(iosStyle.experimental_backgroundSize, '102% 102%');
  assert.equal(iosStyle.experimental_backgroundPosition, 'center');
  assert.equal(iosStyle.experimental_backgroundRepeat, 'no-repeat');
  assert.equal(webStyle.backgroundRepeat, 'no-repeat');

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
    colorSpectrumPickerPath,
    authScreenPath,
    onboardingPath,
    stagedAttachmentImagePath,
  ].map((filePath) => fs.readFileSync(filePath, 'utf8'));

  assert.match(gradientSource, /normalizeGradientStops\(gradient\)/);
  assert.match(gradientSource, /experimental_backgroundImage: backgroundImage/);
  assert.match(gradientSource, /experimental_backgroundSize: "102% 102%"/);
  assert.match(gradientSource, /experimental_backgroundPosition: "center"/);
  assert.match(gradientSource, /experimental_backgroundRepeat: "no-repeat"/);
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
  assert.doesNotMatch(gridSource, /gradientTile:\s*\{[^}]*borderWidth/);
  assert.doesNotMatch(mainScreenSource, /colorPreview:\s*\{[^}]*borderWidth/);
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

test('advanced color picker keeps rapidly changing state below its stable sheet shell', () => {
  const source = fs.readFileSync(advancedColorPickerPath, 'utf8');
  const contentStart = source.indexOf('function AdvancedColorPickerContent');
  const sheetStart = source.indexOf('const AdvancedColorPickerSheet');
  const exportedPickerStart = source.indexOf('export default function AdvancedColorPicker');
  const contentSource = source.slice(contentStart, sheetStart);
  const sheetSource = source.slice(sheetStart, exportedPickerStart);

  assert.ok(contentStart >= 0);
  assert.ok(sheetStart > contentStart);
  assert.ok(exportedPickerStart > sheetStart);
  assert.match(contentSource, /useState/);
  assert.doesNotMatch(contentSource, /<BottomSheet/);
  assert.match(sheetSource, /React\.memo/);
  assert.match(sheetSource, /<BottomSheet/);
  assert.match(sheetSource, /<AdvancedColorPickerContent/);
  assert.match(contentSource, /<ColorSpectrumPicker/);
});

test('solid and gradient color editors share one accessible spectrum implementation', () => {
  const advancedSource = fs.readFileSync(advancedColorPickerPath, 'utf8');
  const gradientScreenSource = fs.readFileSync(gradientScreenPath, 'utf8');
  const spectrumSource = fs.readFileSync(colorSpectrumPickerPath, 'utf8');

  assert.match(advancedSource, /import ColorSpectrumPicker/);
  assert.match(advancedSource, /<ColorSpectrumPicker/);
  assert.match(gradientScreenSource, /import ColorSpectrumPicker/);
  assert.match(gradientScreenSource, /<ColorSpectrumPicker/);
  assert.doesNotMatch(gradientScreenSource, /InlineColorPicker|const HUE_COLORS/);
  assert.match(spectrumSource, /const handlePickerLayout = useCallback/);
  assert.match(
    spectrumSource,
    /previous\.width === nextWidth && previous\.height === nextHeight/,
  );
  assert.match(spectrumSource, /onLayout=\{handlePickerLayout\}/);
  assert.doesNotMatch(spectrumSource, /onLayout=\{\(event\) => setPickerSize/);
  assert.match(
    spectrumSource,
    /<GradientBackground[\s\S]*accessibilityRole="adjustable"[\s\S]*onLayout=\{handlePickerLayout\}[\s\S]*layers=\{\[/,
  );
  assert.match(spectrumSource, /accessibilityActions=\{\[\{ name: "increment" \}, \{ name: "decrement" \}\]\}/);
  assert.match(spectrumSource, /hueIndicator:[\s\S]*borderRadius: 8/);
});
