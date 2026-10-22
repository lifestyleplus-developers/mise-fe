import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useT } from '@/shared/i18n';
import { TriangleAlert } from 'lucide-react-native';

type DiscardChangesDialogProps = {
  visible: boolean;
  /** The safe way out: close the dialog and stay on the screen. */
  onKeepEditing: () => void;
  onDiscard: () => void;
};

/** "Discard changes?" for any editor that is left with unsaved work. */
function DiscardChangesDialog({
  visible,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const t = useT();
  return (
    <ConfirmDialog
      visible={visible}
      icon={TriangleAlert}
      tone="warning"
      title={t('discard.title')}
      body={t('discard.body')}
      safe={{ label: t('discard.keep'), onPress: onKeepEditing }}
      other={{ label: t('discard.confirm'), onPress: onDiscard }}
    />
  );
}

export { DiscardChangesDialog };
