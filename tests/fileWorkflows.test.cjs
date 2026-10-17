const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const babel = require('@babel/core');
const { IDBFactory, IDBObjectStore } = require('fake-indexeddb');
const JSZip = require('jszip');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  loaded._compile(compiled.get(filename), filename);
  return loaded.exports;
}

const i18n = load('src/utils/i18n.js', {
  '../locales/en.js': load('src/locales/en.js'), '../locales/uk.js': load('src/locales/uk.js'),
});
const scheduleTime = load('src/utils/scheduleTime.js');
const documentBranding = load('src/config/documentBranding.js');
const exportsUtil = load('src/utils/scheduleExport.js', {
  './scheduleTime': scheduleTime, './i18n': i18n, './contactData': load('src/utils/contactData.js'),
  '../config/documentBranding': documentBranding,
});
const spreadsheetUtil = load('src/utils/scheduleSpreadsheet.js', {
  './i18n': i18n, './scheduleExport': exportsUtil, '../config/documentBranding': documentBranding,
});

function environment(platform = 'android') {
  const files = new Map();
  const settings = new Map();
  const shared = [];
  let failCopy = false;
  const fs = {
    documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },
    makeDirectoryAsync: async () => {},
    getInfoAsync: async uri => ({ exists: files.has(uri) || [...files.keys()].some(key => key.startsWith(uri)), size: files.get(uri)?.length }),
    copyAsync: async ({ from, to }) => {
      if (failCopy || !files.has(from)) throw new Error('copy failed');
      files.set(to, files.get(from));
    },
    moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); },
    deleteAsync: async uri => { for (const key of files.keys()) if (key.startsWith(uri)) files.delete(key); },
    writeAsStringAsync: async (uri, data, options) => files.set(uri, Buffer.from(data, options.encoding)),
    readDirectoryAsync: async uri => [...new Set([...files.keys()].filter(key => key.startsWith(uri)).map(key => key.slice(uri.length).split('/')[0]))],
    getContentUriAsync: async uri => 'content://planit/' + uri.split('/').pop(),
  };
  const mocks = {
    'react-native': { Platform: { OS: platform }, Linking: {}, Image: {}, Share: { share: async value => shared.push(value) } },
    '@react-native-async-storage/async-storage': {
      getItem: async key => settings.get(key) || null,
      setItem: async (key, value) => { await new Promise(resolve => setImmediate(resolve)); settings.set(key, value); },
      removeItem: async key => settings.delete(key),
    },
    'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-image-manipulator': {},
    'expo-file-system/legacy': fs,
    'expo-intent-launcher': { startActivityAsync: async (...args) => shared.push(args) },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => shared.push({ uri, options, bytes: files.get(uri) }) },
    'expo-print': { printToFileAsync: async options => {
      shared.push(options); files.set('file:///cache/print.pdf', Buffer.from('%PDF-1.7'));
      return { uri: 'file:///cache/print.pdf' };
    } },
    'firebase/storage': new Proxy({}, { get: (_, key) => {
      if (key === '__esModule') return false;
      return () => { throw new Error('Unexpected Firebase call: ' + key); };
    } }),
    '../config/firebase': { auth: { currentUser: null }, storage: {}, storageBucketName: 'test' },
    '../utils/idGenerator': { generateId: randomUUID },
    '../utils/i18n': i18n,
    '../utils/scheduleExport': exportsUtil,
    '../utils/scheduleSpreadsheet': spreadsheetUtil,
    '../config/documentBranding': documentBranding,
  };
  mocks['./fileSharingService'] = load('src/services/fileSharingService.js', mocks);
  mocks['./schedulePdfService'] = load(platform === 'web' ? 'src/services/schedulePdfService.web.js' : 'src/services/schedulePdfService.js', mocks);
  return { files, settings, shared, fs, mocks, failCopies: () => { failCopy = true; },
    attachments: () => load('src/services/attachmentService.js', mocks),
    exports: () => load('src/services/scheduleExportService.js', mocks),
  };
}

function nativeDraft(env, id = 'document') {
  const uri = 'file:///picker/' + id + '.pdf';
  env.files.set(uri, Buffer.from('%PDF-1.7 local bytes'));
  return { id, name: id + '.pdf', mimeType: 'application/pdf', size: env.files.get(uri).length, localUri: uri, createdAt: 100 };
}

function webExportEnvironment(t, navigator = {}) {
  const document = global.document;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');
  const downloads = [], blobs = new Map();
  const originalTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (callback, delay, ...args) => (
    delay === 60000 ? 0 : originalTimeout(callback, delay, ...args)
  ));
  t.mock.method(URL, 'createObjectURL', blob => {
    const url = 'blob:export-' + blobs.size;
    blobs.set(url, blob);
    return url;
  });
  Object.defineProperty(global, 'navigator', { configurable: true, value: navigator });
  global.document = {
    body: { appendChild() {} },
    createElement: tag => {
      assert.equal(tag, 'a', 'exports download files without an HTML print frame');
      const node = { tag, style: {}, remove() {} };
      if (tag === 'a') node.click = () => downloads.push({ name: node.download, blob: blobs.get(node.href) });
      return node;
    },
  };
  t.after(() => {
    global.document = document;
    if (navigatorDescriptor) Object.defineProperty(global, 'navigator', navigatorDescriptor);
    else delete global.navigator;
  });
  return { downloads, service: environment('web').exports() };
}

test('native guest file survives normalization, a restart, rename, and picker cache removal', async () => {
  const env = environment();
  let service = env.attachments();
  const draft = nativeDraft(env);
  const [saved] = await service.storeAttachmentDrafts([draft]);
  assert.equal(saved.storageMode, 'local');
  assert.equal(saved.storagePath, null);
  env.files.delete(draft.localUri);
  const renamed = service.renameAttachmentDisplayName(saved, 'Навчальний матеріал');
  const library = service.normalizeAttachmentLibrary([renamed]);
  assert.equal(library[0].localUri, undefined);
  service = env.attachments();
  const [reference] = service.resolveAttachmentList([service.createAttachmentReference(library[0])], library);
  const local = await service.ensureLocalAttachment(reference);
  assert.deepEqual(env.files.get(local.localUri), Buffer.from('%PDF-1.7 local bytes'));
  assert.equal(service.getAttachmentLibraryUsage(library), 0);
  await service.openAttachment(reference);
  assert.equal(env.shared[0][0], 'android.intent.action.VIEW');
  assert.equal(env.shared[0][1].type, 'application/pdf');
  assert.equal(env.shared[0][1].flags, 1);
});

test('concurrent native writes keep both manifest entries after files are renamed', async () => {
  const env = environment();
  const service = env.attachments();
  const results = await Promise.all(['one', 'two'].map(id => service.storeAttachmentDrafts([nativeDraft(env, id)])));
  const renamed = results.flat().map(file => service.renameAttachmentDisplayName(file, 'renamed-' + file.id));
  const reloaded = env.attachments();
  for (const file of service.normalizeAttachmentLibrary(renamed)) assert.equal((await reloaded.getAttachmentCacheState(file)).status, 'local');
});

test('failed local batches roll back only newly created files', async () => {
  const env = environment();
  const service = env.attachments();
  const [existing] = await service.storeAttachmentDrafts([nativeDraft(env, 'existing')]);
  const first = nativeDraft(env, 'new');
  const missing = { ...nativeDraft(env, 'missing'), localUri: 'file:///does-not-exist.pdf' };
  await assert.rejects(service.storeAttachmentDrafts([existing, first, missing]), { attachmentCode: 'cache_unavailable' });
  assert.ok(['local', 'source'].includes((await service.getAttachmentCacheState(existing)).status));
  assert.equal([...env.files.keys()].some(uri => uri.startsWith('file:///documents/attachments/new-')), false);
});

test('cloud uploads require authentication; local storage failures never report success', async () => {
  const env = environment();
  const service = env.attachments();
  await assert.rejects(service.storeAttachmentDrafts([nativeDraft(env)], { storageMode: 'cloud' }), { attachmentCode: 'auth_required' });
  env.failCopies();
  await assert.rejects(service.storeAttachmentDrafts([nativeDraft(env)]), { attachmentCode: 'cache_unavailable' });
});

for (const platform of ['web', 'android']) {
  test(platform + ': clearing account caches preserves guest files', async t => {
    const env = environment(platform);
    if (platform === 'web') {
      const original = global.indexedDB;
      global.indexedDB = new IDBFactory();
      t.after(() => { global.indexedDB = original; });
    }
    const service = env.attachments();
    const draft = id => platform === 'web'
      ? { id, name: id + '.pdf', mimeType: 'application/pdf', size: 5, file: new Blob(['%PDF-']) }
      : nativeDraft(env, id);
    const [guest, account] = await service.storeAttachmentDrafts([draft('guest'), draft('account')]);
    await service.clearAllLocalAttachmentCaches({ preserve: [guest] });
    const reloaded = env.attachments();
    const [guestFile, accountFile] = reloaded.normalizeAttachmentLibrary([guest, account]);
    assert.equal((await reloaded.getAttachmentCacheState(guestFile)).status, 'local');
    assert.equal((await reloaded.getAttachmentCacheState(accountFile)).status, 'missing');
    await assert.rejects(reloaded.ensureLocalAttachment(accountFile), { attachmentCode: 'local_missing' });
  });
}

