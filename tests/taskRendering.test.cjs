const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
const compiled = new Map();
function load(filename, mocks) {
  const resolved = require.resolve(filename);
  const mod = new Module(resolved, module);
  mod.filename = resolved;
  mod.paths = Module._nodeModulePaths(path.dirname(resolved));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(resolved), name);
    const source = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(source, mocks);
  };
  if (!compiled.has(resolved)) compiled.set(resolved, babel.transformFileSync(resolved).code);
  mod._compile(compiled.get(resolved), resolved);
  return mod.exports;
}

async function mountTasks(t, platform = 'android') {
  let patternRenders = 0, savedSchedule;
  const animations = [];
  const PatternIcon = props => { patternRenders++; return React.createElement('PatternIcon', props); };
  const schedule = {
    id: 'schedule', name: 'Study', repeat: 1, schedule: [],
    subjects: [{ id: 'math', name: 'Math', color: '#3456ab', icon: 'math' }],
    tasks: Array.from({ length: 3 }, (_, index) => ({ id: `task-${index}`, text: `Task ${index}`, subjectId: 'math', createdAt: 3 - index })),
  };
  const data = { schedule, schedules: [schedule], global: { currentScheduleId: schedule.id, theme: ['light', 'blue'] }, lang: 'uk' };
  const actions = { setScheduleDraft: update => { savedSchedule = update(schedule); }, setData() {} };
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    interpolate() { return this.value; }
    stopAnimation() {}
  }
  const FlatList = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex() {}, scrollToOffset() {} }), []);
    return React.createElement('List', props, props.data.map(item => React.cloneElement(props.renderItem({ item }), { key: item.key })));
  });
  const mocks = {
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', FlatList,
      StyleSheet: { create: value => value, hairlineWidth: 1 },
      Platform: { OS: platform, select: value => value[platform] || value.default },
      Animated: { Value, View: 'AnimatedView', createAnimatedComponent: value => value, timing: (value, options) => ({
        start(callback) { animations.push(options); value.setValue(options.toValue); callback?.({ finished: true }); },
      }) },
      Easing: { out: fn => fn, cubic: value => value ** 3 },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Defs: 'Defs', G: 'G', Use: 'Use' },
    'phosphor-react-native': new Proxy({}, { get: (_, name) => name }),
    '../../context/ScheduleProvider': { useScheduleData: () => data, useScheduleActions: () => actions, useScheduleLayout: () => ({ tabBarHeight: 80 }) },
    '../../context/AttachmentImagePreviewContext': { useAttachmentImagePreview: () => ({ openImagePreview() {} }) },
    '../../context/AppDialogContext': { useAppDialog: () => ({ alert: async () => {} }) },
    '../../config/subjectIcons': { getIconComponent: () => PatternIcon },
    '../../hooks/useReducedMotionPreference': () => false,
    '../../utils/haptics': { triggerHaptic() {} },
    '../../services/attachmentService': { resolveAttachmentList: () => [], normalizeAttachmentDraftList: value => value || [] },
    '../../components/ui/AppBlur': 'Blur',
    '../../components/ui/GradientBackground': 'Gradient',
    '../../components/SubjectPattern': 'SubjectPattern',
    '../../components/ScheduleIcon': 'ScheduleIcon',
    '../Schedule/components/LessonViewer': 'Viewer',
    './components/TaskEditor': { __esModule: true, default: 'Editor' },
    './components/TaskScheduleFilterSheet': 'Filter',
  };
  const Tasks = load(path.join(root, 'src/pages/Tasks/Tasks.jsx'), mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Tasks, { navigation: {} })); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    tree, animations, patternRenders: () => patternRenders, savedSchedule: () => savedSchedule,
    async applySavedSchedule() {
      data.schedule = savedSchedule;
      data.schedules = [savedSchedule];
      await act(async () => tree.update(React.createElement(Tasks, { navigation: {} })));
    },
  };
}

test('task decorations reuse one icon per card and opening the editor preserves mounted card content', async t => {
  const tasks = await mountTasks(t, 'ios');
  const cards = () => tasks.tree.root.findAllByType('Gradient');
  assert.equal(cards().length, 3);
  await act(async () => {
    for (const card of cards()) card.props.onLayout({ nativeEvent: { layout: { width: 360, height: 180 } } });
  });
  assert.equal(tasks.tree.root.findAllByType('PatternIcon').length, 3);
  assert.ok(tasks.tree.root.findAllByType('Use').length > 30);
  const patterns = tasks.tree.root.findAllByType('G').map(node => node.props.id);
  assert.equal(new Set(patterns).size, 3);
  const renders = tasks.patternRenders();
  await act(async () => cards()[0].props.onPress());
  assert.equal(tasks.tree.root.findByType('Editor').props.task.id, 'task-0');
  assert.equal(tasks.patternRenders(), renders);
  await act(async () => tasks.tree.root.findByType('Editor').props.onClose());
  assert.equal(tasks.tree.root.findAllByType('Editor').length, 0);
  assert.equal(tasks.patternRenders(), renders);
});

test('a task checkbox forwards its own entry to the schedule update', async t => {
  const tasks = await mountTasks(t);
  assert.equal(tasks.animations.length, 0, 'mounting tasks must not run layout animations');
  const checkbox = tasks.tree.root.findAllByType('Button').find(button => button.props.accessibilityRole === 'checkbox');
  await act(async () => checkbox.props.onPress({ stopPropagation() {} }));
  assert.equal(tasks.savedSchedule().tasks[0].completed, true);
  assert.equal(tasks.savedSchedule().tasks[1].completed, undefined);
  assert.equal(tasks.savedSchedule().tasks[2].completed, undefined);
  await tasks.applySavedSchedule();
  assert.equal(tasks.animations.filter(animation => animation.duration === 230).length, 1, 'only the changed task animates its layout');
});

test('Android tasks use the shared cached image pattern without mounting SVG decorations', async t => {
  const tasks = await mountTasks(t, 'android');
  await act(async () => {
    for (const card of tasks.tree.root.findAllByType('Gradient')) {
      card.props.onLayout({ nativeEvent: { layout: { width: 360, height: 180 } } });
    }
  });
  const patterns = tasks.tree.root.findAllByType('SubjectPattern');
  assert.equal(patterns.length, 3);
  assert.ok(patterns.every(pattern => pattern.props.icon === 'math'));
  assert.equal(tasks.patternRenders(), 0);
  assert.equal(tasks.tree.root.findAllByType('Svg').length, 0);
  await act(async () => tasks.tree.root.findAllByType('Gradient')[0].props.onPress());
  assert.equal(tasks.tree.root.findByType('Editor').props.task.id, 'task-0');
});
