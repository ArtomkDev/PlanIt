const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const base = 'src/pages/Schedule/components/LessonEditor/';
const colors = { backgroundColor: '#fff', backgroundColor2: '#eee', textColor: '#111', textColor2: '#666', accentColor: '#2458ad', borderColor: '#ddd' };
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('/ui/AppTextInput')) return 'Input';
    if (name.endsWith('/ui/AppDateTimePicker')) return mocks['@react-native-community/datetimepicker'];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}
const i18n = load('src/utils/i18n.js');
const tr = key => i18n.t(key, 'uk');
const mocks = {
  'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', TextInput: 'Input', Pressable: 'Button', TouchableOpacity: 'Button', KeyboardAvoidingView: 'Keyboard', Platform: { OS: 'ios' }, StyleSheet: { create: x => x, hairlineWidth: 1 } },
  'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
  'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'LinearGradient', Path: 'Path', Stop: 'Stop' },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
  '@react-native-community/datetimepicker': 'TimePicker',
  '../../../../../context/ScheduleProvider': { useScheduleData: () => ({ lang: 'uk', global: {} }) },
  '../../../../../context/AppDialogContext': { useAppDialog: () => ({ alert: async () => {} }) },
  '../../../../../utils/haptics': { triggerHaptic() {} },
  '../../../../../components/ui/BottomSheet': {
    SheetScrollView: 'Scroll',
    SheetFlatList: props => React.createElement('List', {}, props.data.length ? props.data.map((item, index) => React.createElement(React.Fragment, { key: item.key }, props.renderItem({ item, index }))) : props.ListEmptyComponent, props.ListFooterComponent),
  },
  '../../../../../components/ui/AppIconPickerGrid': 'IconGrid',
  '../../../../../components/ui/TabSwitcher': 'Tabs',
  '../../../../../components/ui/SettingsKit/SettingsGroup': props => React.createElement('Group', {}, React.createElement('Text', { accessibilityRole: 'header' }, props.title), props.headerRight, props.children),
  '../../../utils/haptics': { triggerHaptic() {} },
  '../../../../../components/ui/GradientBackground': 'Gradient',
  '../../../../../components/attachments/AttachmentManager': 'Attachments',
  '../../../../../config/subjectIcons': { getIconComponent: () => 'SubjectIcon' },
  '../../../../../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => true },
};
async function render(t, file, props) {
  const Component = load(base + file, mocks).default;
  function ControlledMain() {
    const [instanceData, setInstanceData] = React.useState(props.instanceData);
    return React.createElement(Component, { themeColors: colors, ...props, instanceData,
      onTimeModeChange(mode) {
        props.onTimeModeChange?.(mode);
        setInstanceData(mode === 'slot' ? { timeMode: 'slot', slotNumber: 1 } : { timeMode: 'custom', startTime: props.defaultTime.start, endTime: props.defaultTime.end });
      },
    });
  }
  let tree;
  await act(async () => { tree = create(file === 'screens/MainScreen.jsx' ? React.createElement(ControlledMain) : React.createElement(Component, { themeColors: colors, ...props })); });
  t.after(async () => act(async () => tree.unmount()));
  return tree.root;
}
const press = async node => act(async () => node.props.onPress());
const button = (root, label) => root.findAllByType('Button').find(node => node.props.accessibilityLabel === label || node.findAllByType('Text').some(text => text.props.children === label));

test('picker searches labels and hints; editing, resetting and removing do not select another item', async t => {
  const saves = [], edits = []; let resets = 0;
  const root = await render(t, 'screens/PickerScreen.jsx', { options: [{ key: 'a', label: 'Алгебра', hint: 'Кімната 25' }, { key: 'b', label: 'Фізика' }, { key: 'none', label: 'None' }], onSave: x => saves.push(x), onEdit: x => edits.push(x), onReset: () => resets++ });
  await act(async () => root.findByType('Input').props.onChangeText('25'));
  assert.equal(root.findAllByProps({ accessibilityRole: 'radio' }).length, 1);
  await press(button(root, tr('common.edit') + ': Алгебра'));
  assert.deepEqual(edits, ['a']); assert.deepEqual(saves, []);
  await press(button(root, tr('schedule.lesson_editor.restore_subject')));
  assert.equal(resets, 1);
  await press(button(root, 'Алгебра'));
  await press(button(root, tr('schedule.lesson_editor.delete_slot')));
  assert.deepEqual(saves, ['a', 'none']);
});

