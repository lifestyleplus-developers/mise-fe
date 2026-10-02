import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { Archive } from 'lucide-react-native';
import { View } from 'react-native';

/** "Archived" tag shown beside an outlet's name. */
export function ArchivedBadge() {
  const t = useT();
  return (
    <View className="bg-secondary shrink-0 flex-row items-center gap-1 rounded-full px-2.5 py-1">
      <Archive className="text-foreground size-3.5" />
      <Text className="font-sans-semibold text-[12px]">
        {t('outlets.archived')}
      </Text>
    </View>
  );
}