test('web guest documents survive a service restart with bytes and inferred MIME type', async t => {
  const original = global.indexedDB;
  global.indexedDB = new IDBFactory();
  t.after(() => { global.indexedDB = original; });
  let service = environment('web').attachments();
  const blob = new Blob(['%PDF- Ukrainian bytes']);
  const [saved] = await service.storeAttachmentDrafts([{ id: 'pdf', name: 'Лекція.pdf', mimeType: 'application/pdf', size: blob.size, file: blob }]);
  const [record] = service.normalizeAttachmentLibrary([saved]);
  service = environment('web').attachments();
  const local = await service.ensureLocalAttachment(record);
  const response = await fetch(local.localUri);
  assert.equal(await response.text(), '%PDF- Ukrainian bytes');
  assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('an IndexedDB transaction aborted after put success does not acknowledge a saved file', async t => {
  const originalDb = global.indexedDB;
  const originalPut = IDBObjectStore.prototype.put;
  global.indexedDB = new IDBFactory();
  IDBObjectStore.prototype.put = function (...args) {
    const request = originalPut.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort());
    return request;
  };
  t.after(() => { global.indexedDB = originalDb; IDBObjectStore.prototype.put = originalPut; });
  const service = environment('web').attachments();
  await assert.rejects(service.storeAttachmentDrafts([{ id: 'aborted', name: 'file.pdf', mimeType: 'application/pdf', file: new Blob(['pdf']), size: 3 }]), { attachmentCode: 'cache_unavailable' });
  assert.equal((await service.getAttachmentCacheState({ id: 'aborted', name: 'file.pdf' })).status, 'missing');
});

test('web PDF preview reserves its tab before async work; Word downloads without opening a tab', async t => {
  const originals = { indexedDB: global.indexedDB, window: global.window, document: global.document };
  const opened = [], downloaded = [];
  global.indexedDB = new IDBFactory();
  global.window = { open: () => {
    const page = { opener: 'parent', location: { replace: uri => { page.uri = uri; } }, close: () => { page.closed = true; } };
    opened.push(page);
    return page;
  } };
  global.document = { body: { appendChild() {} }, createElement: () => {
    const anchor = { style: {}, click: () => downloaded.push(anchor.download), remove() {} };
    return anchor;
  } };
  t.after(() => Object.assign(global, originals));
  const service = environment('web').attachments();
  const [pdf, word] = service.normalizeAttachmentLibrary(await service.storeAttachmentDrafts([
    { id: 'pdf', name: 'file.pdf', mimeType: 'application/pdf', size: 3, file: new Blob(['pdf']) },
    { id: 'word', name: 'file.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 4, file: new Blob(['docx']) },
  ]));
  const opening = service.openAttachment(pdf);
  assert.equal(opened.length, 1);
  await opening;
  assert.equal(opened[0].opener, null);
  assert.match(opened[0].uri, /^blob:/);
  await service.openAttachment(word);
  assert.equal(opened.length, 1);
  assert.deepEqual(downloaded, ['file.docx']);
  await assert.rejects(service.openAttachment({ storageMode: 'local', id: 'missing', name: 'missing.pdf', mimeType: 'application/pdf' }), { attachmentCode: 'local_missing' });
  assert.equal(opened[1].closed, true);
});

test('iOS opens documents through the system sheet with the correct file type', async () => {
  const env = environment('ios');
  const service = env.attachments();
  const [file] = await service.storeAttachmentDrafts([nativeDraft(env)]);
  await service.openAttachment(service.renameAttachmentDisplayName(file, 'Лекція'));
  assert.equal(env.shared[0].options.UTI, 'com.adobe.pdf');
  assert.equal(env.shared[0].options.mimeType, 'application/pdf');
  assert.equal(env.shared[0].uri.endsWith('/Лекція.pdf'), true);
});

test('account cleanup keeps guest originals while clearing shared snapshots and account data', async () => {
  const env = environment();
  const service = env.attachments();
  const [guest] = await service.storeAttachmentDrafts([nativeDraft(env)]);
  const snapshot = 'file:///cache/file-shares/temporary/file.pdf';
  env.files.set(snapshot, Buffer.from('shared snapshot'));
  const cleared = [];
  const cleanup = load('src/services/localAccountDataService.js', {
    ...env.mocks,
    '../utils/storage': {
      getLocalSchedule: async () => ({ global: { fileLibrary: [guest] }, schedules: [] }),
      clearLocalSchedule: async (userId, options) => cleared.push({ userId, options }),
    },
    './attachmentService': service,
    './notificationService': { clearAllLocalNotifications: async () => {} },
    '../widgets/widgetService': { clearWidgetScheduleData: async () => {} },
    '@react-native-async-storage/async-storage': { multiRemove: async () => {} },
  });
  await cleanup.clearLocalAccountData('account-id');
  assert.equal(cleared[0].userId, 'account-id');
  assert.equal(cleared[0].options.preventWrites, true);
  assert.equal(env.files.has(snapshot), false);
  assert.equal((await service.getAttachmentCacheState(service.normalizeAttachmentLibrary([guest])[0])).status, 'local');
});

const schedule = () => ({
  name: 'Розклад <науки>', repeat: 2, start_time: '08:30', duration: 45, slotDurations: [45, 90, 45], breaks: [10, 20],
  subjects: [{ id: 's', name: 'Математика', room: '204', teachers: ['teacher'], links: ['link'], note: 'Private note', attachments: [{ fileId: 'private-file' }] }],
  teachers: [{ id: 'teacher', name: 'Олена', phone: 'PRIVATE PHONE', contacts: [{ value: 'PRIVATE EMAIL' }] }],
  links: [{ id: 'link', url: 'https://example.org/class' }],
  tasks: [{ text: 'PRIVATE TASK' }],
  schedule: [{ week1: [null, { subjectId: 's', timeMode: 'slot', slotNumber: 2 }, { subjectId: 's', timeMode: 'custom', startTime: '07:00', endTime: '07:40', teachers: [], links: [], note: '' }], week2: ['s'] }],
});

test('export follows schedule timing, sorting, all cycle weeks, and empty instance overrides', () => {
  const model = exportsUtil.buildScheduleExport(schedule(), 'uk');
  assert.equal(model.weeks.length, 2);
  assert.equal(model.weeks[0].days[0].title, 'Понеділок');
  const rows = model.weeks[0].days[0].lessons;
  assert.equal(rows[0].time, '07:00 – 07:40');
  assert.deepEqual(rows[0].details, ['204']);
  assert.equal(rows[1].time, '09:25 – 10:55');
  assert.equal(rows[1].details.includes('Олена'), true);
  assert.equal(model.weeks[1].days[0].lessons[0].time, '08:30 – 09:15');
  assert.equal(model.weeks[0].days.length, 1);
  assert.equal(exportsUtil.buildScheduleExport(schedule(), 'uk', { showEmptyDays: true }).weeks[0].days[6].lessons.length, 0);
});

test('new schedules without a lesson grid export as empty cycle weeks', () => {
  for (const grid of [undefined, null, []]) {
    const input = { id: 'new-schedule', name: 'Без назви', repeat: 2, schedule: grid };
    const model = exportsUtil.buildScheduleExport(input, 'uk');
    assert.equal(model.title, 'Без назви');
    assert.equal(model.weeks.length, 2);
    assert.equal(model.weeks.every(week => week.days.length === 7 && week.days.every(day => day.lessons.length === 0)), true);
    assert.match(exportsUtil.scheduleExportToHtml(model), /Занять немає/);
    assert.match(exportsUtil.scheduleExportToText(model), /Тиждень 2/);
    assert.match(exportsUtil.scheduleExportToCsv(model), /Предмет/);
  }
});

test('export rejects a missing schedule and a malformed nonempty lesson grid', () => {
  for (const input of [null, undefined, 'schedule', [], { schedule: 'invalid' }, { schedule: { week1: ['lesson'] } }]) {
    assert.throws(() => exportsUtil.buildScheduleExport(input, 'uk'), /invalid_schedule/);
  }
});

test('all browser export formats handle a new schedule without a lesson grid', async t => {
  const { service, downloads } = webExportEnvironment(t);
  const input = { id: 'new-schedule', name: 'Без назви', repeat: 1 };
  for (const format of ['pdf', 'docx', 'xlsx', 'csv', 'text']) await service.exportSchedule(input, format, 'uk');
  assert.deepEqual(downloads.map(file => file.name), ['PlanIt-Без назви.pdf', 'PlanIt-Без назви.docx', 'PlanIt-Без назви.xlsx', 'PlanIt-Без назви.csv', 'PlanIt-Без назви.txt']);
  assert.equal(downloads[0].blob.type, 'application/pdf');
  assert.match(Buffer.from(await downloads[0].blob.arrayBuffer()).toString('latin1'), /^%PDF-/);
  const zip = await JSZip.loadAsync(await downloads[1].blob.arrayBuffer());
  assert.match(await zip.file('word/document.xml').async('string'), /Занять немає/);
  const workbook = await JSZip.loadAsync(await downloads[2].blob.arrayBuffer());
  assert.match(await workbook.file('xl/worksheets/sheet1.xml').async('string'), /Занять немає/);
  assert.match(await downloads[3].blob.text(), /Предмет/);
  assert.match(await downloads[4].blob.text(), /Тиждень 1/);
});

test('browser text export downloads a file when system sharing is denied', async t => {
  const { service, downloads } = webExportEnvironment(t, {
    share: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
  });
  await service.exportSchedule(schedule(), 'text', 'uk');
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].name, /\.txt$/);
  assert.match(await downloads[0].blob.text(), /Математика/);
});

