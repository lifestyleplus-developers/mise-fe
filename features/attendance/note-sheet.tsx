import type { AttendanceMark } from '@/shared/api/types';
import { FormSheet } from '@/shared/components/form-sheet';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { Info } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type NoteSheetProps = {
  mark: AttendanceMark;
  onSave: (note: string) => void;
  onClose: () => void;
};

/**
 * A note on someone's mark. Once saved it cannot be changed, so that nothing is
 * overwritten: the sheet then only shows it and who wrote it.
 */
function NoteSheet({ mark, onSave, onClose }: NoteSheetProps) {
  const t = useT();
  const formatClock = useFormatClock();
  const [note, setNote] = React.useState('');

  if (mark.note) {
    return (
      <BottomSheet
        visible
        title={mark.staff.full_name}
        onDismiss={onClose}
        footer={
          <Button className="w-full" onPress={onClose}>
            <Text>{t('att.close')}</Text>
          </Button>
        }
      >
        <View className="gap-3 px-1">
          <View>
            <Text className="text-[15px] leading-snug">{mark.note}</Text>
            {mark.marked_by && mark.marked_at ? (
              <Text className="text-muted-foreground mt-1 text-[13px]">
                {`${mark.marked_by.full_name} ${formatClock(isoToClock(mark.marked_at))}`}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-start gap-2">
            <Info className="text-foreground mt-px size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[13px] leading-snug">
              {t('att.note-read-only')}
            </Text>
          </View>
        </View>
      </BottomSheet>
    );
  }

  return (
    <FormSheet
      visible
      title={mark.staff.full_name}
      onClose={onClose}
      onSubmit={() => onSave(note.trim())}
      submitDisabled={!note.trim()}
    >
      <TextField
        label={t('att.note-field')}
        value={note}
        onChangeText={(value) => setNote(value.replace(/[\r\n]+/g, ' '))}
        autoFocus
        maxLength={500}
      />
    </FormSheet>
  );
}

export { NoteSheet };