test('multi-picker retains hidden selections, blocks duplicates and commits only on Done', async t => {
  const saves = [];
  const root = await render(t, 'screens/PickerScreen.jsx', { options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }], selectedValues: ['a'], alreadySelected: ['c'], multiSelect: true, onSave: x => saves.push(x) });
  await act(async () => root.findByType('Input').props.onChangeText('B'));
  await press(button(root, 'B'));
  assert.deepEqual(saves, []);
  await act(async () => root.findByType('Input').props.onChangeText(''));
  assert.equal(button(root, 'C').props.disabled, true);
  await press(button(root, 'C'));
  await press(button(root, tr('common.done')));
  assert.deepEqual(saves, [['a', 'b']]);
});

test('input commits current text, supports clear/reset/delete and keeps save outside the scroll area', async t => {
  const saves = []; let resets = 0, deletes = 0;
  const root = await render(t, 'screens/InputScreen.jsx', { title: 'Аудиторія', initialValue: '201', onSave: x => saves.push(x), onReset: () => resets++, onDelete: () => deletes++ });
  await act(async () => root.findByType('Input').props.onChangeText('305'));
  await press(button(root, tr('common.save')));
  assert.deepEqual(saves, ['305']);
  assert.equal(button(root.findByType('Scroll'), tr('common.save')), undefined);
  await press(button(root, tr('common.clear')));
  assert.equal(root.findByType('Input').props.value, '');
  await press(button(root, tr('schedule.lesson_editor.restore_subject')));
  await press(button(root, tr('schedule.lesson_editor.delete_entity')));
  assert.equal(resets, 1); assert.equal(deletes, 1);
});

test('scope control uses shared tabs and preserves explicit local/global choice', async t => {
  const calls = [];
  const root = await render(t, 'ui/Group.jsx', { title: 'Викладачі', showScopeToggle: true, scope: 'local', onScopeChange: x => calls.push(x), children: React.createElement('Text', {}, 'Teacher') });
  assert.equal(root.findAllByType('Tabs').length, 0);
  await press(root.findByType('Button'));
  const tabs = root.findByType('Tabs');
  assert.equal(tabs.props.activeTab, 'local');
  await act(async () => tabs.props.onTabPress('global'));
  assert.deepEqual(calls, ['global']);
});

function mainProps(overrides = {}) {
  return { selectedSubjectId: 'math', currentSubject: { id: 'math', name: 'Math' }, gradients: [], scopes: { type: 'global', location: 'global', people: 'local', materials: 'global', attachments: 'local' }, instanceData: {}, defaultTime: { start: '09:00', end: '10:00' }, recurrenceSelection: { mode: 'selected', weeks: [1] }, scheduleRepeat: 2, currentWeekNumber: 1, getValueLabel: () => 'Value', getLabel: (_, id) => id, getArrayData: kind => ({ array: kind === 'teachers' ? ['teacher'] : ['link'] }), setActivePicker() {}, onDirectEdit() {}, attachments: [], ...overrides };
}

