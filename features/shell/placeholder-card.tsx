import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import * as React from 'react';
import { View } from 'react-native';

type PlaceholderCardProps = {
  /** Screen id from the mockup, e.g. 'CHK-01'. Developer-facing, not translated. */
  id: string;
  name: string;
  /** The delivery week the real screen lands in (Delivery Timeline). */
  week: number;
  children?: React.ReactNode;
};

/**
 * Stands in for a screen that is specced for a later week. The week-1
 * mockup draws exactly this in the same places, so the shell can be built
 * and walked through before the screens inside it exist.
 */
export function PlaceholderCard({
  id,
  name,
  week,
  children,
}: PlaceholderCardProps) {
  const t = useT();
  return (
    <View className="border-border bg-card/60 mx-4 items-center rounded-3xl border-2 border-dashed px-5 py-8">
      <Text className="text-muted-foreground font-sans-semibold text-[12px] tracking-wide uppercase">
        {t('placeholder.label')}
      </Text>
      <Text className="font-sans-semibold mt-1 text-center text-[15px]">
        {id} · {name}
      </Text>
      <Text className="text-muted-foreground mt-1 text-center text-[13px]">
        {format(t('placeholder.week'), { n: String(week) })}
      </Text>
      {children ? (
        <View className="mt-4 items-center gap-2">{children}</View>
      ) : null}
    </View>
  );
}
