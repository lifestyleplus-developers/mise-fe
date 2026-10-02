import { PushedScreen } from '@/features/shell/pushed-screen';
import { TabScreen } from '@/features/shell/tab-screen';
import { Text } from '@/shared/components/ui/text';
import { format, useT, type MessageKey } from '@/shared/i18n';
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
 * Stands in for a screen that is specced for a later week. The mockup draws
 * exactly this in the same places, so the shell can be walked through before
 * the screens inside it exist. Also used inline by a real screen that has a
 * part still to come (Home's run groups).
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

type PlaceholderConfig = PlaceholderCardProps & {
  /** Catalogue key for the screen title. */
  title: MessageKey;
  /**
   * `tab` is a tab root (header, pull to refresh, room for the pill);
   * `pushed` is a screen opened over the tabs (Back button, no pill).
   */
  frame: 'tab' | 'pushed';
  /** Pushed screens only: ADMIN and OWNER. */
  adminOnly?: boolean;
};

/**
 * One placeholder screen, whichever frame it sits in. Route files call this
 * with the screen's config and export the result; deleting a placeholder is
 * re-pointing its route at the real screen.
 */
export function createPlaceholder({
  title,
  frame,
  adminOnly,
  ...card
}: PlaceholderConfig) {
  return function Placeholder() {
    const t = useT();
    const body = <PlaceholderCard {...card} />;
    return frame === 'tab' ? (
      <TabScreen title={t(title)}>{body}</TabScreen>
    ) : (
      <PushedScreen title={t(title)} adminOnly={adminOnly}>
        {body}
      </PushedScreen>
    );
  };
}
