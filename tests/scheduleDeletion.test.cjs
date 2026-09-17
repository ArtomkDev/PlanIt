const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const compileCommonJsModule = (filePath, mocks = new Map()) => {
  const source = fs.readFileSync(filePath, "utf8");
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => (
    mocks.has(request) ? mocks.get(request) : originalRequire(request)
  );
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const scheduleTimePath = path.resolve(__dirname, "../src/utils/scheduleTime.js");
const scheduleTime = compileCommonJsModule(scheduleTimePath);
const recurrencePath = path.resolve(__dirname, "../src/utils/lessonRecurrence.js");
const lessonRecurrence = compileCommonJsModule(recurrencePath, new Map([
  ["./scheduleTime", scheduleTime],
]));
const deletionPath = path.resolve(__dirname, "../src/utils/scheduleDeletion.js");
const { deleteScheduleLesson, removeScheduleEntity } = compileCommonJsModule(deletionPath, new Map([
  ["./lessonRecurrence", lessonRecurrence],
]));
const { buildLessonOccurrences } = scheduleTime;

const createSchedule = () => ({
  subjects: [
    { id: "math", name: "Math", teacher: "teacher-1", teachers: ["teacher-1", "teacher-2"], link: "link-1", links: ["link-1", "link-2"], typeColor: "gradient", colorGradient: "gradient-1" },
    { id: "physics", name: "Physics" },
  ],
  teachers: [{ id: "teacher-1" }, { id: "teacher-2" }],
  links: [{ id: "link-1" }, { id: "link-2" }],
  gradients: [{ id: "gradient-1" }, { id: "gradient-2" }],
  schedule: [
    {
      week1: [
        { subjectId: "math", teacher: "teacher-1", teachers: ["teacher-1", "teacher-2"], link: "link-1", links: ["link-1", "link-2"], gradient: "gradient-1", startTime: "08:30" },
        "math",
        { subjectId: "physics", startTime: "10:30" },
      ],
    },
  ],
  tasks: [
    { id: "task-1", subjectId: "math", links: ["link-1", "link-2"], lessonRef: { scheduleId: "schedule-1", subjectId: "math", dayIndex: 0, weekKey: "week1", lessonIndex: 0 } },
  ],
});

test("deletes one lesson immutably at the requested schedule position", () => {
  const schedule = createSchedule();
  const originalGrid = schedule.schedule;
  const originalDay = schedule.schedule[0];
  const originalLessons = schedule.schedule[0].week1;

  const result = deleteScheduleLesson(schedule, 0, "week1", 1);

  assert.notEqual(result, schedule);
  assert.notEqual(result.schedule, originalGrid);
  assert.notEqual(result.schedule[0], originalDay);
  assert.notEqual(result.schedule[0].week1, originalLessons);
  assert.deepEqual(result.schedule[0].week1, [originalLessons[0], originalLessons[2]]);
  assert.equal(schedule.schedule[0].week1.length, 3);
});

test("fully deletes a subject while preserving every related lesson slot", () => {
  const schedule = createSchedule();

  const result = removeScheduleEntity(schedule, "subjects", "math");

  assert.deepEqual(result.subjects.map((subject) => subject.id), ["physics"]);
  assert.equal(result.schedule[0].week1.length, 3);
  assert.deepEqual(result.schedule[0].week1[0], {
    subjectDeleted: true,
    teacher: "teacher-1",
    teachers: ["teacher-1", "teacher-2"],
    link: "link-1",
    links: ["link-1", "link-2"],
    gradient: "gradient-1",
    startTime: "08:30",
  });
  assert.deepEqual(result.schedule[0].week1[1], { subjectDeleted: true });
  assert.equal(result.schedule[0].week1[2].subjectId, "physics");
  assert.equal(result.tasks[0].subjectId, null);
  assert.equal(result.tasks[0].lessonRef?.subjectId, undefined);
  assert.equal(schedule.subjects.length, 2);
  assert.equal(schedule.schedule[0].week1[0].subjectId, "math");
});

test("fully deletes a teacher from subject defaults and lesson overrides", () => {
  const result = removeScheduleEntity(createSchedule(), "teachers", "teacher-1");

  assert.deepEqual(result.teachers.map((teacher) => teacher.id), ["teacher-2"]);
  assert.equal(result.subjects[0].teacher, undefined);
  assert.deepEqual(result.subjects[0].teachers, ["teacher-2"]);
  assert.equal(result.schedule[0].week1[0].teacher, undefined);
  assert.deepEqual(result.schedule[0].week1[0].teachers, ["teacher-2"]);
});

test("fully deletes links and gradients from every supported reference", () => {
  const withoutLink = removeScheduleEntity(createSchedule(), "links", "link-1");
  const result = removeScheduleEntity(withoutLink, "gradients", "gradient-1");

  assert.deepEqual(result.links.map((link) => link.id), ["link-2"]);
  assert.equal(result.subjects[0].link, undefined);
  assert.deepEqual(result.subjects[0].links, ["link-2"]);
  assert.equal(result.schedule[0].week1[0].link, undefined);
  assert.deepEqual(result.schedule[0].week1[0].links, ["link-2"]);
  assert.deepEqual(result.tasks[0].links, ["link-2"]);

  assert.deepEqual(result.gradients.map((gradient) => gradient.id), ["gradient-2"]);
  assert.equal(result.subjects[0].colorGradient, undefined);
  assert.equal(result.subjects[0].typeColor, undefined);
  assert.equal(result.schedule[0].week1[0].gradient, undefined);
});
test("unlinks tasks for a deleted lesson and shifts later lesson references", () => {
  const schedule = {
    ...createSchedule(),
    id: "schedule-1",
    tasks: [
      { id: "deleted", lessonRef: { scheduleId: "schedule-1", dayIndex: 0, weekKey: "week1", lessonIndex: 1 } },
      { id: "shifted", lessonRef: { scheduleId: "schedule-1", dayIndex: 0, weekKey: "week1", lessonIndex: 2 } },
      { id: "other-day", lessonRef: { scheduleId: "schedule-1", dayIndex: 1, weekKey: "week1", lessonIndex: 1 } },
      { id: "other-schedule", lessonRef: { scheduleId: "schedule-2", dayIndex: 0, weekKey: "week1", lessonIndex: 1 } },
    ],
  };

  const result = deleteScheduleLesson(schedule, 0, "week1", 1);

  assert.equal(result.tasks[0].lessonRef, undefined);
  assert.equal(result.tasks[1].lessonRef.lessonIndex, 1);
  assert.equal(result.tasks[2].lessonRef.lessonIndex, 1);
  assert.equal(result.tasks[3].lessonRef.lessonIndex, 1);
});
test("builds occurrences for retained lesson slots without a subject", () => {
  const schedule = {
    id: "schedule-1",
    repeat: 1,
    starting_week: "2026-09-14T00:00:00.000Z",
    start_time: "08:30",
    duration: 45,
    breaks: [],
    subjects: [],
    schedule: [
      {
        week1: [{ subjectDeleted: true, startTime: "08:30", endTime: "09:15" }],
      },
    ],
  };

  const occurrences = buildLessonOccurrences(schedule, {
    from: new Date("2026-09-14T00:00:00.000Z"),
    horizonDays: 1,
    includePast: true,
  });

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].subjectId, null);
  assert.equal(occurrences[0].lessonData.subjectDeleted, true);
});