test('occupied time slots remain pressable and conflict choices expose swap availability', async t => {
  const selected = [], actions = [];
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({
    instanceData: { timeMode: 'slot', slotNumber: 1 },
    timeSlots: [{ number: 2, start: '10:00', end: '11:20', occupied: true }],
    onSlotChange: number => selected.push(number),
    slotConflict: { slotNumber: 2, canSwap: false },
    onConflictResolution: action => actions.push(action),
  }));
  const occupied = root.findAllByType('Button').find(node => node.props.accessibilityLabel?.includes(tr('schedule.lesson_editor.slot_occupied')));
  assert.ok(occupied);
  assert.notEqual(occupied.props.disabled, true);
  await press(occupied);
  assert.deepEqual(selected, [2]);
  assert.equal(button(root, tr('schedule.lesson_editor.slot_swap')).props.disabled, true);
  await press(button(root, tr('schedule.lesson_editor.slot_replace')));
  await press(button(root, tr('schedule.lesson_editor.slot_cancel')));
  assert.deepEqual(actions, ['replace', 'cancel']);
});
test('main editor orders essential details first and preserves direct edit, time reset and attachment events', async t => {
  const edited = [], times = []; const upload = () => {};
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({ instanceData: { timeMode: 'custom', startTime: '09:15' }, onTimeModeChange: mode => times.push(mode), onDirectEdit: (...x) => edited.push(x), onAttachmentUploadStateChange: upload, attachmentUploadState: { uploading: true } }));
  const titles = root.findAllByType('Text').filter(x => x.props.accessibilityRole === 'header').map(x => x.props.children);
  assert.deepEqual(titles.slice(0, 5), ['common.subject', 'schedule.main_screen.time', 'schedule.lesson_editor.repeat_group', 'common.class_type', 'schedule.main_screen.location'].map(tr));
  await press(button(root, tr('common.edit') + ': teacher'));
  await press(button(root, tr('common.edit') + ': link'));
  assert.deepEqual(edited, [['teacher', 'teacher', 0], ['link', 'link', 0]]);
  await press(button(root, tr('common.reset') + ': ' + tr('schedule.main_screen.time')));
  assert.deepEqual(times, ['slot']);
  const attachments = root.findByType('Attachments');
  assert.equal(attachments.props.onUploadStateChange, upload);
  assert.equal(attachments.props.disabled, true);
});

test('recurrence cannot remove the final week and native time picker still updates lesson time', async t => {
  const recurrence = [], times = [];
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({ onRecurrenceChange: x => recurrence.push(x), onTimeChange: (...x) => times.push(x) }));
  await press(root.findAllByType('Button').find(x => x.props.accessibilityLabel?.startsWith(tr('schedule.lesson_editor.repeat_label'))));
  const weeks = root.findAllByType('Button').filter(x => x.props.accessibilityRole === 'checkbox');
  await press(weeks[0]); assert.deepEqual(recurrence, []);
  await press(weeks[1]); assert.deepEqual(recurrence, [{ mode: 'all', weeks: [1, 2] }]);
  await act(async () => root.findByType('Tabs').props.onTabPress('custom'));
  await press(button(root, tr('schedule.main_screen.start_time')));
  await act(async () => root.findByType('TimePicker').props.onChange({}, new Date(2026, 8, 26, 11, 35)));
  assert.deepEqual(times, [['startTime', '11:35']]);
});

test('link form rejects unsafe URLs and preserves appearance and identity when saving', async t => {
  const saved = []; let canceled = 0;
  const root = await render(t, 'forms/LinkForm.jsx', { linkId: 'link-1', localLinkData: { name: 'Course', url: 'https://example.com', type: 'website', icon: 'globe', color: '#123456' }, onSaveLocal: x => saved.push(x), onBack: () => canceled++ });
  const input = root.findAllByType('Input').find(x => x.props.accessibilityLabel === tr('schedule.lesson_editor.link_value_label'));
  await act(async () => input.props.onChangeText('javascript:alert(1)'));
  await press(button(root, tr('common.save')));
  assert.equal(saved.length, 0);
  await act(async () => input.props.onChangeText('https://example.org/course'));
  await press(button(root, tr('common.save')));
  assert.equal(saved[0].id, 'link-1'); assert.equal(saved[0].color, '#123456');
  assert.equal(saved[0].url, 'https://example.org/course');
  await press(button(root, tr('common.cancel'))); assert.equal(canceled, 1);
});

test('teacher form retains contacts and appearance when changing a name', async t => {
  const saved = [];
  const root = await render(t, 'forms/TeacherForm.jsx', { teacherId: 'teacher-1', localTeacherData: { name: 'Name', icon: 'user', color: '#123456', contacts: [{ id: 'email-1', type: 'email', value: 'teacher@example.com', label: 'Work', icon: 'email', color: '#654321' }] }, onSaveLocal: x => saved.push(x) });
  await act(async () => root.findAllByType('Input').find(x => x.props.accessibilityLabel === tr('schedule.lesson_editor.teacher_name_label')).props.onChangeText(' New name '));
  await press(button(root, tr('common.save')));
  assert.equal(saved[0].name, 'New name'); assert.equal(saved[0].id, 'teacher-1');
  assert.equal(saved[0].color, '#123456'); assert.equal(saved[0].email, 'teacher@example.com');
  assert.equal(saved[0].contacts[0].id, 'email-1'); assert.equal(saved[0].contacts[0].color, '#654321');
});

