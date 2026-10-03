import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { Plus } from 'lucide-react-native';

/** The "+ New" button in a screen header. */
function NewButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  const theme = useAppliedTheme();
  return (
    <Button size="sm" onPress={onPress}>
      <Plus
        size={16}
        color={theme === 'dark' ? THEME.dark.primaryForeground : '#ffffff'}
      />
      <Text>{t('admin.new')}</Text>
    </Button>
  );
}

export { NewButton };
