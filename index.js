import { registerRootComponent, isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { createElement } from 'react';

// Headless updates load the UI and cloud services only when they are needed.
function PlanItApp(props) {
  const App = require('./App').default;
  return createElement(App, props);
}

registerRootComponent(PlanItApp);

if (Platform.OS === 'android' && !isRunningInExpoGo()) {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTask } = require('./src/widgets/widgetTask');
  registerWidgetTaskHandler(widgetTask);
  require('./src/widgets/widgetPushTask');
}