function editorHandler(name, context) {
  const filename = path.resolve(__dirname, '../src/pages/Schedule/components/LessonEditor.jsx');
  const source = fs.readFileSync(filename, 'utf8');
  let expression;
  babel.traverse(babel.parseSync(source, { filename }), { VariableDeclarator(p) { if (p.node.id.name === name) expression = source.slice(p.node.init.start, p.node.init.end); } });
  assert.ok(expression, name);
  return require('node:vm').runInNewContext('(' + expression + ')', context);
}

test('new lesson starts at subject selection and Back closes without showing an empty editor', () => {
  const initial = editorHandler('getInitialEditorRoute', { generateLocalId: () => 'new' });
  assert.equal(initial(null, { subjects: [{ id: 'math' }] }, null).currentScreen, 'picker');
  assert.equal(initial(null, { subjects: [] }, null).currentScreen, 'input');
  assert.equal(initial(null, { subjects: [{ id: 'math' }] }, 'math').currentScreen, 'main');
  for (const currentScreen of ['picker', 'input']) {
    let closed = 0;
    const back = editorHandler('handleBack', { triggerHaptic() {}, selectedSubjectId: null, currentScreen, localData: { subjects: [] }, sheetRef: { current: { close: () => closed++ } }, goToScreen() { assert.fail('Must close instead of navigating'); } });
    back(); assert.equal(closed, 1);
  }
});

test('adding teachers and links always opens selection, even when the collection is empty', () => {
  for (const type of ['teacher', 'link']) {
    for (const items of [[], [{ id: 'existing' }]]) {
      const result = {};
      const open = editorHandler('handleOpenPicker', {
        localData: { subjects: [], teachers: items, links: items },
        setPickerType: x => result.type = x, setInputType() {}, setEditingSlotIndex: x => result.index = x,
        setAttachAfterEdit: x => result.attach = x, setRelatedEditReturnScreen() {}, goToScreen: x => result.screen = x,
        openNewRelatedItemEditor() { assert.fail('Creation must be explicit'); },
      });
      open(type, 2);
      assert.deepEqual(result, { type, index: 2, attach: false, screen: 'picker' });
    }
  }
  assert.equal(editorHandler('getRelatedEditReturnScreen', { relatedEditReturnScreen: 'picker' })(), 'picker');
});

test('numbered slots hide custom fields and switching back selects slot mode', async t => {
  const times = [];
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({ onTimeModeChange: mode => times.push(mode) }));
  assert.equal(button(root, tr('schedule.main_screen.start_time')), undefined);
  await act(async () => root.findByType('Tabs').props.onTabPress('custom'));
  assert.ok(button(root, tr('schedule.main_screen.start_time')));
  await act(async () => root.findByType('Tabs').props.onTabPress('default'));
  assert.equal(button(root, tr('schedule.main_screen.start_time')), undefined);
  assert.deepEqual(times, ['custom', 'slot']);
});

test('new lessons choose period one or the first available period, and editing preserves period three', () => {
  const timing = load('src/utils/scheduleTime.js');
  const context = {
    ...timing, getDayIndex: () => 0, calculateCurrentWeek: () => 1,
    currentDate: new Date(), getCleanInstanceData: x => x,
    dataSource: { start_time: '08:30', duration: 80, breaks: [10], schedule: [{ week1: [] }] },
    lesson: null,
  };
  assert.equal(editorHandler('initialTimingData', context)().slotNumber, 1);
  context.dataSource.schedule[0].week1 = [{ subjectId: 'math', timeMode: 'slot', slotNumber: 1 }];
  assert.equal(editorHandler('initialTimingData', context)().slotNumber, 2);
  context.dataSource.schedule[0].week1 = [{ subjectId: 'math', timeMode: 'slot', slotNumber: 3 }];
  context.lesson = { index: 0 };
  assert.equal(editorHandler('initialTimingData', context)().slotNumber, 3);
});

