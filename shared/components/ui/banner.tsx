import { cn } from '@/shared/lib/utils';
import { CircleAlert, Info } from 'lucide-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

type BannerProps = {
  tone: 'error' | 'notice';
  message: string;
  detail?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

function Banner({ tone, message, detail, icon: Icon }: BannerProps) {
  const ResolvedIcon = Icon ?? (tone === 'error' ? CircleAlert : Info);

  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      className={cn(
        'flex-row items-start gap-2.5 rounded-2xl px-4 py-3',
        tone === 'error'
          ? 'bg-destructive-soft'
          : 'border-input-edge bg-card border',
      )}
    >
      <ResolvedIcon
        className={cn(
          'mt-0.5 size-5 shrink-0',
          tone === 'error'
            ? 'text-destructive-soft-foreground'
            : 'text-foreground',
        )}
      />
      <View className="min-w-0 flex-1">
        <Text
          className={cn(
            'font-sans-medium text-[14px] leading-snug',
            tone === 'error'
              ? 'text-destructive-soft-foreground'
              : 'text-foreground',
          )}
        >
          {message}
        </Text>
        {detail ? (
          <Text
            className={cn(
              'mt-1 text-[14px] leading-snug',
              tone === 'error'
                ? 'text-destructive-soft-foreground'
                : 'text-foreground',
            )}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export { Banner };
export type { BannerProps };