test('cancelling browser system sharing does not start an unwanted download', async t => {
  const { service, downloads } = webExportEnvironment(t, {
    share: async () => { throw new DOMException('Cancelled', 'AbortError'); },
  });
  await service.exportSchedule(schedule(), 'text', 'uk');
  assert.equal(downloads.length, 0);
});

test('export privacy excludes attachments, tasks, teacher contacts, and disabled details', () => {
  const model = exportsUtil.buildScheduleExport(schedule(), 'en', { shareTeachers: false, shareNotes: false, shareLinks: false, shareAuthorName: false, authorName: 'PRIVATE AUTHOR' });
  for (const output of [exportsUtil.scheduleExportToText(model), exportsUtil.scheduleExportToHtml(model), exportsUtil.scheduleExportToCsv(model)]) {
    assert.doesNotMatch(output, /PRIVATE|Private note|Олена|private-file|example.org/);
  }
});

test('HTML escapes markup and CSV prevents formula interpretation while preserving Unicode', () => {
  const input = schedule();
  input.subjects[0].name = '=HYPERLINK("https://example.org")';
  input.subjects[0].note = '<script>bad()</script>\nДруга стрічка';
  const model = exportsUtil.buildScheduleExport(input, 'uk', { shareNotes: true });
  const html = exportsUtil.scheduleExportToHtml(model);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  const csv = exportsUtil.scheduleExportToCsv(model);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /"'=HYPERLINK\(""https:/);
  assert.match(csv, /Друга стрічка/);
});

test('Word export creates a real DOCX package containing Ukrainian tables and cycle weeks', async () => {
  const service = environment().exports();
  const model = exportsUtil.buildScheduleExport(schedule(), 'uk', { shareNotes: false });
  const base64 = await service.createScheduleWordDocument(model);
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const xml = await zip.file('word/document.xml').async('string');
  assert.match(xml, /Математика/);
  assert.match(xml, /Тижні 1 і 2/);
  assert.match(xml, /09:25/);
  assert.match(xml, /<w:tbl>/);
  assert.doesNotMatch(xml, /PRIVATE|Private note|private-file/);
});

const combinedSchedule = () => {
  const input = schedule();
  const shared = { subjectId: 's', timeMode: 'slot', slotNumber: 1 };
  input.schedule = [{
    week1: [shared, { ...shared, slotNumber: 2, note: 'First week only' }],
    week2: [{ ...shared }, { ...shared, slotNumber: 2, note: 'Second week only', teachers: [] }],
  }];
  return input;
};

test('combined grid merges identical sessions but retains week-specific details, gaps and both times', () => {
  const document = exportsUtil.buildScheduleExport(combinedSchedule(), 'en', { layout: 'combined', shareNotes: true });
  const [section] = exportsUtil.getScheduleExportSections(document);
  assert.equal(section.title, 'Weeks 1 and 2');
  assert.equal(document.settings.orientation, 'landscape');
  const rows = exportsUtil.getScheduleExportCombinedRows(section);
  assert.deepEqual(rows.map(row => [row.start, row.weeks, row.timeRowSpan]), [
    ['08:30', [1, 2], 1], ['09:25', [1], 2], ['09:25', [2], 0],
  ]);
  assert.equal(rows[1].cells[0].lessons[0].note, 'First week only');
  assert.equal(rows[2].cells[0].lessons[0].note, 'Second week only');
  const html = exportsUtil.scheduleExportToHtml(document);
  assert.equal((html.match(/<table /g) || []).length, 1);
  assert.match(html, /class="cycle-week">1<\/th>/);
  assert.match(html, /class="cycle-week">2<\/th>/);
  assert.match(html, /rowspan="2" class="time"/);
  assert.match(html, /First week only/);
  assert.match(html, /Second week only/);
  assert.equal((html.match(/href="https:\/\/example.org\/class"/g) || []).length, 3);
  const sparse = combinedSchedule();
  sparse.schedule[0].week2 = [];
  const sparseRows = exportsUtil.getScheduleExportCombinedRows(exportsUtil.getScheduleExportSections(exportsUtil.buildScheduleExport(sparse, 'en', { layout: 'combined' }))[0]);
  assert.deepEqual(sparseRows.map(row => row.weeks), [[1], [2], [1], [2]]);
  assert.ok(sparseRows.filter(row => row.weeks[0] === 2).every(row => row.cells[0].lessons.length === 0));
  assert.ok(sparseRows.filter(row => row.weeks[0] === 1).every(row => row.cells[0].lessons.length === 1));
});

test('combined week rows keep opposite-day gaps aligned and merge only identical cells across formats', async () => {
  const input = schedule();
  input.subjects.push({ id: 'other', name: 'Second subject' });
  input.schedule = [
    { week1: [], week2: ['s'] },
    { week1: ['other'], week2: [] },
    { week1: ['s'], week2: ['s'] },
  ];
  const document = exportsUtil.buildScheduleExport(input, 'en', { layout: 'combined' });
  const rows = exportsUtil.getScheduleExportCombinedRows(exportsUtil.getScheduleExportSections(document)[0]);
  assert.deepEqual(rows.map(row => row.weeks), [[1], [2]]);
  assert.deepEqual(rows.map(row => row.cells.map(cell => cell.lessons.map(lesson => lesson.title))), [
    [[], ['Second subject'], ['Математика']], [['Математика'], [], []],
  ]);
  assert.deepEqual(rows.map(row => row.cells.map(cell => cell.rowSpan)), [[1, 1, 2], [1, 1, 0]]);
  const html = exportsUtil.scheduleExportToHtml(document);
  assert.equal((html.match(/class="dash">—/g) || []).length, 2);
  assert.equal((html.match(/Математика<\/div>/g) || []).length, 2);
  assert.match(html, /<td rowspan="2" class="">/);

  const word = await JSZip.loadAsync(await environment().exports().createScheduleWordDocument(document), { base64: true });
  const xml = await word.file('word/document.xml').async('string');
  const wordRows = [...xml.matchAll(/<w:tr>.*?<\/w:tr>/g)].map(row => [...row[0].matchAll(/<w:tc>.*?<\/w:tc>/g)].map(cell => cell[0]));
  assert.deepEqual(wordRows.map(row => row.length), [5, 5, 5]);
  assert.match(wordRows[1][0], /w:vMerge w:val="restart"/);
  assert.match(wordRows[2][0], /w:vMerge w:val="continue"/);
  assert.match(wordRows[1][1], />1<\/w:t>/);
  assert.match(wordRows[2][1], />2<\/w:t>/);
  assert.match(wordRows[1][2], />—<\/w:t>/);
  assert.match(wordRows[2][2], /Математика/);
  assert.match(wordRows[1][3], /Second subject/);
  assert.match(wordRows[2][3], />—<\/w:t>/);
  assert.match(wordRows[1][4], /w:vMerge w:val="restart"/);
  assert.match(wordRows[2][4], /w:vMerge w:val="continue"/);

  let definition;
  const service = load('src/services/schedulePdfService.web.js', {
    'pdfmake/build/pdfmake': { addVirtualFileSystem() {}, createPdf: value => {
      definition = value;
      return { getBuffer: async () => new Uint8Array() };
    } },
    'pdfmake/build/vfs_fonts': {}, '../utils/scheduleExport': exportsUtil, '../utils/i18n': i18n,
    '../config/documentBranding': documentBranding, './fileSharingService': {},
  });
  await service.createSchedulePdfDocument(document);
  const outerTable = definition.content.find(item => item.table).table;
  assert.equal(outerTable.headerRows, 1);
  assert.equal(outerTable.dontBreakRows, true);
  assert.equal(outerTable.body.length, 2);
  const table = outerTable.body[1][0].table;
  assert.equal(table.widths.length, 5);
  assert.deepEqual(table.body.map(row => row.length), [5, 5]);
  assert.equal(table.body[0][0].rowSpan, 2);
  assert.deepEqual(table.body[1][0], {});
  assert.equal(table.body[0][1].text, '1');
  assert.equal(table.body[1][1].text, '2');
  assert.equal(table.body[0][2].text, '—');
  assert.match(JSON.stringify(table.body[1][2]), /Математика/);
  assert.match(JSON.stringify(table.body[0][3]), /Second subject/);
  assert.equal(table.body[1][3].text, '—');
  assert.equal(table.body[0][4].rowSpan, 2);
  assert.deepEqual(table.body[1][4], {});
});

