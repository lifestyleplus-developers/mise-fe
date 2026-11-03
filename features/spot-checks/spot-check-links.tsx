import { useMe } from '@/features/auth/use-me';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { ClipboardList, LayoutGrid, ListChecks } from 'lucide-react-native';
import { View } from 'react-native';

/**
 * The row under the capture screen's title: Results for everyone who can open Spot
 * checks, and Checks and Areas for ADMIN and OWNER, who author them. Everyone lands
 * on the capture screen first; these are the ways on from it.
 */
export function SpotCheckLinks() {
  const { data: me } = useMe();
  const router = useRouter();
  const t = useT();
  if (!me) return null;
  const admin = canAdminister(me.user.tenant_role);
  return (
    <View className="mx-4 mb-3 flex-row flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onPress={() => router.push('/spot-checks/results')}
      >
        <ListChecks className="text-foreground size-4" />
        <Text>{t('spot.results')}</Text>
      </Button>
      {admin ? (
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.push('/spot-checks/checks')}
        >
          <ClipboardList className="text-foreground size-4" />
          <Text>{t('spot.checks')}</Text>
        </Button>
      ) : null}
      {admin ? (
        <Button
          variant="outline"
          size="sm"
          onPress={() => router.push('/spot-checks/areas')}
        >
          <LayoutGrid className="text-foreground size-4" />
          <Text>{t('spot.areas')}</Text>
        </Button>
      ) : null}
    </View>
  );
}