test('occupied selection waits for a decision; cancellation retains timing and saving rechecks conflicts', async () => {
  const timing = { timeMode: 'slot', slotNumber: 1 };
  const conflict = { slotNumber: 2, conflicts: [{ week: 1 }], signature: 'occupied', canSwap: true };
  const state = { instanceData: timing, resolution: null, pending: null };
  const context = {
    getSlotConflict: () => conflict,
    setSlotConflict: value => state.pending = value,
    setConflictResolution: value => state.resolution = value,
    selectSlot: number => state.instanceData = { timeMode: 'slot', slotNumber: number },
  };
  editorHandler('handleSlotChange', context)(2);
  assert.equal(state.pending, conflict);
  assert.equal(state.instanceData, timing);
  editorHandler('handleConflictResolution', { ...context, slotConflict: conflict })('cancel');
  assert.equal(state.pending, null);
  assert.equal(state.instanceData, timing);
  assert.equal(state.resolution, null);
  editorHandler('handleConflictResolution', { ...context, slotConflict: conflict })('swap');
  assert.equal(state.instanceData.slotNumber, 2);
  assert.equal(state.resolution.action, 'swap');
  let screen;
  await editorHandler('handleSave', {
    ...context, slotConflict: null, timingDraft: null, instanceData: state.instanceData,
    timeSlots: [{ number: 2 }],
    conflictResolution: { signature: 'stale' }, setCurrentScreen: value => screen = value,
  })();
  assert.equal(state.pending, conflict);
  assert.equal(screen, 'main');
});


test('saving a custom time checks the selected weeks for overlaps before changing schedule data', async () => {
  const alerts = [];
  let previewOptions;
  await editorHandler('handleSave', {
    slotConflict: null, timingDraft: null, instanceData: { timeMode: 'custom', startTime: '09:00', endTime: '10:00' },
    parseTimeToMinutes: value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)),
    applyLessonRecurrence: (_schedule, options) => { previewOptions = options; return { conflicts: [{ week: 2 }] }; },
    timingSchedule: {}, placementOptions: { selection: { mode: 'selected', weeks: [2] } },
    dialog: { alert: async (options) => alerts.push(options) }, t: key => key, lang: 'uk',
  })();
  assert.equal(previewOptions.preview, true);
  assert.equal(previewOptions.selection.weeks[0], 2);
  assert.equal(alerts[0].message, 'schedule.lesson_editor.custom_time_conflict');
});

test('a full day keeps slot mode without silently choosing custom time or occupied period one', () => {
  const timing = load('src/utils/scheduleTime.js');
  const dataSource = { start_time: '08:30', duration: 45, slotDurations: [45, 45, 45, 45], breaks: [10, 10, 10],
    schedule: [{ week1: [1, 2, 3, 4].map(slotNumber => ({ subjectId: 'math', timeMode: 'slot', slotNumber })) }] };
  const initial = editorHandler('initialTimingData', { ...timing, dataSource, getDayIndex: () => 0,
    calculateCurrentWeek: () => 1, currentDate: new Date(), lesson: null });
  assert.equal(initial().timeMode, 'slot');
  assert.equal(initial().slotNumber, undefined);
  let instance = { timeMode: 'custom', startTime: '14:00', endTime: '15:00' };
  const selectSlot = () => assert.fail('Occupied slots must be selected explicitly');
  editorHandler('handleTimeModeChange', { instanceData: instance, timeSlots: [1, 2, 3, 4].map(number => ({ number, occupied: true })),
    setSlotConflict() {}, setConflictResolution() {}, selectSlot, setInstanceData: updater => instance = updater(instance) })('slot');
  assert.equal(instance.timeMode, 'slot');
  assert.equal(instance.slotNumber, undefined);
  assert.equal(instance.startTime, undefined);
});

test('switching from custom time chooses the first free slot instead of the first occupied one', () => {
  let selected;
  editorHandler('handleTimeModeChange', { instanceData: { timeMode: 'custom' },
    timeSlots: [{ number: 1, occupied: true }, { number: 2, occupied: false }],
    setSlotConflict() {}, setConflictResolution() {}, selectSlot: number => selected = number })('slot');
  assert.equal(selected, 2);
});

