import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import type { BusinessRef } from '@/shared/api/types';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Store } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';

type BusinessPickerProps = {
  visible: boolean;
  businesses: BusinessRef[];
  /** The row whose sign-in is in flight; every other row is inert meanwhile. */
  choosingId: number | null;
  onChoose: (businessId: number) => void;
  onCancel: () => void;
};

/** "Which business?" picker for an ambiguous username (API Contract §2). */
export function BusinessPicker({
  visible,
  businesses,
  choosingId,
  onChoose,
  onCancel,
}: BusinessPickerProps) {
  const t = useT();
  const busy = choosingId !== null;

  return (
    <BottomSheet
      visible={visible}
      title={t('login.picker.title')}
      onDismiss={busy ? () => {} : onCancel}
      footer={
        <Button
          variant="outline"
          className="min-h-12 w-full"
          onPress={onCancel}
          disabled={busy}
        >
          <Text>{t('login.picker.cancel')}</Text>
        </Button>
      }
    >
      <View className="border-border overflow-hidden rounded-3xl border">
        {businesses.map((business, index) => (
          <Pressable
            key={business.id}
            accessibilityRole="button"
            onPress={() => onChoose(business.id)}
            disabled={busy}
            className={cn(
              'active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2',
              index > 0 && 'border-border border-t',
              busy && choosingId !== business.id && 'opacity-60',
            )}
          >
            <View className="border-border size-9 items-center justify-center rounded-xl border">
              <Store className="text-foreground size-[18px]" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans-medium text-[15px]">
                {business.name}
              </Text>
              {choosingId === business.id ? (
                <View className="mt-0.5 flex-row items-center gap-1.5">
                  <ActivityIndicator size="small" />
                  <Text className="font-sans-semibold text-[13px]">
                    {t('login.signing-in')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
