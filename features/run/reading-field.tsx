import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

type ReadingFieldProps = {
  /** The numeric answer as text, kept as the user typed it ('-15', '4..5'). */
  draft: string;
  /** "°C" — shown as a suffix, per the answer type's spec. */
  unit: string | null;
  /** The bound shown beside the label, e.g. "max −18 °C". */
  limit?: string;
  /** A client-side problem ('Enter a number') or a server message. */
  error?: string;
  disabled?: boolean;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
};

/** A digit, minus, dot, comma (as a decimal mark) or the spaces around them. */
const NUMERIC = /^-?\d+([.,]\d+)?$/;

/** '4..5' → null; '-15' → -15; '−15' (typographic) → -15. */
export function parseReading(text: string): number | null {
  const normalised = text.trim().replace('−', '-').replace(',', '.');
  return NUMERIC.test(normalised) ? Number(normalised) : null;
}

/**
 * A number task's control (FE Spec §3.3, §5): a numeric input with the unit
 * as a suffix. Out-of-bounds is a valid answer that fails — never blocked.
 * 'Not a number' is the only client-side rejection, shown inline under the
 * field (bundle: notANumber).
 */
export function ReadingField({
  draft,
  unit,
  limit,
  error,
  disabled = false,
  onDraftChange,
  onSubmit,
}: ReadingFieldProps) {
  const t = useT();
  const invalid = draft.trim() !== '' && parseReading(draft) === null;

  return (
    <View className="mt-1 gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        {limit ? (
          <Text className="text-muted-foreground text-[13px]">{limit}</Text>
        ) : (
          <View />
        )}
        {invalid ? (
          <Text className="font-sans-semibold text-[13px] text-destructive-soft-foreground">
            {t('run.enter-number')}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center">
        <Input
          className={cn(
            'min-h-11 flex-1',
            invalid &&
              'border-destructive-soft-foreground focus:border-destructive-soft-foreground focus:ring-destructive-soft-foreground',
          )}
          value={draft}
          onChangeText={onDraftChange}
          onSubmitEditing={onSubmit}
          onBlur={onSubmit}
          keyboardType="numbers-and-punctuation"
          inputMode="decimal"
          returnKeyType="done"
          editable={!disabled}
          aria-invalid={invalid}
          accessibilityLabel={limit ?? t('run.answer')}
        />
        {unit ? (
          <Text className="text-muted-foreground ml-2 min-w-8 text-[15px] text-right">
            {unit}
          </Text>
        ) : null}
      </View>
      {error && !invalid ? (
        <Text className="font-sans-medium text-[13px] text-destructive-soft-foreground">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
