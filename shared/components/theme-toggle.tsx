import { useThemeStore } from '@/shared/stores/theme-store';
import { useT } from '@/shared/i18n';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';

/** Theme toggle; temporary home on Login. */
function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const t = useT();
  const isDark = theme === 'dark';

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={
        isDark ? t('theme.switch-to-light') : t('theme.switch-to-dark')
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