test('combined layout pairs only selected weeks, supports one or an odd count, and never merges more than two', () => {
  const input = combinedSchedule();
  input.repeat = 5;
  for (let week = 3; week <= 5; week++) input.schedule[0][`week${week}`] = input.schedule[0].week1;
  const sections = exportsUtil.getScheduleExportSections(exportsUtil.buildScheduleExport(input, 'uk', { layout: 'combined' }));
  assert.deepEqual(sections.map(section => section.weeks?.map(week => week.number) || [section.number]), [[1, 2], [3, 4], [5]]);
  const selected = exportsUtil.buildScheduleExport(input, 'en', { layout: 'combined', selectedWeeks: [2, 5] });
  assert.equal(exportsUtil.getScheduleExportSections(selected)[0].title, 'Weeks 2 and 5');
  assert.ok(exportsUtil.getScheduleExportCombinedRows(exportsUtil.getScheduleExportSections(selected)[0])
    .every(row => row.weeks.every(week => week === 2 || week === 5)));
  assert.equal((exportsUtil.scheduleExportToHtml(exportsUtil.buildScheduleExport(input, 'en', { layout: 'combined', selectedWeeks: [3] })).match(/<table /g) || []).length, 1);
  const empty = exportsUtil.buildScheduleExport({ repeat: 2 }, 'uk', { layout: 'combined' });
  assert.match(exportsUtil.scheduleExportToHtml(empty), /Занять немає/);
});

test('week calendar follows the timetable cycle and computes the reference semester without gaps or reversed dates', () => {
  const input = { ...schedule(), starting_week: '2026-08-31T12:00:00', repeat: 2 };
  assert.equal(exportsUtil.buildScheduleExport(input, 'uk').weekCalendar, null);
  const calendar = exportsUtil.buildScheduleExport(input, 'uk', {
    includeWeekCalendar: true, calendarFrom: '2026-09-02', calendarTo: '2026-12-13', selectedWeeks: [2],
  }).weekCalendar;
  assert.equal(calendar.rows.length, 15);
  assert.deepEqual(calendar.rows.map(row => [row.from, row.to, row.week]).slice(0, 3), [
    ['2026-09-02', '2026-09-06', 1], ['2026-09-07', '2026-09-13', 2], ['2026-09-14', '2026-09-20', 1],
  ]);
  assert.deepEqual(calendar.rows.slice(-4).map(row => [row.from, row.to, row.week]), [
    ['2026-11-16', '2026-11-22', 2], ['2026-11-23', '2026-11-29', 1],
    ['2026-11-30', '2026-12-06', 2], ['2026-12-07', '2026-12-13', 1],
  ]);
  assert.match(calendar.selectionNote, /весь цикл/);
  assert.match(calendar.rows[0].period, /2026/);
  assert.match(calendar.description, /31 серпня 2026/);
  assert.equal(calendar.columns[2], 'Тиждень циклу');
});

test('calendar respects non-Monday cycle boundaries, dates before the anchor, one-week cycles and year changes', () => {
  const input = { starting_week: '2026-09-02T12:00:00', repeat: 3 };
  const calendar = exportsUtil.buildScheduleWeekCalendar(input, 'en', { includeWeekCalendar: true, calendarFrom: '2026-09-01', calendarTo: '2026-09-17' });
  assert.deepEqual(calendar.rows.map(row => [row.from, row.to, row.week]), [
    ['2026-09-01', '2026-09-01', 3], ['2026-09-02', '2026-09-08', 1],
    ['2026-09-09', '2026-09-15', 2], ['2026-09-16', '2026-09-17', 3],
  ]);
  assert.equal(calendar.title, 'Week calendar');
  const single = exportsUtil.buildScheduleWeekCalendar({ starting_week: '2026-12-28T12:00:00', repeat: 1 }, 'en', {
    includeWeekCalendar: true, calendarFrom: '2026-12-30', calendarTo: '2027-01-10',
  });
  assert.deepEqual(single.rows.map(row => [row.from, row.to, row.week]), [['2026-12-30', '2027-01-03', 1], ['2027-01-04', '2027-01-10', 1]]);
  assert.match(single.rows[0].period, /2026.*2027/);
  const daylightSaving = exportsUtil.buildScheduleWeekCalendar({ starting_week: '2026-10-12T12:00:00', repeat: 2 }, 'uk', {
    includeWeekCalendar: true, calendarFrom: '2026-10-19', calendarTo: '2026-11-08',
  });
  assert.deepEqual(daylightSaving.rows.map(row => [row.from, row.to, row.week]), [
    ['2026-10-19', '2026-10-25', 2], ['2026-10-26', '2026-11-01', 1], ['2026-11-02', '2026-11-08', 2],
  ]);
});

test('calendar presets preserve calendar dates and validation rejects impossible or excessive ranges only when enabled', () => {
  const input = { starting_week: '2026-08-31T12:00:00', repeat: 2 };
  assert.deepEqual(exportsUtil.getScheduleExportCalendarRange(input, 4, '2026-09-02'), { calendarFrom: '2026-09-02', calendarTo: '2026-09-29' });
  assert.deepEqual(exportsUtil.getScheduleExportCalendarRange(input, 8, new Date('2026-09-02T12:00:00')), { calendarFrom: '2026-09-02', calendarTo: '2026-10-27' });
  for (const [calendarFrom, calendarTo] of [['2026-02-30', '2026-03-05'], ['2026-09-08', '2026-09-01'], ['2026-01-01', '2027-01-02'], ['bad', '2026-09-01']]) {
    assert.throws(() => exportsUtil.buildScheduleWeekCalendar(input, 'uk', { includeWeekCalendar: true, calendarFrom, calendarTo }), /invalid_week_calendar_range/);
    assert.equal(exportsUtil.buildScheduleWeekCalendar(input, 'uk', { calendarFrom, calendarTo }), null);
  }
  assert.throws(() => exportsUtil.buildScheduleWeekCalendar({ repeat: 2 }, 'en', { includeWeekCalendar: true }), /week_calendar_missing_anchor/);
  const oneDay = exportsUtil.buildScheduleWeekCalendar(input, 'en', { includeWeekCalendar: true, calendarFrom: '2026-09-08', calendarTo: '2026-09-08' });
  assert.equal(oneDay.rows[0].week, 2);
  assert.equal(oneDay.rows[0].from, oneDay.rows[0].to);
  assert.equal(exportsUtil.buildScheduleWeekCalendar(input, 'en', { includeWeekCalendar: true, calendarFrom: '2028-01-01', calendarTo: '2028-12-31' }).rows.at(-1).to, '2028-12-31');
});

test('PDF, Word, native HTML and Excel append the same optional calendar with localised dates and printable tables', async t => {
  const input = { ...combinedSchedule(), starting_week: '2026-08-31T12:00:00' };
  const options = { layout: 'combined', includeWeekCalendar: true, calendarFrom: '2026-09-02', calendarTo: '2026-12-13', color: 'mono' };
  const model = exportsUtil.buildScheduleExport(input, 'en', options);
  const html = exportsUtil.scheduleExportToHtml(model);
  assert.match(html, /class="week week-calendar"/);
  assert.ok(html.lastIndexOf('Week calendar') > html.indexOf('Weeks 1 and 2'));
  assert.doesNotMatch(html, /PRIVATE|Private note|private-file/);
  const word = await JSZip.loadAsync(await environment().exports().createScheduleWordDocument(model), { base64: true });
  const xml = await word.file('word/document.xml').async('string');
  assert.equal((xml.match(/<w:tbl>/g) || []).length, 2);
  assert.equal((xml.match(/<w:tblHeader\/>/g) || []).length, 2);
  assert.ok(xml.lastIndexOf('Week calendar') > xml.indexOf('Weeks 1 and 2'));
  const workbook = await JSZip.loadAsync(await spreadsheetUtil.createScheduleSpreadsheet(model), { base64: true });
  assert.match(await workbook.file('xl/workbook.xml').async('string'), /name="Week calendar" sheetId="2"/);
  assert.match(await workbook.file('xl/worksheets/sheet2.xml').async('string'), /<autoFilter ref="A5:D20"/);
  assert.match(await workbook.file('xl/worksheets/sheet2.xml').async('string'), /<pane ySplit="5"/);
  assert.match(await workbook.file('xl/styles.xml').async('string'), /formatCode="dd.mm.yyyy"/);
  assert.doesNotMatch(await workbook.file('xl/worksheets/sheet2.xml').async('string'), /PRIVATE|Олена|example.org/);
  const web = webExportEnvironment(t);
  await web.service.exportSchedule(input, 'pdf', 'en', options);
  const bytes = Buffer.from(await web.downloads[0].blob.arrayBuffer()).toString('latin1');
  assert.equal((bytes.match(/\/MediaBox \[0 0 841.89 595.28\]/g) || []).length, 2);
  for (const platform of ['android', 'ios']) {
    const env = environment(platform);
    await env.exports().exportSchedule(input, 'pdf', 'en', options);
    assert.match(env.shared.find(item => item.html).html, /class="week week-calendar"/);
  }
});

