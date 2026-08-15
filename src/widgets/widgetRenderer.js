import React from 'react';
import {
  getWidgetInfo,
  requestWidgetUpdateById,
} from 'react-native-android-widget';
import { ScheduleWidget } from './ScheduleWidget';
import {
  cancelWidgetRefresh,
  getScheduleWidgetModel,
  readWidgetState,
  scheduleNextWidgetRefresh,
  SCHEDULE_WIDGET_NAME,
} from './widgetCore';

const createWidgetElement = (model) => <ScheduleWidget model={model} />;

export async function renderScheduleWidgetTask(widgetInfo, renderWidget) {
  const model = await getScheduleWidgetModel(widgetInfo, new Date());
  renderWidget(createWidgetElement(model));
  scheduleNextWidgetRefresh(model.nextRefreshAt);
  return model;
}

export async function refreshScheduleWidgets() {
  const widgetInfos = await getWidgetInfo(SCHEDULE_WIDGET_NAME);
  if (widgetInfos.length === 0) {
    cancelWidgetRefresh();
    return;
  }

  // One storage read and one clock snapshot keep every instance consistent.
  const state = await readWidgetState();
  const now = new Date();
  const models = await Promise.all(widgetInfos.map(
    (widgetInfo) => getScheduleWidgetModel(widgetInfo, now, state),
  ));

  await Promise.all(widgetInfos.map((widgetInfo, index) => requestWidgetUpdateById({
    widgetName: SCHEDULE_WIDGET_NAME,
    widgetId: widgetInfo.widgetId,
    renderWidget: () => createWidgetElement(models[index]),
  })));

  const nextRefreshAt = models.reduce((earliest, model) => {
    if (!Number.isFinite(model.nextRefreshAt)) return earliest;
    return earliest === null
      ? model.nextRefreshAt
      : Math.min(earliest, model.nextRefreshAt);
  }, null);
  scheduleNextWidgetRefresh(nextRefreshAt);
}
