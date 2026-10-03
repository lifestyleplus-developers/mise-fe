import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { UserX } from 'lucide-react-native';
import { View } from 'react-native';

/** "Inactive" tag for a deactivated person. */
export function InactiveBadge() {
  const t = useT();
  return (
    <View className="bg-secondary shrink-0 flex-row items-center gap-1 self-start rounded-full px-2.5 py-1">
      <UserX className="text-foreground size-3.5" />
      <Text className="font-sans-semibold text-[12px]">
        {t('users.inactive')}
      </Text>
    </View>
  );
}