test('combined Word keeps shared lessons once and separates week variants into labelled rows with active links', async () => {
  const document = exportsUtil.buildScheduleExport(combinedSchedule(), 'uk', { layout: 'combined', shareNotes: true });
  const zip = await JSZip.loadAsync(await environment().exports().createScheduleWordDocument(document), { base64: true });
  const xml = await zip.file('word/document.xml').async('string');
  assert.equal((xml.match(/<w:tbl>/g) || []).length, 1);
  assert.equal((xml.match(/<w:tr>/g) || []).length, 4);
  assert.equal((xml.match(/<w:cantSplit\/>/g) || []).length, 3);
  assert.match(xml, />Тиждень<\/w:t>/);
  assert.match(xml, />1, 2<\/w:t>/);
  assert.match(xml, /Тижні 1 і 2/);
  assert.match(xml, /First week only/);
  assert.match(xml, /Second week only/);
  assert.equal((xml.match(/<w:hyperlink /g) || []).length, 3);
  assert.match(xml, /w:orient="landscape"/);
});

test('combined web PDF and native HTML preserve links and landscape orientation in a single table', async t => {
  const input = combinedSchedule();
  const web = webExportEnvironment(t);
  await web.service.exportSchedule(input, 'pdf', 'en', { layout: 'combined', shareNotes: true });
  const bytes = Buffer.from(await web.downloads[0].blob.arrayBuffer()).toString('latin1');
  assert.equal((bytes.match(/\/MediaBox \[0 0 841.89 595.28\]/g) || []).length, 1);
  assert.equal((bytes.match(/\/URI \(https:\/\/example.org\/class\)/g) || []).length, 3);
  for (const platform of ['android', 'ios']) {
    const env = environment(platform);
    await env.exports().exportSchedule(input, 'pdf', 'uk', { layout: 'combined', shareNotes: true });
    const print = env.shared.find(item => item.html);
    assert.equal(print.orientation, 'landscape');
    assert.equal((print.html.match(/<table /g) || []).length, 1);
    assert.match(print.html, /class="cycle-week">1<\/th>/);
    assert.match(print.html, /class="cycle-week">2<\/th>/);
  }
});

test('export language, selected weeks, and content settings apply across formats', () => {
  const model = exportsUtil.buildScheduleExport(schedule(), 'en', {
    selectedWeeks: [2], shareLocations: false, shareTypes: false, shareTeachers: false,
    shareLinks: false, showNumbers: false, shareNotes: true, layout: 'agenda', paper: 'letter', density: 'large',
  });
  assert.deepEqual(model.weeks.map(week => week.number), [2]);
  assert.equal(model.weeks[0].days[0].title, 'Monday');
  assert.equal(model.settings.orientation, 'portrait');
  assert.equal(model.settings.width, 612);
  assert.equal(model.settings.fontSize, 12);
  for (const output of [exportsUtil.scheduleExportToText(model), exportsUtil.scheduleExportToHtml(model), exportsUtil.scheduleExportToCsv(model)]) {
    assert.doesNotMatch(output, /Тиждень|Week 1|204|Олена|example.org/);
    assert.match(output, /Private note/);
    assert.match(output, /Математика/);
  }
  assert.deepEqual(model.csvColumns.map(column => column.key), ['week_column', 'day', 'start', 'end', 'subject', 'notes']);
  assert.throws(() => exportsUtil.buildScheduleExport(schedule(), 'uk', { selectedWeeks: [] }), /no_export_weeks/);
});

test('PDF and Word retain page size and orientation for automatic and explicit layouts', async t => {
  const web = webExportEnvironment(t);
  for (const [paper, portraitSize] of [['a4', [595.28, 841.89]], ['letter', [612, 792]]]) {
    for (const layout of ['grid', 'combined', 'agenda']) {
      for (const orientation of ['auto', 'portrait', 'landscape']) {
        await t.test(`${paper}, ${layout}, ${orientation}`, async () => {
          const resolved = orientation === 'auto' ? layout === 'agenda' ? 'portrait' : 'landscape' : orientation;
          const [width, height] = resolved === 'landscape' ? [...portraitSize].reverse() : portraitSize;
          const options = { paper, layout, orientation };
          const model = exportsUtil.buildScheduleExport(schedule(), 'uk', options);
          assert.equal(model.settings.orientation, resolved);
          assert.equal(model.settings.width, width);
          assert.equal(model.settings.height, height);
          const pageRule = `@page { size: ${width}pt ${height}pt;`;
          await web.service.exportSchedule(schedule(), 'pdf', 'uk', options);
          const downloaded = web.downloads.at(-1);
          assert.equal(downloaded.blob.type, 'application/pdf');
          const pdf = Buffer.from(await downloaded.blob.arrayBuffer()).toString('latin1');
          assert.match(pdf, /^%PDF-/);
          const pages = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
          assert.ok(pages.length >= (layout === 'combined' ? 1 : 2));
          for (const page of pages) {
            assert.equal(Number(page[1]), width);
            assert.equal(Number(page[2]), height);
          }
          assert.doesNotMatch(pdf, /\/Rotate (90|180|270)/);
          assert.match(pdf, /\/Subtype \/Link/);
          assert.match(pdf, /\/URI \(https:\/\/example.org\/class\)/);
          for (const platform of ['android', 'ios']) {
            const env = environment(platform);
            await env.exports().exportSchedule(schedule(), 'pdf', 'uk', options);
            const printed = env.shared.find(item => item.html);
            assert.ok(printed.html.includes(pageRule));
            assert.equal(printed.orientation, resolved);
            assert.equal(printed.width, Math.round(width));
            assert.equal(printed.height, Math.round(height));
          }
          const zip = await JSZip.loadAsync(await web.service.createScheduleWordDocument(model), { base64: true });
          const xml = await zip.file('word/document.xml').async('string');
          const pageSize = xml.match(/<w:pgSz\b[^>]*\/>/)[0];
          assert.ok(pageSize.includes(`w:w="${Math.round(width * 20)}"`));
          assert.ok(pageSize.includes(`w:h="${Math.round(height * 20)}"`));
          assert.ok(pageSize.includes(`w:orient="${resolved}"`));
        });
      }
    }
  }
  assert.equal(web.downloads.length, 18);
});

test('browser PDF generation errors propagate without opening a print fallback', async () => {
  const failure = new Error('PDF generation failed');
  const service = load('src/services/schedulePdfService.web.js', {
    'pdfmake/build/pdfmake': { addVirtualFileSystem() {}, createPdf: () => ({ getBuffer: async () => { throw failure; } }) },
    'pdfmake/build/vfs_fonts': {}, '../utils/scheduleExport': exportsUtil, '../utils/i18n': i18n, '../config/documentBranding': documentBranding,
    './fileSharingService': { downloadWebFile() { assert.fail('A failed export must not download a file'); } },
  });
  await assert.rejects(service.exportSchedulePdf(exportsUtil.buildScheduleExport(schedule(), 'uk'), 'schedule.pdf'), error => error === failure);
});

test('PDF, HTML, Word, and Excel embed the same colored or monochrome PlanIt. wordmark', async () => {
  let definition;
  const pdfService = load('src/services/schedulePdfService.web.js', {
    'pdfmake/build/pdfmake': { addVirtualFileSystem() {}, createPdf: value => {
      definition = value;
      return { getBuffer: async () => new Uint8Array() };
    } },
    'pdfmake/build/vfs_fonts': {}, '../utils/scheduleExport': exportsUtil, '../utils/i18n': i18n,
    '../config/documentBranding': documentBranding, './fileSharingService': {},
  });
  for (const color of ['accent', 'mono']) {
    const model = exportsUtil.buildScheduleExport(schedule(), 'uk', { color });
    const brand = documentBranding.getDocumentBranding(color === 'accent');
    const image = Buffer.from(brand.base64, 'base64');
    assert.equal(brand.name, 'PlanIt.');
    assert.equal(brand.color, color === 'accent' ? '3EF7D2' : '000000');
    const html = exportsUtil.scheduleExportToHtml(model);
    assert.ok(html.includes(`src="${brand.image}" alt="PlanIt."`));
    assert.match(html, /img-src data:/);
    await pdfService.createSchedulePdfDocument(model);
    assert.equal(definition.content[0].columns[1].image, brand.image);
    assert.equal(definition.footer(1, 2).columns.some(column => column.image), false);
    assert.equal(definition.info.creator, 'PlanIt.');
    const word = await JSZip.loadAsync(await environment().exports().createScheduleWordDocument(model), { base64: true });
    const pictures = word.file(/^word\/media\/.*\.png$/);
    assert.ok(pictures.length > 0);
    for (const picture of pictures) assert.deepEqual(await picture.async('nodebuffer'), image);
    assert.match(await word.file('word/document.xml').async('string'), /descr="PlanIt\."/);
    const workbook = await JSZip.loadAsync(await spreadsheetUtil.createScheduleSpreadsheet(model), { base64: true });
    assert.deepEqual(await workbook.file('xl/media/planit-wordmark.png').async('nodebuffer'), image);
    assert.match(await workbook.file('xl/drawings/drawing1.xml').async('string'), /descr="PlanIt\."/);
    assert.match(await workbook.file('xl/worksheets/sheet1.xml').async('string'), /<drawing r:id="brandLogo"/);
    if (color === 'mono') assert.doesNotMatch(await workbook.file('xl/styles.xml').async('string'), /176B78|086A85|F0F5F7/);
  }
});

