const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const compileCommonJsModule = (filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const recurrence = compileCommonJsModule(
  path.resolve(__dirname, "../src/utils/lessonRecurrence.js"),
);
const taskLessonLinking = compileCommonJsModule(
  path.resolve(__dirname, "../src/utils/taskLessonLinking.js"),
);

const createSchedule = (repeat = 2) => ({
  id: "schedule-1",
  repeat,
  start_time: "08:30",
  duration: 80,
  breaks: [10],
  schedule: Array.from({ length: 7 }, () => Object.fromEntries(
    Array.from({ length: repeat }, (_, index) => [`week${index + 1}`, []]),
  )),
  tasks: [],
});

const lesson = (subjectId, startTime = "08:30", endTime = "09:50") => ({
  subjectId,
  startTime,
  endTime,
  defaultStartTime: startTime,
  defaultEndTime: endTime,
});

test("new lessons repeat every week by default", () => {
  const schedule = createSchedule();
  const selection = recurrence.getLessonRecurrenceSelection(
    schedule,
    0,
    1,
    { index: null, data: {} },
  );

  assert.equal(selection.mode, "all");
  assert.deepEqual(selection.weeks, [1, 2]);
});

test("recognizes matching legacy duplicates as one weekly series", () => {
  const schedule = createSchedule();
  schedule.schedule[0].week1 = [lesson("math")];
  schedule.schedule[0].week2 = [lesson("math")];

  const selection = recurrence.getLessonRecurrenceSelection(
    schedule,
    0,
    1,
    { index: 0, data: schedule.schedule[0].week1[0] },
  );

  assert.equal(selection.mode, "all");
  assert.deepEqual(selection.weeks, [1, 2]);
});

test("saves one weekly lesson into every cycle week with one series id", () => {
  const schedule = createSchedule();
  const result = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });

  assert.equal(result.schedule[0].week1.length, 1);
  assert.equal(result.schedule[0].week2.length, 1);
  const firstId = result.schedule[0].week1[0].recurrence.id;
  assert.ok(firstId);
  assert.equal(result.schedule[0].week2[0].recurrence.id, firstId);
  assert.equal(result.schedule[0].week1[0].recurrence.mode, "all");
});

test("a selected-week lesson overrides a weekly lesson and restores it when deleted", () => {
  const schedule = createSchedule();
  const withWeekly = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });
  const weeklyId = withWeekly.schedule[0].week1[0].recurrence.id;

  const withOverride = recurrence.applyLessonRecurrence(withWeekly, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2] },
    previousSelection: { mode: "selected", weeks: [2] },
  });

  assert.equal(withOverride.schedule[0].week1[0].subjectId, "math");
  assert.equal(withOverride.schedule[0].week2.length, 1);
  assert.equal(withOverride.schedule[0].week2[0].subjectId, "physics");
  assert.deepEqual(withOverride.schedule[0].week2[0].recurrence.overrides, [weeklyId]);

  const restored = recurrence.deleteLessonRecurrence(withOverride, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: 0,
    scope: "series",
  });

  assert.equal(restored.schedule[0].week2.length, 1);
  assert.equal(restored.schedule[0].week2[0].subjectId, "math");
  assert.equal(restored.schedule[0].week2[0].recurrence.id, weeklyId);
});

test("editing a weekly series updates every visible member without removing an override", () => {
  const schedule = createSchedule();
  const withWeekly = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });
  const weeklyId = withWeekly.schedule[0].week1[0].recurrence.id;
  const withOverride = recurrence.applyLessonRecurrence(withWeekly, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2] },
    previousSelection: { mode: "selected", weeks: [2] },
  });

  const edited = recurrence.applyLessonRecurrence(withOverride, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: 0,
    lesson: { ...lesson("math"), room: "204" },
    selection: { id: weeklyId, mode: "all", weeks: [1, 2] },
    previousSelection: { id: weeklyId, mode: "all", weeks: [1, 2] },
  });

  assert.equal(edited.schedule[0].week1[0].room, "204");
  assert.equal(edited.schedule[0].week2.length, 1);
  assert.equal(edited.schedule[0].week2[0].subjectId, "physics");
  assert.ok(edited.schedule[0].week2[0].recurrence.overrides.includes(weeklyId));
});

