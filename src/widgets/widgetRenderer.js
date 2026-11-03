import { NativeModules } from 'react-native';
import { getWidgetInfo } from 'react-native-android-widget';
import {
  cancelWidgetRefresh,
  getScheduleWidgetSnapshot,
  readWidgetState,
  scheduleNextWidgetRefresh,
  SCHEDULE_WIDGET_NAME,
} from './widgetCore';

const renderModel = (widgetInfo, model) => NativeModules.ScheduleWidget.render(
  widgetInfo.widgetId,
  JSON.stringify(model),
);

export async function renderScheduleWidgetTask(widgetInfo) {
  const model = await getScheduleWidgetSnapshot(new Date());
  await renderModel(widgetInfo, model);
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
  const model = await getScheduleWidgetSnapshot(now, state);
  await Promise.all(widgetInfos.map((widgetInfo) => renderModel(widgetInfo, model)));

  scheduleNextWidgetRefresh(model.nextRefreshAt);
}
