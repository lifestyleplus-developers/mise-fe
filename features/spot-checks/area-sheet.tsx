import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { FormSheet } from '@/shared/components/form-sheet';
import { SwitchRow } from '@/shared/components/switch-row';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import type { Area } from '@/shared/api/types';
import { format, useT } from '@/shared/i18n';
import { Archive } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { areaMessage, classifyAreaError } from './area-errors';
import { useCreateArea, useUpdateArea } from './use-areas';

type AreaSheetProps = {
  /** The area being edited; none to add one. */
  area?: Area;
  outletId: number;
  outletName: string;
  onClose: () => void;
  /** The platform refused the role (403) or the area is gone (404). */
  onLost: (kind: 'forbidden' | 'gone') => void;
};

/**
 * New area / Edit area (SPT-06): a name and whether it can be picked. Archiving is
 * here too, behind a confirm. A refused save keeps the sheet and what was typed.
 */
export function AreaSheet({
  area,
  outletId,
  outletName,
  onClose,
  onLost,
}: AreaSheetProps) {
  const t = useT();
  const isNew = area === undefined;
  const create = useCreateArea();
  const update = useUpdateArea(area?.id ?? 0);

  const [name, setName] = React.useState(area?.name ?? '');
  const [eligible, setEligible] = React.useState(area?.is_eligible ?? true);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const failure = error ? classifyAreaError(error) : null;
  const canSave = name.trim().length > 0;

  function reset() {
    create.reset();
    update.reset();
  }

  function fail(caught: unknown) {
    const kind = classifyAreaError(caught);
    if (kind === 'forbidden' || kind === 'gone') {
      onClose();
      onLost(kind);
    }
  }

  function save() {
    if (!canSave || pending) return;
    if (isNew) {
      create.mutate(
        { outlet_id: outletId, name: name.trim(), is_eligible: eligible },
        { onSuccess: () => onClose(), onError: fail },
      );
    } else {
      update.mutate(
        { name: name.trim(), is_eligible: eligible },
        { onSuccess: () => onClose(), onError: fail },
      );
    }
  }

  function archive() {
    setConfirmingArchive(false);
    // An archived area is no longer picked, so it is switched off with it.
    update.mutate(
      { is_archived: true, is_eligible: false },
      { onSuccess: () => onClose(), onError: fail },
    );
  }

  return (
    <>
      <FormSheet
        visible={!confirmingArchive}
        title={isNew ? t('spot.new-area') : area.name}
        onClose={onClose}
        onSubmit={save}
        isSubmitting={pending}
        submitDisabled={!canSave}
      >
        <TextField
          label={t('spot.name')}
          value={name}
          editable={!pending}
          aria-invalid={failure === 'duplicate'}
          className={failure === 'duplicate' ? 'border-destructive' : undefined}
          onChangeText={(value) => {
            setName(value.replace(/[\r\n]+/g, ' '));
            reset();
          }}
        />

        {failure === 'duplicate' ? (
          <Banner
            tone="error"
            message={format(t('spot.name-taken'), {
              outlet: outletName,
              name: name.trim(),
            })}
          />
        ) : failure === 'rejected' ? (
          <Banner tone="error" message={areaMessage(error) ?? ''} />
        ) : failure === 'failed' || failure === 'forbidden' ? (
          <Banner
            tone="error"
            message={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}

        <View className="border-border bg-card overflow-hidden rounded-2xl border">
          <SwitchRow
            label={t('spot.can-pick')}
            checked={eligible}
            disabled={pending}
            onChange={(next) => {
              setEligible(next);
              reset();
            }}
          />
        </View>

        {isNew ? null : (
          <Button
            variant="outline"
            disabled={pending}
            className="border-destructive/50 w-full"
            onPress={() => setConfirmingArchive(true)}
          >
            <Archive className="text-destructive-soft-foreground size-[18px]" />
            <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
              {t('spot.archive-area')}
            </Text>
          </Button>
        )}
      </FormSheet>

      <ConfirmDialog
        visible={confirmingArchive}
        icon={Archive}
        tone="warning"
        title={format(t('spot.archive-area-title'), { name: area?.name ?? '' })}
        body={t('spot.archive-area-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirmingArchive(false),
        }}
        other={{ label: t('spot.archive'), onPress: archive }}
      />
    </>
  );
}