test("deleting one occurrence narrows the remaining series weeks", () => {
  const schedule = createSchedule();
  const recurring = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });

  const result = recurrence.deleteLessonRecurrence(recurring, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: 0,
    scope: "occurrence",
  });

  assert.equal(result.schedule[0].week2.length, 0);
  assert.equal(result.schedule[0].week1[0].recurrence.mode, "selected");
  assert.deepEqual(result.schedule[0].week1[0].recurrence.weeks, [1]);
});
test("moving an override restores the weekly lesson in its original slot", () => {
  const schedule = createSchedule();
  const withWeekly = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });
  const withOverride = recurrence.applyLessonRecurrence(withWeekly, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2] },
    previousSelection: { mode: "selected", weeks: [2] },
  });
  const override = withOverride.schedule[0].week2[0];

  const moved = recurrence.applyLessonRecurrence(withOverride, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: 0,
    lesson: lesson("physics", "10:00", "11:20"),
    selection: { ...override.recurrence },
    previousSelection: { ...override.recurrence },
  });

  assert.deepEqual(
    moved.schedule[0].week2.map((item) => item.subjectId),
    ["math", "physics"],
  );
  assert.equal(moved.schedule[0].week2[1].recurrence.overrides, undefined);
});

test("moving the weekly series clears a stale override marker", () => {
  const schedule = createSchedule();
  const withWeekly = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });
  const weeklyId = withWeekly.schedule[0].week1[0].recurrence.id;
  const withOverride = recurrence.applyLessonRecurrence(withWeekly, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2] },
    previousSelection: { mode: "selected", weeks: [2] },
  });

  const moved = recurrence.applyLessonRecurrence(withOverride, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: 0,
    lesson: lesson("math", "10:00", "11:20"),
    selection: { id: weeklyId, mode: "all", weeks: [1, 2] },
    previousSelection: { id: weeklyId, mode: "all", weeks: [1, 2] },
  });

  assert.deepEqual(
    moved.schedule[0].week2.map((item) => item.subjectId),
    ["physics", "math"],
  );
  assert.equal(moved.schedule[0].week2[0].recurrence.overrides, undefined);
});

test("supports selected overrides in a four-week schedule", () => {
  const schedule = createSchedule(4);
  const withWeekly = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2, 3, 4] },
    previousSelection: { mode: "all", weeks: [1, 2, 3, 4] },
  });
  const weeklyId = withWeekly.schedule[0].week1[0].recurrence.id;

  const withOverride = recurrence.applyLessonRecurrence(withWeekly, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2, 4] },
    previousSelection: { mode: "selected", weeks: [2, 4] },
  });

  assert.deepEqual(
    [1, 2, 3, 4].map((week) => withOverride.schedule[0][`week${week}`][0].subjectId),
    ["math", "physics", "math", "physics"],
  );
  assert.deepEqual(withOverride.schedule[0].week2[0].recurrence.overrides, [weeklyId]);
  assert.deepEqual(withOverride.schedule[0].week4[0].recurrence.overrides, [weeklyId]);

  const edited = recurrence.applyLessonRecurrence(withOverride, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: 0,
    lesson: { ...lesson("math"), room: "204" },
    selection: { id: weeklyId, mode: "all", weeks: [1, 2, 3, 4] },
    previousSelection: { id: weeklyId, mode: "all", weeks: [1, 2, 3, 4] },
  });

  assert.equal(edited.schedule[0].week1[0].room, "204");
  assert.equal(edited.schedule[0].week3[0].room, "204");
  assert.equal(edited.schedule[0].week2[0].subjectId, "physics");
  assert.equal(edited.schedule[0].week4[0].subjectId, "physics");
});

test("expanding the cycle carries weekly series into new weeks", () => {
  const schedule = createSchedule(2);
  const recurring = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: null,
    lesson: lesson("math"),
    selection: { mode: "all", weeks: [1, 2] },
    previousSelection: { mode: "all", weeks: [1, 2] },
  });

  const result = recurrence.reconcileScheduleRepeat(
    { ...recurring, repeat: 4 },
    2,
  );

  assert.deepEqual(
    [1, 2, 3, 4].map((week) => result.schedule[0][`week${week}`][0].subjectId),
    ["math", "math", "math", "math"],
  );
  assert.deepEqual(result.schedule[0].week4[0].recurrence.weeks, [1, 2, 3, 4]);
});

test("shrinking the cycle removes stale weeks and narrows selected series", () => {
  const schedule = createSchedule(4);
  const selected = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2, 4] },
    previousSelection: { mode: "selected", weeks: [2, 4] },
  });
  selected.tasks = [{
    id: "week-4-task",
    lessonRef: {
      scheduleId: selected.id,
      dayIndex: 0,
      weekKey: "week4",
      lessonIndex: 0,
      seriesId: selected.schedule[0].week4[0].recurrence.id,
    },
  }];

  const result = recurrence.reconcileScheduleRepeat(
    { ...selected, repeat: 2 },
    4,
  );

  assert.deepEqual(Object.keys(result.schedule[0]), ["week1", "week2"]);
  assert.deepEqual(result.schedule[0].week2[0].recurrence.weeks, [2]);
  assert.equal(result.tasks[0].lessonRef, undefined);
});