test('a full day offers the next numbered slot with its proposed time and an explicit create action', async t => {
  let additions = 0;
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({ instanceData: { timeMode: 'slot' }, defaultTime: {},
    timeSlots: [1, 2, 3, 4].map(number => ({ number, start: '08:30', end: '09:15', occupied: true })),
    nextSlot: { number: 5, start: '12:10', end: '12:55' }, onAddSlot: () => additions++ }));
  assert.ok(root.findAllByType('Text').some(node => node.props.children === i18n.t('schedule.lesson_editor.slots_full', 'uk', { count: 4 })));
  const add = root.findAllByType('Button').find(node => node.props.accessibilityLabel?.includes(i18n.t('schedule.lesson_editor.slot_add', 'uk', { number: 5 })));
  assert.ok(add.props.accessibilityLabel.includes('12:10 – 12:55'));
  await press(add);
  assert.equal(additions, 1);
  assert.equal(button(root, tr('schedule.main_screen.start_time')), undefined);
});

test('adding a slot stays local until saving, then persists timing and the fifth lesson together', async () => {
  const timing = load('src/utils/scheduleTime.js');
  const { applyLessonRecurrence } = load('src/utils/lessonRecurrence.js');
  const original = { id: 'schedule', repeat: 2, start_time: '08:30', duration: 45, slotDurations: [45, 45, 45, 45], breaks: [10, 10, 10],
    subjects: [{ id: 'math' }], teachers: [], links: [], gradients: [],
    schedule: [{ week1: [1, 2, 3, 4].map(slotNumber => ({ subjectId: 'math', timeMode: 'slot', slotNumber })), week2: [] }] };
  const before = JSON.stringify(original);
  const nextTiming = timing.appendScheduleSlot(original);
  const nextSlot = timing.buildScheduleSlots(nextTiming.start_time, nextTiming.duration, nextTiming.breaks, nextTiming.slotDurations).at(-1);
  let timingDraft, instanceData, saved, closed = 0;
  editorHandler('handleAddSlot', { nextTiming, nextSlot, setTimingDraft: value => timingDraft = value,
    setSlotConflict() {}, setConflictResolution() {}, selectSlot: slotNumber => instanceData = { timeMode: 'slot', slotNumber } })();
  assert.equal(saved, undefined);
  assert.equal(JSON.stringify(original), before);
  assert.equal(instanceData.slotNumber, 5);
  const timingSchedule = { ...original, ...timingDraft };
  const placementOptions = { dayIndex: 0, weekNumber: 1, lessonIndex: null, selection: { mode: 'all' } };
  await editorHandler('handleSave', { ...timing, slotConflict: null, instanceData, timingDraft, timingSchedule, schedule: original, placementOptions,
    timeSlots: timing.buildScheduleSlots(timingDraft.start_time, timingDraft.duration, timingDraft.breaks, timingDraft.slotDurations),
    storedDefaultTime: nextSlot, getSlotConflict: () => applyLessonRecurrence(timingSchedule, { ...placementOptions, lesson: instanceData, preview: true }),
    conflictResolution: null, effectiveAttachmentRefs: [], normalizeAttachmentDraftList: x => x, resolveAttachmentList: x => x,
    fileLibrary: [], attachmentUploadState: { uploading: false }, localData: original, selectedSubjectId: 'math', lesson: null,
    getDayIndex: () => 0, calculateCurrentWeek: () => 1, currentDate: new Date(), currentWeekNumber: 1,
    scopes: { people: 'global', type: 'global', location: 'global', materials: 'global', attachments: 'global' },
    applyLessonRecurrence, recurrenceSelection: { mode: 'all' }, initialRecurrenceSelection: { mode: 'selected', weeks: [1] }, swapTiming: {},
    setScheduleDraft: updater => saved = updater(original), removedStoredAttachments: [], setRemovedStoredAttachments() {},
    setAttachmentUploadState() {}, isMinimized: false, triggerHaptic() {}, sheetRef: { current: { close: () => closed++ } } })();
  assert.equal(saved.slotDurations.length, 5);
  assert.deepEqual(saved.breaks, [10, 10, 10, 10]);
  assert.deepEqual(saved.schedule[0].week1.map(item => item.slotNumber), [1, 2, 3, 4, 5]);
  assert.equal(saved.schedule[0].week2[0].slotNumber, 5);
  assert.deepEqual(timing.buildLessonTimes(saved.start_time, saved.duration, saved.breaks, saved.schedule[0].week1, saved.slotDurations).at(-1),
    { start: '12:10', end: '12:55' });
  assert.equal(closed, 1);
  assert.equal(JSON.stringify(original), before);
});

