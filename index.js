/**
 * @format
 */

import 'react-native-get-random-values'; // Must be first — polyfills crypto.getRandomValues for uuid
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
