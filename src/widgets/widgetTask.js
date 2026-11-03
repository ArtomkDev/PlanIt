import * as Linking from 'expo-linking';
import {
  recordWidgetIntent,
  readWidgetState,
  updateWidgetOffset,
} from './widgetCore';
import { createWidgetLessonUrl } from './widgetLinking';
import { refreshScheduleWidgets, renderScheduleWidgetTask } from './widgetRenderer';
import { syncWidgetFromCloud, syncWidgetPushSubscription } from './widgetSync';

const RENDER_ACTIONS = new Set([
  'WIDGET_ADDED',
  'WIDGET_RESIZED',
  'WIDGET_UPDATE',
  'WIDGET_CLICK',
]);

const NAVIGATION_ACTIONS = new Set(['PREV_DAY', 'NEXT_DAY', 'TODAY']);

export async function widgetTask({
  widgetAction,
  widgetInfo,
  clickAction,
  clickActionData,
}) {
  try {
    if (widgetAction === 'WIDGET_SYNC') {
      const changed = await syncWidgetFromCloud();
      if (!changed) await refreshScheduleWidgets();
      await syncWidgetPushSubscription();
      return;
    }
    if (widgetAction === 'WIDGET_DELETED') {
      await syncWidgetPushSubscription();
      return;
    }
    if (clickAction === 'OPEN_LESSON') {
      const { schedule } = await readWidgetState();
      await Linking.openURL(createWidgetLessonUrl(clickActionData, schedule?.id));
      return;
    }
    if (clickAction === 'OPEN_SCHEDULE_SELECTOR') {
      await recordWidgetIntent(clickAction, clickActionData || {});
      await Linking.openURL('planit://');
      return;
    }

    if (!RENDER_ACTIONS.has(widgetAction)) return;

    if (widgetAction === 'WIDGET_CLICK' && NAVIGATION_ACTIONS.has(clickAction)) {
      await updateWidgetOffset(clickAction);
    }

    await renderScheduleWidgetTask(widgetInfo);
    if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
      await syncWidgetFromCloud();
      await syncWidgetPushSubscription();
    }
  } catch (error) {
    console.error('Widget Task Error:', error);
  }
}