test('saving without choosing or creating a slot leaves the timetable unchanged', async () => {
  const alerts = [];
  let screen;
  await editorHandler('handleSave', { slotConflict: null, timingDraft: null, instanceData: { timeMode: 'slot' }, timeSlots: [{ number: 1 }],
    dialog: { alert: options => alerts.push(options) }, t: key => key, lang: 'uk', setCurrentScreen: value => screen = value })();
  assert.equal(alerts[0].message, 'schedule.lesson_editor.slot_choose_or_add');
  assert.equal(screen, 'main');
});

test('holding an occupied slot and its pencil edit that slot without selecting or replacing it', async t => {
  const edits = [], selections = [];
  const root = await render(t, 'screens/MainScreen.jsx', mainProps({
    timeSlots: [{ number: 4, start: '13:10', end: '14:30', occupied: true }],
    onEditSlot: number => edits.push(number), onSlotChange: number => selections.push(number),
  }));
  const slot = root.findAllByType('Button').find(node => node.props.onLongPress);
  await act(async () => slot.props.onLongPress());
  await press(button(root, i18n.t('schedule.lesson_editor.slot_edit', 'uk', { number: 4 })));
  assert.deepEqual(edits, [4, 4]);
  assert.deepEqual(selections, []);
});

test('slot editing opens the shared timing screen and keeps timing changes local', () => {
  const result = {};
  editorHandler('handleEditSlot', { goToScreen: (screen, number) => { result.screen = screen; result.slot = number; } })(6);
  assert.deepEqual(result, { slot: 6, screen: 'slotTime' });
  const timing = { start_time: '09:00', slotDurations: [80, 80], breaks: [10] };
  editorHandler('handleTimingChange', { setTimingDraft: value => result.timing = value,
    setSlotConflict: value => result.conflict = value, setConflictResolution: value => result.resolution = value })(timing);
  assert.equal(result.timing, timing);
  assert.equal(result.conflict, null);
  assert.equal(result.resolution, null);
});

test('invalid slot timing remains editable instead of returning to an empty slot grid', () => {
  const alerts = [];
  editorHandler('handleBack', { triggerHaptic() {}, currentScreen: 'slotTime', timeSlots: [],
    dialog: { alert: options => alerts.push(options) }, t: key => key, lang: 'uk' })();
  assert.equal(alerts[0].message, 'settings.schedule_editor.timing.invalid');
});

test('saving a timing shift checks custom overlaps on other days and weeks before committing', async () => {
  const timing = load('src/utils/scheduleTime.js');
  const { applyLessonRecurrence } = load('src/utils/lessonRecurrence.js');
  const schedule = { repeat: 2, start_time: '08:30', duration: 45, slotDurations: [45, 45], breaks: [10],
    schedule: [{ week1: [] }, { week2: [{ subjectId: 'math', timeMode: 'slot', slotNumber: 1 },
      { subjectId: 'other', timeMode: 'custom', startTime: '09:30', endTime: '10:00' }] }] };
  const timingDraft = { ...timing.createScheduleTimingDraft(schedule), start_time: '09:00' };
  const timingSchedule = { ...schedule, ...timingDraft };
  const slots = timing.buildScheduleSlots(timingDraft.start_time, timingDraft.duration, timingDraft.breaks, timingDraft.slotDurations);
  const alerts = [];
  await editorHandler('handleSave', { ...timing, slotConflict: null, timingDraft, timingSchedule, schedule,
    instanceData: { timeMode: 'slot', slotNumber: 2 }, timeSlots: slots, storedDefaultTime: slots[1],
    getSlotConflict: () => ({ conflicts: [] }), selectedSubjectId: 'math', conflictResolution: null,
    placementOptions: { dayIndex: 0, weekNumber: 1, lessonIndex: null, selection: { mode: 'selected', weeks: [1] } },
    applyLessonRecurrence, dialog: { alert: options => alerts.push(options) }, lang: 'uk', t: (key, _lang, params) => ({ key, params }) })();
  assert.equal(alerts[0].message.key, 'settings.schedule_editor.timing.conflict');
  assert.equal(alerts[0].message.params.dayIndex, 1);
  assert.equal(alerts[0].message.params.week, 2);
});
