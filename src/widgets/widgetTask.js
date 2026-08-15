import * as Linking from 'expo-linking';
import {
  recordWidgetIntent,
  updateWidgetOffset,
} from './widgetCore';
import { renderScheduleWidgetTask } from './widgetRenderer';

const RENDER_ACTIONS = new Set([
  'WIDGET_ADDED',
  'WIDGET_RESIZED',
  'WIDGET_UPDATE',
  'WIDGET_CLICK',
]);

const NAVIGATION_ACTIONS = new Set(['PREV_DAY', 'NEXT_DAY', 'TODAY']);
const OPEN_ACTIONS = new Set(['OPEN_SCHEDULE_SELECTOR', 'OPEN_LESSON']);

export async function widgetTask({
  widgetAction,
  widgetInfo,
  clickAction,
  clickActionData,
  renderWidget,
}) {
  try {
    if (OPEN_ACTIONS.has(clickAction)) {
      await recordWidgetIntent(clickAction, clickActionData || {});
      await Linking.openURL('planit://');
      return;
    }

    if (!RENDER_ACTIONS.has(widgetAction)) return;

    if (widgetAction === 'WIDGET_CLICK' && NAVIGATION_ACTIONS.has(clickAction)) {
      await updateWidgetOffset(clickAction);
    }

    // This renderer belongs to the exact widget instance that emitted the event.
    // Calling it directly avoids a second WorkManager job and redundant redraws.
    await renderScheduleWidgetTask(widgetInfo, renderWidget);
  } catch (error) {
    console.error('Widget Task Error:', error);
  }
}
