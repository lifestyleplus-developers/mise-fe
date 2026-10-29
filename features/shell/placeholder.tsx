import { PushedScreen } from '@/features/shell/pushed-screen';
import { TabScreen } from '@/features/shell/tab-screen';
import { Text } from '@/shared/components/ui/text';
import { useT, type MessageKey } from '@/shared/i18n';
import * as React from 'react';
import { View } from 'react-native';

type PlaceholderCardProps = {
  /** The screen's name, already in the person's language. */
  name: string;
};

/** Stands in for a screen that is not built yet: its name, and "Coming soon". */
export function PlaceholderCard({ name }: PlaceholderCardProps) {
  const t = useT();
  return (
    <View className="border-border bg-card/60 mx-4 items-center rounded-3xl border-2 border-dashed px-5 py-8">
      <Text className="font-sans-semibold text-center text-[17px]">{name}</Text>
      <Text className="text-muted-foreground mt-1 text-center text-[15px]">
        {t('placeholder.coming-soon')}
      </Text>
    </View>
  );
}

type PlaceholderConfig = {
  /** Catalogue key for the screen title, which is also the name shown on the card. */
  title: MessageKey;
  /** `tab`: a tab root. `pushed`: opened over the tabs, no tab bar. */
  frame: 'tab' | 'pushed';
  /** Pushed screens only: ADMIN and OWNER. */
  adminOnly?: boolean;
  /** Pushed screens only: where Back goes when nothing is behind this screen. */
  backHref?: React.ComponentProps<typeof PushedScreen>['backHref'];
};

/** A whole placeholder screen. Route files export its result. */
export function createPlaceholder({
  title,
  frame,
  adminOnly,
  backHref,
}: PlaceholderConfig) {
  return function Placeholder() {
    const t = useT();
    const body = <PlaceholderCard name={t(title)} />;
    return frame === 'tab' ? (
      <TabScreen title={t(title)}>{body}</TabScreen>
    ) : (
      <PushedScreen title={t(title)} adminOnly={adminOnly} backHref={backHref}>
        {body}
      </PushedScreen>
    );
  };
}
