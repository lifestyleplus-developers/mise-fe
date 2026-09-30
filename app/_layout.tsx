import { NAV_THEME, WASH } from '@/shared/lib/theme';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { PortalHost } from '@rn-primitives/portal';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

/**
 * The app is light-only until an in-app theme switcher exists.
 *
 * Three things have to agree, and none of them can be skipped:
 *  - `colorScheme.set` drives NativeWind's `dark:` variants. It forwards to
 *    RN's Appearance rather than setting the observable that NativeWind reads,
 *    so calling it at module scope — before the appearance listener is live —
 *    is lost and the OS scheme wins. Doing it on first render is what sticks.
 *  - WASH / NAV_THEME / StatusBar read the literal light values rather than
 *    whatever the OS reports.
 *  - app.json's `userInterfaceStyle: "light"` covers native builds but is
 *    ignored in Expo Go, which is why it isn't enough on its own.
 */
function useLightThemeOnly() {
  useState(() => colorScheme.set('light'));
}

export default function RootLayout() {
  useLightThemeOnly();

  // Montserrat for body, Playfair Display for headings and the wordmark —
  // the split the mockup's stylesheet makes between `body` and `h1..h6`.
  // Each weight is its own family: RN can't pick a weight out of a family
  // the way CSS does, so the weights are named in tailwind.config.js.
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    PlayfairDisplay_600SemiBold,
  });

  if (!fontsLoaded) {
    // Render the wash alone rather than text in a fallback face that would
    // reflow the moment the real fonts land.
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: WASH.light.backgroundColor,
          experimental_backgroundImage: WASH.light.backgroundImage,
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View
        style={{
          flex: 1,
          backgroundColor: WASH.light.backgroundColor,
          experimental_backgroundImage: WASH.light.backgroundImage,
        }}
      >
        {/* NAV_THEME and contentStyle are both transparent so nothing paints
            over the wash behind them. */}
        <ThemeProvider value={NAV_THEME.light}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </ThemeProvider>
      </View>
      <PortalHost />
    </SafeAreaProvider>
  );
}
