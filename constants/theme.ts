/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  background: '#0F1923',
  surface: '#1F2326',
  primary: '#00FF87',
  text: '#ECE8E1',
  danger: '#FF4655',
  gray: '#8B97A3',
  light: {
    text: '#ECE8E1',
    background: '#0F1923',
    tint: '#00FF87',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#00FF87',
  },
  dark: {
    text: '#ECE8E1',
    background: '#0F1923',
    tint: '#00FF87',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#00FF87',
  },
};

let currentTheme: 'dark' | 'light' = 'dark';
const listeners = new Set<(theme: 'dark' | 'light') => void>();

export const getThemeMode = () => currentTheme;

export const subscribeTheme = (listener: (theme: 'dark' | 'light') => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const toggleTheme = () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  if (currentTheme === 'light') {
    Colors.background = '#ECE8E1'; // Light off-white sand background
    Colors.surface = '#F5F2EC';    // Lighter card/surface
    Colors.text = '#0F1923';       // Dark text
    Colors.gray = '#6A7680';       // Darker gray for readability
    Colors.primary = '#FF4655';    // Valorant Red for light mode
  } else {
    Colors.background = '#0F1923'; // Dark background
    Colors.surface = '#1F2326';    // Dark surface
    Colors.text = '#ECE8E1';       // Light text
    Colors.gray = '#8B97A3';       // Light gray
    Colors.primary = '#00FF87';    // Valorant Neon Green
  }
  listeners.forEach(l => l(currentTheme));
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