test("upgrades legacy primitive duplicates to one series without losing task links", () => {
  const schedule = createSchedule();
  schedule.schedule[0].week1 = ["math"];
  schedule.schedule[0].week2 = ["math"];
  schedule.tasks = [{
    id: "legacy-task",
    lessonRef: {
      scheduleId: schedule.id,
      dayIndex: 0,
      weekKey: "week2",
      lessonIndex: 0,
    },
  }];
  const editorLesson = { index: 0, subjectId: "math", data: {} };
  const selection = recurrence.getLessonRecurrenceSelection(schedule, 0, 1, editorLesson);

  assert.equal(selection.mode, "all");
  assert.deepEqual(selection.weeks, [1, 2]);

  const result = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: 0,
    lesson: { ...lesson("math"), room: "204" },
    selection,
    previousSelection: selection,
  });

  const seriesId = result.schedule[0].week1[0].recurrence.id;
  assert.equal(result.schedule[0].week2[0].recurrence.id, seriesId);
  assert.equal(result.tasks[0].lessonRef.seriesId, seriesId);
  assert.equal(result.tasks[0].lessonRef.lessonIndex, 0);
});

test("editing one legacy slot preserves a second identical slot", () => {
  const schedule = createSchedule();
  schedule.schedule[0].week1 = [lesson("math"), lesson("math")];
  schedule.schedule[0].week2 = [lesson("math"), lesson("math")];
  const editorLesson = { index: 0, subjectId: "math", data: schedule.schedule[0].week1[0] };
  const selection = recurrence.getLessonRecurrenceSelection(schedule, 0, 1, editorLesson);

  const result = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 1,
    lessonIndex: 0,
    lesson: { ...lesson("math"), room: "204" },
    selection,
    previousSelection: selection,
  });

  ["week1", "week2"].forEach((weekKey) => {
    assert.equal(result.schedule[0][weekKey].length, 2);
    assert.equal(
      result.schedule[0][weekKey].filter((item) => item.room === "204").length,
      1,
    );
  });
});

test("a legacy weekly override preserves task links outside the replaced week", () => {
  const schedule = createSchedule();
  schedule.schedule[0].week1 = [lesson("math")];
  schedule.schedule[0].week2 = [lesson("math")];
  schedule.tasks = [
    {
      id: "week-1-task",
      lessonRef: {
        scheduleId: schedule.id,
        dayIndex: 0,
        weekKey: "week1",
        lessonIndex: 0,
      },
    },
    {
      id: "week-2-task",
      lessonRef: {
        scheduleId: schedule.id,
        dayIndex: 0,
        weekKey: "week2",
        lessonIndex: 0,
      },
    },
  ];

  const result = recurrence.applyLessonRecurrence(schedule, {
    dayIndex: 0,
    weekNumber: 2,
    lessonIndex: null,
    lesson: lesson("physics"),
    selection: { mode: "selected", weeks: [2] },
    previousSelection: { mode: "selected", weeks: [2] },
  });

  assert.equal(result.schedule[0].week1[0].subjectId, "math");
  assert.ok(result.tasks[0].lessonRef.seriesId);
  assert.equal(result.tasks[0].lessonRef.lessonIndex, 0);
  assert.equal(result.tasks[1].lessonRef, undefined);
});

test("caps malformed repeat counts at twelve weeks", () => {
  const schedule = createSchedule(12);
  schedule.repeat = 99;
  const selection = recurrence.getLessonRecurrenceSelection(
    schedule,
    0,
    1,
    { index: null, data: {} },
  );

  assert.equal(selection.weeks.length, 12);
  assert.equal(selection.weeks.at(-1), 12);
});

test("different series at the same occurrence index are not the same task reference", () => {
  const base = {
    scheduleId: "schedule-1",
    date: "2026-09-21",
    weekKey: "week2",
    dayIndex: 0,
    lessonIndex: 0,
  };

  assert.equal(taskLessonLinking.areLessonRefsSame(
    { ...base, seriesId: "series-a" },
    { ...base, seriesId: "series-b" },
  ), false);
  assert.equal(taskLessonLinking.areLessonRefsSame(
    { ...base, seriesId: "series-a" },
    { ...base, seriesId: "series-a", lessonIndex: 3 },
  ), true);
  assert.equal(taskLessonLinking.areLessonRefsSame(
    base,
    { ...base, seriesId: "series-a" },
  ), true);
});
