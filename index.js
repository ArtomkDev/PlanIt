import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTask } from './src/widgets/widgetTask';

registerWidgetTaskHandler(widgetTask);

registerRootComponent(App);