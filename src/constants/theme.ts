/* eslint-disable no-bitwise -- byte-extraction in hex<->rgb is the
 * intended use of these operators; the rule's "probably a typo for &&/||"
 * heuristic does not apply.
 */
import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {theme as configTheme} from '../config/loader';
import type {ThemeSection} from '../config/loader';

// --- Color utilities ---

function hexToRgb(hex: string): {r: number; g: number; b: number} {
  const n = parseInt(hex.slice(1), 16);
  return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function adjustBrightness(hex: string, amount: number): string {
  const {r, g, b} = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function generateDarkPalette(light: ThemeSection): ThemeSection {
  return {
    ...light,
    background: '#0C1222',
    surface: '#162032',
    text: '#E2E8F0',
    textSecondary: '#94A3B8',
    textInverse: '#0C1222',
    botBubble: '#1C2D42',
    botBubbleText: '#E2E8F0',
    userBubble: adjustBrightness(light.primary, -20),
    userBubbleText: '#FFFFFF',
    border: '#1E3048',
    inputBg: '#1C2D42',
    primary: light.primary,
    primaryLight: light.primaryLight ?? adjustBrightness(light.primary, 40),
    primaryDark: light.primaryDark ?? adjustBrightness(light.primary, -40),
    secondary: light.secondary,
    success: light.success ?? '#059669',
    warning: light.warning ?? '#D97706',
    error: light.error ?? '#DC2626',
    offline: '#94A3B8',
  };
}

// --- Resolve active palette ---

const darkModeConfig = configTheme.darkMode ?? false;
const lightPalette: ThemeSection = configTheme;
const darkPalette: ThemeSection = {
  ...generateDarkPalette(lightPalette),
  ...(configTheme.darkTheme ?? {}),
};

function resolveStaticPalette(): ThemeSection {
  if (darkModeConfig === true) return darkPalette;
  return lightPalette;
}

export const COLORS: ThemeSection = resolveStaticPalette();

// --- Font support ---

const fontFamily = configTheme.font ?? 'System';

export const FONTS = {
  regular: fontFamily,
  medium: fontFamily,
  bold: fontFamily,
};

// --- Typography scale ---

export const TYPOGRAPHY = {
  display: {
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  micro: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
};

// --- Spacing ---

export const SPACING = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  xxl: 32,
  '3xl': 48,
  '4xl': 64,
};

// --- Border radius ---

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// --- Bubble geometry (Messenger-style grouping) ---
// Four position states: standalone, first, middle, last
// "Tail side" = bottom-left for bot, bottom-right for user

const BUBBLE_FULL = 20;
const BUBBLE_FLAT = 4;

export type BubblePosition = 'standalone' | 'first' | 'middle' | 'last';

export const BUBBLE_RADIUS = {
  bot: {
    standalone: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FULL,
    },
    first: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FLAT,
      bottomRight: BUBBLE_FULL,
    },
    middle: {
      topLeft: BUBBLE_FLAT,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FLAT,
      bottomRight: BUBBLE_FULL,
    },
    last: {
      topLeft: BUBBLE_FLAT,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FULL,
    },
  },
  user: {
    standalone: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FULL,
    },
    first: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FULL,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FLAT,
    },
    middle: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FLAT,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FLAT,
    },
    last: {
      topLeft: BUBBLE_FULL,
      topRight: BUBBLE_FLAT,
      bottomLeft: BUBBLE_FULL,
      bottomRight: BUBBLE_FULL,
    },
  },
};

// Spacing between messages based on grouping
export const GROUP_SPACING = {
  grouped: 2,     // Between consecutive same-sender messages
  ungrouped: 12,  // Between different senders or time-separated
};

// --- Shadow presets ---

export const SHADOWS = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  xl: {
    shadowColor: '#0F172A',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
};

// --- Animation timing ---

export const TIMING = {
  fast: 150,
  normal: 250,
  slow: 350,
  spring: {tension: 100, friction: 10},
  springGentle: {tension: 60, friction: 8},
  springSnappy: {tension: 140, friction: 12},
};

// --- Haptic patterns (for react-native-haptic-feedback if added) ---

export const HAPTIC = {
  light: 'impactLight' as const,
  medium: 'impactMedium' as const,
  success: 'notificationSuccess' as const,
  error: 'notificationError' as const,
};

// --- Theme Context ---

interface ThemeContextValue {
  colors: ThemeSection;
  isDark: boolean;
  fonts: typeof FONTS;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: COLORS,
  isDark: darkModeConfig === true,
  fonts: FONTS,
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    let isDark: boolean;
    if (darkModeConfig === 'auto') {
      isDark = systemScheme === 'dark';
    } else {
      isDark = darkModeConfig === true;
    }

    return {
      colors: isDark ? darkPalette : lightPalette,
      isDark,
      fonts: FONTS,
    };
  }, [systemScheme]);

  return React.createElement(ThemeContext.Provider, {value}, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
