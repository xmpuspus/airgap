import {Appearance} from 'react-native';

const lightTheme = {
  primary: '#0E7490',
  secondary: '#C2410C',
  background: '#F6F8FA',
  surface: '#FFFFFF',
};

function loadColors(darkMode: boolean | 'auto', scheme: 'light' | 'dark' | null) {
  jest.resetModules();
  jest.doMock('../src/config/loader', () => ({theme: {...lightTheme, darkMode}}));
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(scheme);
  return require('../src/constants/theme').COLORS;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.dontMock('../src/config/loader');
});

test('auto uses the dark palette when the device is in dark mode', () => {
  expect(loadColors('auto', 'dark').background).toBe('#0C1222');
});

test('auto uses the light palette when the device is in light mode', () => {
  expect(loadColors('auto', 'light').background).toBe('#F6F8FA');
});

test('auto uses the light palette when the device has no preference', () => {
  expect(loadColors('auto', null).background).toBe('#F6F8FA');
});

test('true forces the dark palette and false forces the light palette', () => {
  expect(loadColors(true, 'light').background).toBe('#0C1222');
  expect(loadColors(false, 'dark').background).toBe('#F6F8FA');
});

test('the palette is fixed at load, so the module needs no provider', () => {
  loadColors(false, 'light');
  expect(require('../src/constants/theme').ThemeProvider).toBeUndefined();
});
