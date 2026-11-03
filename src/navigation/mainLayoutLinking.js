import { parseWidgetLessonIntent } from '../widgets/widgetLinking';

export default {
  path: '',
  alias: ['*'],
  screens: {
    Tabs: {
      path: '',
      screens: {
        ScheduleTab: {
          path: 'widget/lesson',
          parse: { lessonViewIntent: parseWidgetLessonIntent },
        },
      },
    },
  },
};