test('direct PDF follows language, privacy, and week selection without leaking source data', async () => {
  let definition;
  const service = load('src/services/schedulePdfService.web.js', {
    'pdfmake/build/pdfmake': { addVirtualFileSystem() {}, createPdf: value => {
      definition = value;
      return { getBuffer: async () => new Uint8Array() };
    } },
    'pdfmake/build/vfs_fonts': {}, '../utils/scheduleExport': exportsUtil, '../utils/i18n': i18n, '../config/documentBranding': documentBranding, './fileSharingService': {},
  });
  const model = exportsUtil.buildScheduleExport(schedule(), 'en', {
    selectedWeeks: [2], shareTeachers: false, shareLinks: false, shareLocations: false, shareNotes: false,
  });
  await service.createSchedulePdfDocument(model);
  const content = JSON.stringify(definition.content);
  assert.match(content, /Week 2|Monday/);
  assert.match(content, /Математика/);
  assert.doesNotMatch(content, /Week 1|Тиждень|Олена|204|example.org|PRIVATE|Private note|private-file/);
});

test('long PDF notes have an internal destination and do not displace lesson links', async () => {
  const env = environment('web');
  const service = env.mocks['./schedulePdfService'];
  const input = schedule();
  input.subjects[0].note = 'Довга нотатка '.repeat(500) + 'Кінець нотатки';
  for (const layout of ['grid', 'agenda']) {
    const model = exportsUtil.buildScheduleExport(input, 'uk', { layout, shareNotes: true });
    const bytes = await service.createSchedulePdfDocument(model);
    const pdf = Buffer.from(bytes).toString('latin1');
    assert.match(pdf, /\/Dests/);
    assert.match(pdf, /note-1/);
    const expectedLinks = model.weeks.flatMap(week => week.days.flatMap(day => day.lessons.flatMap(lesson => lesson.links))).length;
    assert.equal([...pdf.matchAll(/\/URI \(https:\/\/example.org\/class\)/g)].length, expectedLinks);
  }
});

test('full PDF addresses wrap within the page and retain their complete clickable destinations', async t => {
  const service = environment('web').mocks['./schedulePdfService'];
  const input = schedule();
  const urls = [
    'https://us04web.zoom.us/j/6635209883?pwd=K0NCS0hrZnI4d3U1RExUWlVTbVNQQT09',
    'https://example.org/' + 'LongResourceToken'.repeat(20) + '?key=' + 'Ab9'.repeat(40),
  ];
  input.links = [];
  input.schedule = Array.from({ length: 7 }, (_, day) => {
    const links = urls.map((url, index) => ({ id: `link-${day}-${index}`, url: `${url}&day=${day}` }));
    input.links.push(...links);
    const lesson = { subjectId: 's', links: links.map(link => link.id) };
    return { week1: [lesson], week2: [lesson] };
  });
  const secondWeekLinks = input.links.slice(0, 2).map(link => ({ id: link.id + '-week2', url: link.url + '&week=2' }));
  input.links.push(...secondWeekLinks);
  input.schedule[0].week2 = [{ subjectId: 's', links: secondWeekLinks.map(link => link.id) }];
  for (const layout of ['grid', 'combined', 'agenda']) {
    for (const orientation of ['portrait', 'landscape']) {
      await t.test(`${layout}, ${orientation}`, async () => {
        const model = exportsUtil.buildScheduleExport(input, 'uk', { layout, orientation, linkStyle: 'full', density: 'compact' });
        const pdf = Buffer.from(await service.createSchedulePdfDocument(model)).toString('latin1');
        const annotations = [...pdf.matchAll(/\/Subtype \/Link\s[\s\S]*?\/Rect \[([^\]]+)\]/g)];
        assert.ok(annotations.length > 0);
        assert.deepEqual(new Set([...pdf.matchAll(/\/URI \(([^)]*)\)/g)].map(item => item[1])), new Set(input.links.map(link => link.url)));
        for (const annotation of annotations) {
          const [left, bottom, right, top] = annotation[1].trim().split(/\s+/).map(Number);
          assert.ok(left >= 34 && right <= model.settings.width - 34 + 0.01,
            `Link extends beyond the printable page: ${left}–${right}`);
          assert.ok(bottom >= 32 && top <= model.settings.height - 28 + 0.01);
        }
      });
    }
  }
});

test('weekly grid aligns actual time ranges and keeps duplicate and custom-time lessons', () => {
  const input = schedule();
  input.schedule.push({ week1: [{ subjectId: 's', timeMode: 'slot', slotNumber: 2 }, { subjectId: 's', timeMode: 'slot', slotNumber: 2 }] });
  const week = exportsUtil.buildScheduleExport(input, 'uk').weeks[0];
  const rows = exportsUtil.getScheduleExportRows(week);
  assert.deepEqual(rows.map(row => row.start), ['07:00', '09:25']);
  assert.deepEqual(rows[1].cells.map(cell => cell.length), [1, 2]);
  assert.equal(rows.flatMap(row => row.cells.flat()).length, 4);
});

test('PDF markup and Word contain active links with short labels and safe destinations', async () => {
  const input = schedule();
  input.links[0] = { id: 'link', label: 'Join <class>', url: 'https://example.org/class?a=1&b=2' };
  const model = exportsUtil.buildScheduleExport(input, 'uk');
  const html = exportsUtil.scheduleExportToHtml(model);
  assert.match(html, /<a href="https:\/\/example.org\/class\?a=1&amp;b=2">Join &lt;class&gt;<\/a>/);
  assert.doesNotMatch(html, />https:\/\/example.org/);
  const full = exportsUtil.scheduleExportToHtml(exportsUtil.buildScheduleExport(input, 'uk', { linkStyle: 'full' }));
  assert.match(full, />https:\/\/example.org/);
  const zip = await JSZip.loadAsync(await environment().exports().createScheduleWordDocument(model), { base64: true });
  const xml = await zip.file('word/document.xml').async('string');
  const relations = await zip.file('word/_rels/document.xml.rels').async('string');
  assert.match(xml, /<w:hyperlink /);
  assert.match(xml, /Join &lt;class&gt;/);
  assert.match(relations, /Target="https:\/\/example.org\/class\?a=1&amp;b=2" TargetMode="External"/);
  assert.match(xml, /w:w="16838" w:h="11906"/);
  input.links[0].url = 'javascript:alert(1)';
  assert.equal(exportsUtil.buildScheduleExport(input, 'uk').weeks[0].days[0].lessons[1].links.length, 0);
});

test('CSV has independent data columns and supports all selectable separators', () => {
  for (const [csvSeparator, separator] of [['comma', ','], ['semicolon', ';'], ['tab', '\t']]) {
    const model = exportsUtil.buildScheduleExport(schedule(), 'en', { csvSeparator });
    const csv = exportsUtil.scheduleExportToCsv(model);
    assert.match(csv, /"Start"/);
    assert.ok(csv.includes('"Start"' + separator + '"End"'));
    assert.ok(csv.includes('"09:25"' + separator + '"10:55"'));
    assert.equal(model.csvColumns.some(column => column.key === 'notes'), false);
    assert.match(csv, /"https:\/\/example.org\/class"/);
  }
});

