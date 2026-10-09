import { Text } from '@/shared/components/ui/text';
import * as React from 'react';
import { View } from 'react-native';

type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Optional second line under the title. */
  body?: string;
  /** Optional pointer to where the user can go next — usually a Button. */
  action?: React.ReactNode;
};

/** "Nothing here" as good news, not an error (FE Spec §11). */
function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  return (
    <View className="shadow-card border-border bg-card mx-4 items-center gap-4 rounded-3xl border px-6 py-10">
      <View className="bg-secondary size-12 items-center justify-center rounded-2xl">
        <Icon className="text-foreground size-6" />
      </View>
      <Text
        variant="h2"
        className="border-b-0 pb-0 text-center text-[22px] leading-tight"
      >
        {title}
      </Text>
      {body ? (
        <Text className="text-muted-foreground -mt-2 text-center text-[15px]">
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export { EmptyState };
export type { EmptyStateProps };
