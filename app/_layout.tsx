import { NAV_THEME, WASH } from '@/shared/lib/theme';
import { useThemeStore } from '@/shared/stores/theme-store';
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
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

export default function RootLayout() {
  // NativeWind's `dark:` variants are driven from the store itself, so there
  // is nothing to apply here — just read the resolved theme.
  const theme = useThemeStore((state) => state.theme);
  const hasHydrated = useThemeStore((state) => state.hasHydrated);

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

  // Waiting on the stored theme as well as the fonts: rendering before
  // AsyncStorage has answered would show light for a frame to someone who
  // chose dark.
  if (!fontsLoaded || !hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: WASH[theme].backgroundColor,
          experimental_backgroundImage: WASH[theme].backgroundImage,
        }}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View
        style={{
          flex: 1,
          backgroundColor: WASH[theme].backgroundColor,
          experimental_backgroundImage: WASH[theme].backgroundImage,
        }}
      >
        {/* NAV_THEME and contentStyle are both transparent so nothing paints
            over the wash behind them. */}
        <ThemeProvider value={NAV_THEME[theme]}>
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
