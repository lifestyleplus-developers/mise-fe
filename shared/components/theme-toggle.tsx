import { useThemeStore } from '@/shared/stores/theme-store';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';

/**
 * Temporary home: theme switching belongs in Settings (FE Spec §3.12 puts
 * language, profile and sign out there), which does not exist yet. Move it
 * when that screen is built — nothing here is Login-specific.
 */
function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';

  // 11 ≈ 44pt square: the smallest comfortable tap target without the label
  // the pill used to carry.
  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={
        isDark ? 'Switch to light theme' : 'Switch to dark theme'
      }
      className="border-input-edge bg-card active:bg-accent h-11 w-11 items-center justify-center self-start rounded-full border"
    >
      {isDark ? (
        <Moon className="text-foreground size-[20px]" />
      ) : (
        <Sun className="text-foreground size-[20px]" />
      )}
    </Pressable>
  );
}

export { ThemeToggle };
