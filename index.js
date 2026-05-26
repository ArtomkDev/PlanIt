import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';
import { widgetTask } from './src/widgets/widgetTask';

registerRootComponent(App);

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  registerWidgetTaskHandler(widgetTask);
}