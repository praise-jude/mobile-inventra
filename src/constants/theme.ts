/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Mirrors tailwind.config.js's brand tokens (bg/surface/text/text-2/accent-
// weak pairs) so native-chrome surfaces that can't use NativeWind classes
// directly — the splash overlay, NativeTabs' bar/indicator colors — still
// match the rest of the app instead of Expo's default black-and-white.
export const Colors = {
  light: {
    text: '#111827',
    background: '#f8fafc',
    backgroundElement: '#ffffff',
    backgroundSelected: '#eff6ff',
    textSecondary: '#55607a',
  },
  dark: {
    text: '#eef1f7',
    background: '#0b0d12',
    backgroundElement: '#14171f',
    backgroundSelected: '#17233f',
    textSecondary: '#b3bacb',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Mirrors tailwind.config.js's brand palette — needed as literal hex values
// (not NativeWind classes) anywhere a component draws with react-native-svg,
// which can't resolve CSS custom properties/className the way web's inline
// SVG (`var(--accent)` etc.) does.
export const ChartColors = {
  light: {
    border: '#e5e7eb',
    muted: '#6b7280',
    surface: '#ffffff',
    text: '#111827',
    accent: '#2563eb',
    green: '#10b981',
    red: '#ef4444',
    amber: '#f59e0b',
    sky: '#0891b2',
  },
  dark: {
    border: '#232834',
    muted: '#7f8aa0',
    surface: '#14171f',
    text: '#eef1f7',
    accent: '#3b82f6',
    green: '#34d399',
    red: '#f87171',
    amber: '#fbbf24',
    sky: '#22d3ee',
  },
} as const;

// Category/expense donut-slice palette — mirrors Inventra's
// components/charts/DonutChart.tsx PALETTE exactly (same colors regardless
// of light/dark, matching web's own choice there).
export const DONUT_PALETTE = ['#2563eb', '#10b981', '#0891b2', '#f59e0b', '#ef4444', '#8a94a8'] as const;

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
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
