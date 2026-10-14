import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Check, Flag } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type YesNoProps = {
  /** The current answers, if any; at most one of these is non-null. */
  answer: boolean | null;
  /** Disabled while the window is closed or a write is mid-flight on this row. */
  disabled?: boolean;
  onAnswer: (value: boolean) => void;
};

/**
 * A binary task's control (FE Spec §3.3, §11): Yes and No are distinct in
 * *kind* — a tick and a flag — never two tints of the same button. A No must
 * never read as "done".
 */
export function YesNo({ answer, disabled = false, onAnswer }: YesNoProps) {
  const t = useT();

  const base =
    'min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-full border';
  const yesSelected = 'border-foreground bg-foreground shadow-card';
  const noSelected = 'border-destructive-soft-foreground bg-destructive-soft';
  const unselected = 'border-input-edge bg-card active:bg-accent';

  return (
    <View className="flex-row gap-2">
      <Button
        variant="outline"
        disabled={disabled}
        accessibilityLabel={t('run.yes')}
        accessibilityState={{ selected: answer === true }}
        onPress={() => onAnswer(true)}
        className={cn(
          base,
          answer === true ? yesSelected : unselected,
          answer === false && 'opacity-50',
        )}
      >
        <Check
          className={cn(
            'size-5',
            answer === true ? 'text-primary-foreground' : 'text-foreground',
          )}
          strokeWidth={2.5}
        />
        <Text
          className={cn(
            'font-sans-semibold',
            answer === true ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          {t('run.yes')}
        </Text>
      </Button>
      <Button
        variant="outline"
        disabled={disabled}
        accessibilityLabel={t('run.no')}
        accessibilityState={{ selected: answer === false }}
        onPress={() => onAnswer(false)}
        className={cn(
          base,
          answer === false ? noSelected : unselected,
          answer === true && 'opacity-50',
        )}
      >
        <Flag
          className={cn(
            'size-5',
            answer === false
              ? 'text-destructive-soft-foreground'
              : 'text-destructive-soft-foreground',
          )}
          strokeWidth={2.5}
        />
        <Text
          className={cn(
            'font-sans-semibold',
            answer === false
              ? 'text-destructive-soft-foreground'
              : 'text-foreground',
          )}
        >
          {t('run.no')}
        </Text>
      </Button>
    </View>
  );
}