test('Excel workbook stores typed times, safe text, filters, frozen headers, and one hyperlink per resource', async () => {
  const input = schedule();
  input.subjects[0].name = '=2+2';
  input.subjects[0].links.push('second');
  input.links.push({ id: 'second', url: 'https://example.org/second?a=1&b=2', label: 'Second class' });
  const model = exportsUtil.buildScheduleExport(input, 'uk');
  const zip = await JSZip.loadAsync(await spreadsheetUtil.createScheduleSpreadsheet(model), { base64: true });
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const relations = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  const styles = await zip.file('xl/styles.xml').async('string');
  assert.match(xml, /<pane ySplit="4" topLeftCell="A5"/);
  assert.match(xml, /<autoFilter ref="A4:K7"/);
  assert.match(xml, /t="inlineStr"><is><t xml:space="preserve">=2\+2<\/t>/);
  assert.doesNotMatch(xml, /<f[ >]/);
  assert.match(xml, /<c r="C5" s="5"><v>0.2916666666666667<\/v>/);
  assert.equal((xml.match(/<hyperlink /g) || []).length, 4);
  assert.match(relations, /second\?a=1&amp;b=2/);
  assert.match(styles, /formatCode="hh:mm"/);
  const privateZip = await JSZip.loadAsync(await spreadsheetUtil.createScheduleSpreadsheet(exportsUtil.buildScheduleExport(input, 'en', { shareLinks: false, shareTeachers: false })), { base64: true });
  assert.doesNotMatch(await privateZip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'), /\/hyperlink/);
  assert.doesNotMatch(await privateZip.file('xl/worksheets/sheet1.xml').async('string'), /Олена|example.org|PRIVATE/);
});

test('native exports retain shared files for receivers and remove expired export caches', async () => {
  const env = environment();
  const service = env.exports();
  const expired = 'file:///cache/file-shares/' + (Date.now() - 25 * 60 * 60 * 1000) + '-expired/file.pdf';
  env.files.set(expired, Buffer.from('old export'));
  for (const format of ['pdf', 'docx', 'xlsx', 'csv', 'text']) await service.exportSchedule(schedule(), format, 'uk', { shareNotes: false });
  const fileShares = env.shared.filter(item => item.uri);
  assert.deepEqual(fileShares.map(item => item.options.mimeType), ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']);
  assert.equal(fileShares.every(item => item.bytes?.length > 0), true);
  assert.equal(env.files.has(expired), false);
  assert.equal(env.files.has('file:///cache/print.pdf'), false);
  assert.equal(fileShares.every(item => env.files.has(item.uri)), true);
  assert.match(env.shared.find(item => item.html).html, /Математика/);
  assert.ok(env.shared.find(item => item.html).width > env.shared.find(item => item.html).height);
  assert.match(env.shared.find(item => item.message).message, /Математика/);
});

test('schedule transfers retain file metadata when the destination library is empty', async () => {
  const env = environment();
  const service = env.attachments();
  const [file] = await service.storeAttachmentDrafts([nativeDraft(env)]);
  const source = schedule();
  source.subjects[0].attachments = [service.createAttachmentReference(file)];
  const transferred = service.resolveScheduleAttachments(source, [file]);
  const [attachment] = service.resolveAttachmentList(transferred.subjects[0].attachments, []);
  assert.equal((await service.getAttachmentCacheState(attachment)).status, 'local');
  assert.equal(service.getScheduleAttachmentFiles(transferred)[0].id, file.id);
});

test('transferring a schedule copies local bytes so deleting the source cannot erase the destination', async () => {
  const env = environment();
  const service = env.attachments();
  const [file] = await service.storeAttachmentDrafts([nativeDraft(env)]);
  const input = schedule();
  input.subjects[0].attachments = [service.createAttachmentReference(file)];
  const transferred = await service.copyScheduleAttachments(input, [file]);
  assert.notEqual(transferred.files[0].id, file.id);
  await service.deleteLocalAttachmentCache(file);
  const [attachment] = service.resolveAttachmentList(transferred.schedule.subjects[0].attachments, []);
  assert.equal((await service.getAttachmentCacheState(attachment)).status, 'local');
});

const theme = { backgroundColor: '#ffffff', backgroundColor2: '#f2f5fa', backgroundColor3: '#e8edf3', borderColor: '#dde4ef', textColor: '#17283c', textColor2: '#576879', textColor3: '#768797', accentColor: '#3674ba', accentTextColor: '#2362a0', textOnAccent: '#ffffff' };
const uiMocks = {
  'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', TextInput: 'Input', Alert: {}, Platform: { OS: 'android' }, StyleSheet: { create: value => value, hairlineWidth: 1 } },
  'phosphor-react-native': new Proxy({}, { get: (_, name) => name === '__esModule' ? false : name }),
};

test('web settings rows expose radio and expanded states to assistive technology', async t => {
  const { default: Row } = load('src/components/ui/SettingsKit/SettingsRow.jsx', {
    ...uiMocks,
    'react-native': { ...uiMocks['react-native'], Platform: { OS: 'web' } },
    '../../../utils/haptics': { triggerHaptic() {} },
  });
  let tree;
  await act(async () => { tree = create(React.createElement(Row, {
    label: 'PDF', themeColors: theme, onPress() {}, accessibilityRole: 'radio', accessibilityState: { checked: true, expanded: true },
  })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const row = tree.root.findByType('Button');
  assert.equal(row.props['aria-checked'], true);
  assert.equal(row.props['aria-expanded'], true);
  assert.equal(row.props['aria-disabled'], false);
});

function shareUIEnvironment({ user = null, lang = 'uk', platform = 'android' } = {}) {
  const exported = [];
  const shared = [];
  const { default: Modal } = load('src/components/modals/ShareScheduleModal.jsx', {
    ...uiMocks,
    'react-native': { ...uiMocks['react-native'], Platform: { OS: platform } },
    '../../context/ScheduleProvider': { useScheduleData: () => ({ global: {}, lang, user }) },
    '../../config/themes': { getColors: () => theme }, '../../utils/i18n': i18n,
    '../../utils/haptics': { triggerHaptic() {} },
    '../../utils/analytics/crashlytics': { logCrashlyticsError() {} },
    '../../services/shareService': { createSharedSchedule: async (...args) => { shared.push(args); return 'SHARE123'; }, createSharedScheduleLink: code => `https://planit.app/share/${code}` },
    '../../services/scheduleExportService': { exportSchedule: async (...args) => exported.push(args) },
    '../../utils/scheduleValidation': { sanitizeSharedSchedule: value => value },
    '../../utils/scheduleExport': exportsUtil,
    '../ui/TabSwitcher': 'TabSwitcher', '../ui/AppSwitch': 'Switch',
    '../CalendarSheet/CalendarSheet': 'CalendarSheet',
    '../ui/SettingsKit/SettingsGroup': 'Group', '../ui/SettingsKit/SettingsRow': 'Row',
    '../ui/MorphingLoader': 'Loader', '../ui/BottomSheet': { __esModule: true, default: 'Sheet', SheetScrollView: 'Scroll' },
    'expo-clipboard': {},
  });
  return { Modal, exported, shared };
}

test('guest share UI exports Word without creating a public schedule and explains code sign-in', async t => {
  const { Modal, exported, shared } = shareUIEnvironment();
  let tree;
  const input = { ...schedule(), id: 'share-ui', starting_week: '2026-08-31T12:00:00' };
  await act(async () => { tree = create(React.createElement(Modal, { visible: true, scheduleToShare: input, onClose() {} })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const row = label => tree.root.findAllByType('Row').find(item => item.props.label === label);
  const chooseFormat = async label => {
    await act(async () => row('Формат файла').props.onPress());
    await act(async () => row(label).props.onPress());
  };
  assert.equal(row('Word (.docx)'), undefined);
  assert.equal(row('Імена викладачів'), undefined, 'content controls stay collapsed');
  assert.equal(row('Графік тижнів').props.accessibilityState.checked, true);
  assert.equal(row('Мова документа').props.accessibilityState.expanded, false);
  await chooseFormat('Word (.docx)');
  const exportButton = tree.root.findAllByType('Button').find(button => button.props.accessibilityState?.busy !== undefined);
  await act(async () => exportButton.props.onPress());
  assert.equal(exported[0][1], 'docx');
  assert.equal(exported[0][2], 'uk');
  assert.equal(exported[0][3].shareNotes, false);
  assert.equal(exported[0][3].layout, 'combined');
  assert.equal(exported[0][3].includeWeekCalendar, true);
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === 'Тижні окремо').props.onPress());
  await act(async () => exportButton.props.onPress());
  assert.equal(exported.pop()[3].layout, 'grid');
  const calendarSwitch = () => row('Графік тижнів');
  await act(async () => row('Дати графіка').props.onPress());
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === '4 тижні').props.onPress());
  await act(async () => tree.root.findAllByType('Row').find(row => row.props.label === 'Початок періоду').props.onPress());
  await act(async () => tree.root.findByType('CalendarSheet').props.onDateSelect(new Date('2026-09-02T12:00:00')));
  await act(async () => tree.root.findAllByType('Row').find(row => row.props.label === 'Кінець періоду').props.onPress());
  await act(async () => tree.root.findByType('CalendarSheet').props.onDateSelect(new Date('2026-08-01T12:00:00')));
  assert.equal(exportButton.props.disabled, true);
  await act(async () => tree.root.findAllByType('Row').find(row => row.props.label === 'Кінець періоду').props.onPress());
  await act(async () => tree.root.findByType('CalendarSheet').props.onDateSelect(new Date('2026-12-13T12:00:00')));
  await act(async () => exportButton.props.onPress());
  assert.deepEqual([exported.at(-1)[3].calendarFrom, exported.at(-1)[3].calendarTo], ['2026-09-02', '2026-12-13']);
  assert.equal(exported.pop()[3].includeWeekCalendar, true);
  await chooseFormat('CSV (.csv)');
  assert.equal(calendarSwitch(), undefined);
  await act(async () => exportButton.props.onPress());
  assert.equal(exported.pop()[3].includeWeekCalendar, false);
  await chooseFormat('Word (.docx)');
  await act(async () => calendarSwitch().props.onPress());
  await act(async () => row('Мова документа').props.onPress());
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === 'English').props.onPress());
  await act(async () => row('Які тижні додати').props.onPress());
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === 'Тиждень 1').props.onPress());
  await act(async () => exportButton.props.onPress());
  assert.equal(exported[1][2], 'en');
  assert.deepEqual(exported[1][3].selectedWeeks, [2]);
  await act(async () => tree.update(React.createElement(Modal, { visible: false, scheduleToShare: input, onClose() {} })));
  await act(async () => tree.update(React.createElement(Modal, { visible: true, scheduleToShare: input, onClose() {} })));
  await act(async () => exportButton.props.onPress());
  assert.equal(exported[2][2], 'uk');
  assert.equal(exported[2][3].selectedWeeks, undefined);
  assert.equal(exported[2][3].layout, 'combined');
  assert.equal(exported[2][3].includeWeekCalendar, true);
  assert.equal(row('Дати графіка').props.accessibilityState.expanded, false);
  assert.equal(shared.length, 0);
  await act(async () => tree.root.findByType('TabSwitcher').props.onTabPress('code'));
  assert.equal(tree.root.findAllByType('Text').some(text => text.props.children === i18n.t('share.code_auth_hint', 'uk')), true);
  assert.equal(tree.root.findAllByType('Button').some(button => button.findAllByType('Text').some(text => text.props.children === 'Згенерувати код')), false);
});

