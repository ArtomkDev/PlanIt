const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  if (!compiled.has(filename)) {
    compiled.set(filename, babel.transformFileSync(filename).code);
  }
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : originalRequire(name);
  loaded._compile(compiled.get(filename), filename);
  return loaded.exports;
}

async function renderViewer(t, { subject = {}, lesson = {}, readOnly = false, ...props } = {}) {
  const native = {
    View: 'View', Text: 'Text', TouchableOpacity: 'Button',
    Platform: { OS: 'ios' },
    StyleSheet: { create: (value) => value, hairlineWidth: 1, absoluteFill: { position: 'absolute' } },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
  const colors = load('src/utils/gradientColors.js');
  const theme = { backgroundColor: '#fff', textColor: '#111', textColor2: '#555', accentColor: '#2458ad' };
  const Viewer = load('src/pages/Schedule/components/LessonViewer.jsx', {
    'react-native': native,
    'phosphor-react-native': new Proxy({}, { get: (_, name) => name }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    '../../../context/ScheduleProvider': {
      useScheduleData: () => ({ schedule: { subjects: [{ id: 'subject', name: 'Systems', ...subject }] }, global: {}, lang: 'uk' }),
      useScheduleActions: () => ({ setScheduleDraft() {} }),
    },
    '../../../context/DayScheduleProvider': { useOptionalDaySchedule: () => null },
    '../../../config/themes': { getColors: () => theme, accentColors: {} },
    '../../../components/ui/GradientBackground': 'GradientBackground',
    '../../../config/subjectIcons': { getIconComponent: () => null },
    '../../../config/contactTypes': {},
    '../../../utils/i18n': { t: (key) => key },
    '../../../utils/contactData': {},
    '../../../utils/scheduleTime': load('src/utils/scheduleTime.js'),
    '../../../components/ui/BottomSheet': {
      __esModule: true,
      default: (sheetProps) => React.createElement('Sheet', sheetProps, sheetProps.header, sheetProps.children),
      SheetScrollView: 'ScrollView',
    },
    '../../../context/AttachmentImagePreviewContext': { useAttachmentImagePreview: () => ({}) },
    '../../../utils/haptics': { triggerHaptic() {} },
    '../../../utils/gradientColors': colors,
    '../../../services/attachmentService': { resolveAttachmentList: () => [] },
    '../../../utils/scheduleDeletion': {},
  }).default;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Viewer, {
      visible: true, lesson: { subjectId: 'subject', data: {}, ...lesson }, readOnly, onClose() {}, ...props,
    }));
  });
  t.after(async () => act(async () => renderer.unmount()));
  return {
    sheet: () => renderer.root.findByType('Sheet').props,
    text: () => renderer.root.findAllByType('Text').map((node) => node.props.children).flat().join(' '),
    buttons: () => renderer.root.findAllByType('Button').map((node) => node.props.accessibilityLabel),
    async measure(contentHeight) {
      await act(async () => {
        renderer.root.findByType('Sheet').props.header.props.onLayout({ nativeEvent: { layout: { height: 90 } } });
        for (const node of renderer.root.findAllByType('View').filter((node) => node.props.onLayout)) {
          if (node.props !== renderer.root.findByType('Sheet').props.header.props) {
            node.props.onLayout({ nativeEvent: { layout: { height: 80 } } });
          }
        }
        renderer.root.findByType('ScrollView').props.onContentSizeChange(390, contentHeight);
      });
    },
  };
}

test('missing place and time do not render placeholder information', async (t) => {
  const viewer = await renderViewer(t);
  assert.ok(viewer.text().includes('Systems'));
  assert.ok(!viewer.text().includes('—'));
  assert.ok(!viewer.text().includes('undefined'));
  assert.ok(!viewer.text().includes('common.room'));
});

test('an explicitly cleared local location does not fall back to subject defaults', async (t) => {
  const viewer = await renderViewer(t, {
    subject: { room: '101', building: 'North' },
    lesson: { data: { room: '', building: '   ' }, timeInfo: { start: '13:10', end: '14:30' } },
  });
  assert.ok(!viewer.text().includes('North'));
  assert.ok(!viewer.text().includes('101'));
  assert.ok(viewer.text().includes('13:10 – 14:30'));
});

test('a building without a room is displayed without an empty separator', async (t) => {
  const viewer = await renderViewer(t, { subject: { building: 'North' } });
  assert.ok(viewer.text().includes('North'));
  assert.ok(!viewer.text().includes('North,'));
});

test('light cover gets a dark handle and dark cover gets a white handle', async (t) => {
  const light = await renderViewer(t, { subject: { color: '#ffffff' } });
  const dark = await renderViewer(t, { subject: { color: '#101010' } });
  assert.equal(light.sheet().handleColor, '#111827');
  assert.equal(dark.sheet().handleColor, '#ffffff');
  assert.equal(light.sheet().headerBackground.props.fallbackColor, '#ffffff');
});

test('height fits short content and caps long content to leave room above the sheet', async (t) => {
  const viewer = await renderViewer(t);
  await viewer.measure(120);
  const compact = viewer.sheet().snapPoints[0];
  assert.ok(compact < 400);
  await viewer.measure(1800);
  assert.equal(viewer.sheet().snapPoints[0], 844 * 0.85);
  await viewer.measure(120);
  assert.equal(viewer.sheet().snapPoints[0], compact);
});

test('read-only previews retain navigation but omit editing and deletion', async (t) => {
  const viewer = await renderViewer(t, { readOnly: true, onGoToLesson() {} });
  assert.ok(viewer.buttons().includes('schedule.lesson_viewer.go_to_lesson'));
  assert.ok(!viewer.buttons().includes('common.delete'));
  assert.ok(!viewer.buttons().includes('common.edit'));
});
