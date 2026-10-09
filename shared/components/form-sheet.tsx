import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

type FormSheetProps = {
  visible: boolean;
  title: string;
  /** Backdrop tap, Android back, and the Cancel button. */
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  /** Defaults to "Save". */
  submitLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** The form's fields; they scroll and sit 12pt apart. */
  children: React.ReactNode;
};

/** A bottom sheet form: title, scrolling fields, Save and Cancel. */
function FormSheet({
  visible,
  title,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitDisabled = false,
  submitLabel,
  cancelLabel,
  children,
}: FormSheetProps) {
  const t = useT();
  const theme = useAppliedTheme();

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onDismiss={onClose}
      footer={
        <View className="gap-2">
          <Button
            className="w-full"
            disabled={isSubmitting || submitDisabled}
            onPress={onSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator
                size="small"
                color={THEME[theme].primaryForeground}
              />
            ) : null}
            <Text>{submitLabel ?? t('admin.save')}</Text>
          </Button>
          <Button variant="outline" className="w-full" onPress={onClose}>
            <Text>{cancelLabel ?? t('admin.cancel')}</Text>
          </Button>
        </View>
      }
    >
      <ScrollView
        className="max-h-[430px]"
        contentContainerClassName="gap-3 px-0.5 pb-1"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

export { FormSheet };
export type { FormSheetProps };