test('share defaults follow the cycle, retain at least one week, and recover from a missing calendar anchor', async t => {
  const { Modal, exported } = shareUIEnvironment();
  let tree;
  const render = input => React.createElement(Modal, { visible: true, scheduleToShare: input, onClose() {} });
  await act(async () => { tree = create(render({ ...schedule(), id: 'single', repeat: 1 })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const row = label => tree.root.findAllByType('Row').find(item => item.props.label === label);
  const button = label => tree.root.findAllByType('Button').find(item => item.props.accessibilityLabel === label);
  const submit = () => tree.root.findAllByType('Button').find(item => item.props.accessibilityState?.busy !== undefined);
  assert.equal(row('Графік тижнів').props.accessibilityState.checked, false);
  assert.equal(row('Які тижні додати'), undefined);
  assert.equal(submit().props.disabled, false);
  await act(async () => submit().props.onPress());
  assert.equal(exported.at(-1)[1], 'pdf');
  assert.equal(exported.at(-1)[3].includeWeekCalendar, false);

  await act(async () => tree.update(render({ ...schedule(), id: 'three', repeat: 3, starting_week: '2026-08-31T12:00:00' })));
  assert.equal(row('Графік тижнів').props.accessibilityState.checked, true);
  await act(async () => row('Які тижні додати').props.onPress());
  await act(async () => button('Тиждень 1').props.onPress());
  await act(async () => button('Тиждень 2').props.onPress());
  await act(async () => button('Тиждень 3').props.onPress());
  assert.equal(button('Тиждень 3').props.accessibilityState.checked, true);
  await act(async () => submit().props.onPress());
  assert.deepEqual(exported.at(-1)[3].selectedWeeks, [3]);
  assert.equal(exported.at(-1)[3].includeWeekCalendar, true);

  await act(async () => tree.update(render({ ...schedule(), id: 'missing-anchor' })));
  assert.equal(submit().props.disabled, true);
  assert.equal(tree.root.findAllByType('Text').some(item => item.props.children === i18n.t('share.week_calendar_missing_anchor', 'uk')), true);
  await act(async () => row('Графік тижнів').props.onPress());
  assert.equal(submit().props.disabled, false);
  await act(async () => submit().props.onPress());
  assert.equal(exported.at(-1)[3].includeWeekCalendar, false);
});

test('share details and appearance remain editable, and code sharing keeps its privacy choices', async t => {
  const { Modal, exported, shared } = shareUIEnvironment({ user: { uid: 'author', displayName: 'Олена' }, platform: 'web', lang: 'en' });
  let tree;
  await act(async () => { tree = create(React.createElement(Modal, { visible: true, scheduleToShare: { ...schedule(), starting_week: '2026-08-31T12:00:00' }, onClose() {} })); });
  t.after(async () => { await act(async () => tree.unmount()); });
  const row = label => tree.root.findAllByType('Row').find(item => item.props.label === label);
  const button = label => tree.root.findAllByType('Button').find(item => item.props.accessibilityLabel === label);
  const submit = () => tree.root.findAllByType('Button').find(item => item.props.accessibilityState?.busy !== undefined);
  await act(async () => row('Document content').props.onPress());
  await act(async () => row('Include class notes').props.onPress());
  await act(async () => row('Teacher names').props.onPress());
  await act(async () => row('Page appearance').props.onPress());
  assert.equal(row('Include class notes'), undefined, 'opening a section collapses the previous section');
  await act(async () => button('Portrait').props.onPress());
  await act(async () => button('Black and white').props.onPress());
  await act(async () => submit().props.onPress());
  assert.equal(exported.at(-1)[3].shareNotes, true);
  assert.equal(exported.at(-1)[3].shareTeachers, false);
  assert.equal(exported.at(-1)[3].orientation, 'portrait');
  assert.equal(exported.at(-1)[3].color, 'mono');
  await act(async () => tree.root.findAllByType('TabSwitcher')[0].props.onTabPress('code'));
  await act(async () => tree.root.findAllByType('TabSwitcher')[1].props.onTabPress('30'));
  await act(async () => row('Privacy settings').props.onPress());
  assert.equal(row('Include class notes').props.accessibilityState.checked, true);
  await act(async () => row('Show my name').props.onPress());
  await act(async () => submit().props.onPress());
  assert.equal(shared.length, 1);
  assert.equal(shared[0][0].displayName, 'Олена');
  assert.equal(shared[0][2], 30);
  assert.equal(tree.root.findAllByType('Text').some(item => item.props.children === 'SHARE123'), true);
});

test('guest library UI adds, searches, and renames a local PDF without authentication', async t => {
  const env = environment();
  const service = env.attachments();
  const draft = nativeDraft(env);
  const Context = React.createContext(null);
  let current;
  const { default: Library } = load('src/pages/Settings/components/FileLibraryScreen.jsx', {
    ...uiMocks,
    '../../../layouts/SettingsScreenLayout': 'Layout', '../../../components/ui/SettingsKit/SettingsGroup': 'Group',
    '../../../components/attachments/StagedAttachmentImage': 'Photo', '../../../components/ui/TabSwitcher': 'Tabs',
    '../../../context/ScheduleProvider': {
      useScheduleData: () => React.useContext(Context).data,
      useScheduleActions: () => ({ setData: React.useContext(Context).setData }),
    },
    '../../../context/AttachmentImagePreviewContext': { useAttachmentImagePreview: () => ({ openImagePreview() {} }) },
    '../../../config/themes': { getColors: () => theme }, '../../../utils/i18n': i18n,
    '../../../utils/haptics': { triggerHaptic() {} },
    '../../../services/attachmentService': { ...service, pickAttachmentFiles: async () => ({ attachments: [draft] }) },
  });
  function Harness() {
    const [data, setData] = React.useState({ global: { fileLibrary: [] }, schedules: [], lang: 'uk', user: null });
    current = data;
    return React.createElement(Context.Provider, { value: { data, setData } }, React.createElement(Library));
  }
  let tree;
  await act(async () => { tree = create(React.createElement(Harness)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === 'Файли').props.onPress());
  assert.equal(current.global.fileLibrary.length, 1);
  assert.equal(current.global.fileLibrary[0].storageMode, 'local');
  await act(async () => tree.root.findAllByType('Button').find(button => button.props.accessibilityLabel === i18n.t('attachments.rename', 'uk')).props.onPress());
  await act(async () => tree.root.findAllByType('Input').find(input => input.props.accessibilityLabel === i18n.t('attachments.rename_placeholder', 'uk')).props.onChangeText('Лекція'));
  await act(async () => tree.root.findAllByType('Input').find(input => input.props.accessibilityLabel === i18n.t('attachments.rename_placeholder', 'uk')).props.onSubmitEditing());
  assert.equal(current.global.fileLibrary[0].name, 'Лекція.pdf');
  const reloaded = env.attachments();
  assert.equal((await reloaded.getAttachmentCacheState(current.global.fileLibrary[0])).status, 'local');
  await act(async () => tree.root.findAllByType('Input').find(input => input.props.accessibilityLabel === i18n.t('settings.files.search', 'uk')).props.onChangeText('no-match'));
  assert.equal(tree.root.findAllByType('Text').some(text => text.props.children === i18n.t('settings.files.no_results', 'uk')), true);
});
