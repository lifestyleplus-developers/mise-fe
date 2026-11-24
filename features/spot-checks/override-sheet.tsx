import { FormSheet } from '@/shared/components/form-sheet';
import { OptionList } from '@/shared/components/option-list';
import { Banner } from '@/shared/components/ui/banner';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import type { SpotCheckOutcome, SpotCheckResult } from '@/shared/api/types';
import { useT } from '@/shared/i18n';
import * as React from 'react';
import { View } from 'react-native';

import { classifyOverrideError, overrideMessage } from './results-errors';
import { useOverrideSpotCheckResult } from './use-spot-check-runs';

type OverridableOutcome = Exclude<SpotCheckOutcome, 'PENDING_JUDGEMENT'>;
const OUTCOMES: OverridableOutcome[] = ['PASS', 'FAIL', 'NEEDS_REVIEW'];

type OverrideSheetProps = {
  runId: number;
  /** The result being overridden; none to keep the sheet closed. */
  result: SpotCheckResult | null;
  onClose: () => void;
};

/** What the picker starts on: the existing override, or the assessment's own answer. */
function startingOutcome(result: SpotCheckResult): OverridableOutcome {
  if (result.overridden_to && result.overridden_to !== 'PENDING_JUDGEMENT') {
    return result.overridden_to;
  }
  return result.outcome === 'PENDING_JUDGEMENT' ? 'PASS' : result.outcome;
}

/**
 * Keyed by the caller on the result's id, so a new result remounts this with a
 * fresh draft instead of carrying over the last one's.
 */
export function OverrideSheet({ runId, result, onClose }: OverrideSheetProps) {
  const t = useT();
  const override = useOverrideSpotCheckResult(runId);
  const [to, setTo] = React.useState<OverridableOutcome>(() =>
    result ? startingOutcome(result) : 'PASS',
  );
  const [note, setNote] = React.useState(() => result?.override_note ?? '');

  const canSave = note.trim().length > 0 && !override.isPending;
  const failure = override.error ? classifyOverrideError(override.error) : null;

  function close() {
    override.reset();
    onClose();
  }

  function save() {
    if (!result || note.trim().length === 0) return;
    override.mutate(
      {
        resultId: result.id,
        request: { overridden_to: to, override_note: note.trim() },
      },
      { onSuccess: close },
    );
  }

  return (
    <FormSheet
      visible={result !== null}
      title={result?.assertion_text ?? ''}
      onClose={close}
      onSubmit={save}
      isSubmitting={override.isPending}
      submitDisabled={!canSave}
      submitLabel={t('spot.override')}
    >
      <View className="gap-2">
        <Text className="font-sans-semibold text-[14px] leading-snug">
          {t('spot.override-to')}
        </Text>
        <OptionList
          value={to}
          onChange={(value) => {
            setTo(value);
            override.reset();
          }}
          options={OUTCOMES.map((outcome) => ({
            value: outcome,
            label: t(
              outcome === 'PASS'
                ? 'spot.passed'
                : outcome === 'FAIL'
                  ? 'spot.failed'
                  : 'spot.review',
            ),
          }))}
        />
      </View>

      <View className="gap-2">
        <Text className="font-sans-semibold text-[14px] leading-snug">
          {t('spot.note-label')}
        </Text>
        <Input
          multiline
          numberOfLines={3}
          value={note}
          editable={!override.isPending}
          placeholder={t('spot.note-placeholder')}
          onChangeText={(value) => {
            setNote(value);
            override.reset();
          }}
        />
        {note.trim().length === 0 ? (
          <Text className="text-muted-foreground text-[13px] leading-snug">
            {t('spot.note-missing')}
          </Text>
        ) : null}
      </View>

      {failure === 'refused' || failure === 'rejected' ? (
        <Banner tone="error" message={overrideMessage(override.error) ?? ''} />
      ) : failure === 'failed' ? (
        <Banner
          tone="error"
          message={`${t('admin.save-failed')} ${t('common.offline')}`}
        />
      ) : null}
    </FormSheet>
  );
}
