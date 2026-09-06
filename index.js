import { registerRootComponent, isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import App from './App';

registerRootComponent(App);

if (Platform.OS === 'android' && !isRunningInExpoGo()) {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTask } = require('./src/widgets/widgetTask');
  registerWidgetTaskHandler(widgetTask);
}