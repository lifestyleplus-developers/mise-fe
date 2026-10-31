import type { InventoryItem } from '@/shared/api/types';
import { SearchField } from '@/shared/components/search-field';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

type ItemFilterSheetProps = {
  visible: boolean;
  items: readonly InventoryItem[];
  /** The chosen item; null is "All items". */
  value: number | null;
  /** "All items" is a choice only where the platform can list a whole outlet. */
  allowAll: boolean;
  onPick: (id: number | null) => void;
  onClose: () => void;
};

/** A searchable list of an outlet's items, "All items" first. */
function ItemFilterSheet({
  visible,
  items,
  value,
  allowAll,
  onPick,
  onClose,
}: ItemFilterSheetProps) {
  const t = useT();
  const [query, setQuery] = React.useState('');
  const needle = query.trim().toLowerCase();

  const rows: { id: number | null; label: string }[] = [
    ...(allowAll && !needle ? [{ id: null, label: t('inv.all-items') }] : []),
    ...items
      .filter((item) => !item.is_archived)
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
      .map((item) => ({ id: item.id as number | null, label: item.name })),
  ];

  return (
    <BottomSheet
      visible={visible}
      title={t('inv.item-sheet')}
      onDismiss={onClose}
      footer={
        <Button variant="outline" className="w-full" onPress={onClose}>
          <Text>{t('admin.cancel')}</Text>
        </Button>
      }
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t('inv.search')}
        clearLabel={t('att.clear')}
      />
      <ScrollView
        className="border-border mt-3 max-h-[320px] rounded-3xl border"
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((row, index) => {
          const selected = row.id === value;
          return (
            <Pressable
              key={row.id ?? 'all'}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setQuery('');
                onPick(row.id);
              }}
              className={cn(
                'active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2',
                index > 0 && 'border-border border-t',
              )}
            >
              <Text
                className={cn(
                  'min-w-0 flex-1 text-[16px]',
                  selected ? 'font-sans-bold' : 'font-sans-medium',
                )}
              >
                {row.label}
              </Text>
              {selected ? (
                <Check className="text-foreground size-5 shrink-0" />
              ) : (
                <View className="size-5 shrink-0" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

export { ItemFilterSheet };
