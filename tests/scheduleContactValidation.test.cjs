const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const srcRoot = path.resolve(__dirname, '../src');
const originalLoader = Module._extensions['.js'];
const originalModuleLoad = Module._load;
let generatedId = 0;
Module._load = (request, parent, isMain) => {
  if (request === 'expo-crypto') {
    return { randomUUID: () => `test-id-${generatedId += 1}` };
  }
  return originalModuleLoad(request, parent, isMain);
};
Module._extensions['.js'] = (targetModule, filename) => {
  if (!filename.startsWith(srcRoot)) return originalLoader(targetModule, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(source, {
    filename,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  targetModule._compile(transformed, filename);
};

const { sanitizeSharedSchedule } = require('../src/utils/scheduleValidation.js');
Module._extensions['.js'] = originalLoader;
Module._load = originalModuleLoad;

const baseSchedule = {
  name: 'Contacts',
  repeat: 1,
  duration: 45,
  breaks: [],
  start_time: '08:30',
  starting_week: '2026-08-24T00:00:00.000Z',
  subjects: [],
  gradients: [],
  schedule: [],
};

test('shared schedule canonicalizes handles and whitelists appearance fields', () => {
  const result = sanitizeSharedSchedule({
    ...baseSchedule,
    teachers: [{
      id: 'teacher-1',
      name: 'Teacher',
      icon: 'chat',
      color: '#123ABC',
      contacts: [{
        id: 'contact-1',
        type: 'telegram',
        value: '@planit_test',
        icon: 'untrusted-icon',
        color: '#DB2777',
      }],
    }],
    links: [{
      id: 'link-1',
      name: 'Meet',
      type: 'teams',
      url: 'https://teams.microsoft.com/l/meetup-join/1',
      icon: 'instagram',
      color: '#2563EB',
    }],
  });

  assert.equal(result.teachers[0].contacts[0].url, 'https://t.me/planit_test');
  assert.equal(result.teachers[0].contacts[0].icon, 'telegram');
  assert.equal(result.teachers[0].icon, 'chat');
  assert.equal(result.teachers[0].color, '#123ABC');
  assert.equal(result.links[0].type, 'meeting');
  assert.equal(result.links[0].icon, 'instagram');
  assert.equal(result.links[0].color, '#2563EB');
});

test('shared schedules preserve an optional schedule icon', () => {
  const withIcon = sanitizeSharedSchedule({
    ...baseSchedule,
    icon: 'date',
  });
  const withoutIcon = sanitizeSharedSchedule(baseSchedule);

  assert.equal(withIcon.icon, 'date');
  assert.equal(Object.prototype.hasOwnProperty.call(withoutIcon, 'icon'), false);
});

test('shared schedule removes contacts and destinations with unsafe schemes', () => {
  const result = sanitizeSharedSchedule({
    ...baseSchedule,
    teachers: [{
      id: 'teacher-1',
      name: 'Teacher',
      contacts: [{ id: 'contact-1', type: 'website', value: 'javascript:alert(1)' }],
    }],
    links: [{ id: 'link-1', name: 'Unsafe', type: 'website', url: 'file:///private/file' }],
  });

  assert.equal(result.teachers[0].contacts, undefined);
  assert.equal(result.links[0].url, undefined);
});

test('shared schedules preserve lesson slots whose subject was deleted', () => {
  const result = sanitizeSharedSchedule({
    ...baseSchedule,
    schedule: [{
      week1: [
        { subjectDeleted: true, startTime: '08:30', endTime: '09:15' },
      ],
    }],
  });

  assert.deepEqual(result.schedule[0].week1, [{
    subjectDeleted: true,
    startTime: '08:30',
    endTime: '09:15',
  }]);
});

test('shared schedules detach missing subjects without deleting lesson slots', () => {
  const result = sanitizeSharedSchedule({
    ...baseSchedule,
    subjects: [{ id: 'physics', name: 'Physics' }],
    schedule: [{
      week1: [
        { subjectId: 'deleted-subject', startTime: '08:30' },
        { subjectId: 'physics', startTime: '09:30' },
      ],
    }],
  });

  assert.equal(result.schedule[0].week1.length, 2);
  assert.deepEqual(result.schedule[0].week1[0], {
    subjectDeleted: true,
    startTime: '08:30',
  });
  assert.equal(result.schedule[0].week1[1].subjectId, 'physics');
});
