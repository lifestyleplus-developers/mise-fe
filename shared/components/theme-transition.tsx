import { WASH } from '@/shared/lib/theme';
import {
  THEME_FADE_IN_MS,
  useAppliedTheme,
  useThemeStore,
} from '@/shared/stores/theme-store';
import * as React from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/** Fades a theme change with a veil in the new backdrop (see theme-store). */
export function ThemeTransition() {
  const theme = useThemeStore((state) => state.theme);
  const applied = useAppliedTheme();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const previous = React.useRef(theme);

  React.useEffect(() => {
    if (previous.current === theme) return;
    previous.current = theme;
    opacity.stopAnimation();
    Animated.timing(opacity, {
      toValue: 1,
      duration: THEME_FADE_IN_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [theme, opacity]);

  React.useEffect(() => {
    if (applied !== theme) return;
    opacity.stopAnimation();
    Animated.timing(opacity, {
      toValue: 0,
      delay: 60,
      duration: 320,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [applied, theme, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: WASH[theme].backgroundColor,
          experimental_backgroundImage: WASH[theme].backgroundImage,
          zIndex: 100,
          opacity,
        },
      ]}
    />
  );
}
