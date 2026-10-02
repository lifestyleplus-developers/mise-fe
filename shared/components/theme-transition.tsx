import { WASH } from '@/shared/lib/theme';
import {
  THEME_FADE_IN_MS,
  useAppliedTheme,
  useThemeStore,
} from '@/shared/stores/theme-store';
import * as React from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/**
 * Makes a theme change a fade instead of a cut. NativeWind swaps every colour
 * in one step, so there is nothing to animate between — instead a veil in the
 * *new* theme's backdrop fades in over the old screen, the palette flips
 * underneath it while it is opaque, and it fades out onto the new screen.
 * The change reads as the screen dissolving into the next, with no frame in
 * which the old and new palettes are mixed.
 *
 * Sequencing lives in the theme store: it changes `theme` at once (this
 * component's cue to start) and tells NativeWind `THEME_FADE_IN_MS` later,
 * which shows up here as `applied` catching up to `theme` (the cue to lift).
 *
 * React Native's own Animated rather than Reanimated: opacity on the native
 * driver is all this needs, and it keeps the app free of a second native
 * animation runtime that has to match Expo Go's.
 */
export function ThemeTransition() {
  const theme = useThemeStore((state) => state.theme);
  const applied = useAppliedTheme();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const previous = React.useRef(theme);

  // Cover: the stored theme moved, the palette has not.
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

  // Lift: the palette has caught up. The short delay lets the first frames of
  // the new palette lay out before they are revealed.
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
          // The destination's backdrop, so the veil is the same picture the
          // screen settles on.
          backgroundColor: WASH[theme].backgroundColor,
          experimental_backgroundImage: WASH[theme].backgroundImage,
          zIndex: 100,
          opacity,
        },
      ]}
    />
  );
}
