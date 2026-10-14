import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CommentSheetProps = {
  visible: boolean;
  /** The task text as the sheet's title, exactly as authored. */
  title: string;
  /** Any answer already written that failed and now wants a comment. */
  initialValue: string;
  /** Who it is being given by, shown as part of the header. */
  context?: string;
  onClose: () => void;
  onSave: (comment: string) => void;
};

/**
 * The comment sheet (bundle: commentSheet, commentSheetTyping, long, reading).
 * Save is disabled until there is text. The sheet is a Modal so the keyboard
 * can stay with it; it scrolls inside for a three-line Malayalam task.
 */
export function CommentSheet({
  visible,
  title,
  initialValue,
  context,
  onClose,
  onSave,
}: CommentSheetProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState(initialValue);

  const canSave = draft.trim() !== '';

  return (
    <Modal
      // The key remounts the draft each time the sheet opens for a different
      // task, so the input always starts from `initialValue` without an effect.
      key={`${visible ? 'open' : 'closed'}:${title}:${initialValue}`}
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('run.comment-cancel')}
          onPress={onClose}
          className="flex-1 bg-black/30"
        />
        <View
          className="bg-background rounded-t-3xl px-4 pb-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <View className="bg-muted mx-auto mt-2 h-1.5 w-10 rounded-full" />
          {context ? (
            <Text className="text-muted-foreground mt-3 text-[13px]">
              {context}
            </Text>
          ) : null}
          <Text
            variant="h3"
            className="mt-1 text-left text-[20px] leading-snug"
          >
            {title}
          </Text>
          <Input
            className="mt-3"
            multiline
            numberOfLines={3}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('run.comment-placeholder')}
            autoFocus
            accessibilityLabel={t('run.comment-title')}
          />
          <View className="mt-3 flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Text>{t('run.comment-cancel')}</Text>
            </Button>
            <Button
              className="flex-1"
              disabled={!canSave}
              onPress={() => onSave(draft.trim())}
            >
              <Text>{t('run.comment-save')}</Text>
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
