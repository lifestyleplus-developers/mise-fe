import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

/** How many rows a list shows before it folds. */
export const FOLD_LIMIT = 3;

type FoldListProps<T> = {
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  limit?: number;
};

/**
 * Shows the first few rows of a list. A longer list ends in "See all (n)", which
 * opens the rest in place, and "See less" folds it again. A short list has no button.
 */
export function FoldList<T>({
  items,
  renderItem,
  limit = FOLD_LIMIT,
}: FoldListProps<T>) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const folds = items.length > limit;
  const shown = open || !folds ? items : items.slice(0, limit);

  return (
    <>
      {shown.map((item, index) => renderItem(item, index))}
      {folds ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          className="border-border active:bg-accent min-h-12 flex-row items-center justify-center gap-1.5 border-t px-4"
        >
          <Text className="font-sans-semibold text-[14px]">
            {open
              ? t('home.see-less')
              : format(t('home.see-all'), { n: String(items.length) })}
          </Text>
          <ChevronDown
            className={cn('text-foreground size-4', open && 'rotate-180')}
          />
        </Pressable>
      ) : null}
    </>
  );
}
