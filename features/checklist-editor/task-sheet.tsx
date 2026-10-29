import {
  DEFAULT_WEIGHT,
  canFail,
  checkTaskForm,
  cleanLimitInput,
  flipSign,
  hasTaskProblems,
  parseLimit,
  showNumber,
  type AnswerType,
  type TaskForm,
} from '@/features/checklist-editor/task-form';
import { DiscardChangesDialog } from '@/shared/components/discard-changes-dialog';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { ChevronRight, Info, Minus, Plus } from 'lucide-react-native';
import { TYPE_ICON } from '@/features/checklist-editor/task-type-icon';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

const TYPES: readonly AnswerType[] = ['BINARY', 'NUMBER', 'IMAGE'];

type TaskSheetProps = {
  visible: boolean;
  mode: 'new' | 'edit';
  /** What the sheet starts from each time it opens. */
  initial: TaskForm;
  /** The checklist runs somewhere, so an edit reaches new runs. */
  assigned: boolean;
  saving: boolean;
  /** The save did not reach the platform. */
  failed: boolean;
  /** The platform refused the text. */
  textRejected: boolean;
  /** Anything was changed: clears `failed` and `textRejected`. */
  onEdited: () => void;
  onSubmit: (form: TaskForm) => void;
  onClose: () => void;
};

/** Adds a task, or edits one (its type is fixed once it exists). */
function TaskSheet({
  visible,
  mode,
  initial,
  assigned,
  saving,
  failed,
  textRejected,
  onEdited,
  onSubmit,
  onClose,
}: TaskSheetProps) {
  const t = useT();
  const theme = useAppliedTheme();
  const [form, setForm] = React.useState<TaskForm>(initial);
  const [submitted, setSubmitted] = React.useState(false);
  const [weightOpen, setWeightOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [wasVisible, setWasVisible] = React.useState(visible);

  // Each time it opens it starts from the task, or blank.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setForm(initial);
      setSubmitted(false);
      setWeightOpen(false);
      setDiscardOpen(false);
    }
  }

  const editing = mode === 'edit';
  const problems = checkTaskForm(form);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);

  function change(patch: Partial<TaskForm>) {
    setForm((current) => ({ ...current, ...patch }));
    onEdited();
  }

  function submit() {
    if (hasTaskProblems(problems)) {
      setSubmitted(true);
      return;
    }
    onSubmit(form);
  }

  function close() {
    if (changed) setDiscardOpen(true);
    else onClose();
  }

  const min = problems.badMin ? null : parseLimit(form.min);
  const max = problems.badMax ? null : parseLimit(form.max);
  const unit = form.unit.trim() ? ` ${form.unit.trim()}` : '';
  const limitsInvalid = submitted && (problems.badMin || problems.badMax);
  const outcomeLine = limitsInvalid
    ? null
    : min === null && max === null
      ? t('task.log-only')
      : problems.bounds
        ? null
        : min === null
          ? format(t('task.fails-above'), { max: showNumber(max), unit })
          : max === null
            ? format(t('task.fails-below'), { min: showNumber(min), unit })
            : format(t('task.fails-outside'), {
                min: showNumber(min),
                max: showNumber(max),
                unit,
              });

  const textLabel =
    form.type === 'BINARY'
      ? t('task.statement')
      : form.type === 'NUMBER'
        ? t('task.prompt')
        : t('task.photo-text');
  const textPlaceholder =
    form.type === 'BINARY'
      ? t('task.statement-placeholder')
      : form.type === 'NUMBER'
        ? t('task.prompt-placeholder')
        : t('task.photo-placeholder');

  const TypeIcon = form.type ? TYPE_ICON[form.type] : null;

  return (
    <BottomSheet
      visible={visible}
      title={t(editing ? 'task.edit-title' : 'task.new')}
      onDismiss={saving ? () => {} : close}
      footer={
        <View className="gap-2">
          {failed ? (
            <Banner
              tone="error"
              message={`${t('admin.save-failed')} ${t('common.offline')}`}
            />
          ) : null}
          <Button
            className="w-full"
            disabled={saving || (editing && !changed)}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={THEME[theme].primaryForeground}
              />
            ) : null}
            <Text>{t(editing ? 'admin.save' : 'task.add')}</Text>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={saving}
            onPress={close}
          >
            <Text>{t('admin.cancel')}</Text>
          </Button>
        </View>
      }
    >
      <ScrollView
        className="max-h-[430px]"
        contentContainerClassName="gap-4 px-0.5 pb-1"
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <>
            {assigned ? <InfoLine text={t('sched.edits-apply')} /> : null}
            <View className="border-border bg-muted rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                {TypeIcon ? (
                  <TypeIcon className="text-foreground size-4" />
                ) : null}
                <Text className="font-sans-semibold text-[15px]">
                  {format(t('task.fixed-type'), {
                    type: form.type
                      ? t(`task.type.${form.type}` as MessageKey)
                      : '',
                  })}
                </Text>
              </View>
              <Text className="mt-1 text-[13px] leading-snug">
                {t('task.fixed-hint')}
              </Text>
            </View>
          </>
        ) : (
          <View className="gap-2">
            <Text className="font-sans-semibold text-[13px]">
              {t('task.answer-type')}
            </Text>
            <SegmentedControl
              label={t('task.answer-type')}
              value={form.type ?? ('' as AnswerType)}
              options={TYPES.map((value) => ({
                value,
                label: t(`task.type.${value}` as MessageKey),
              }))}
              onChange={(type) => change({ type })}
            />
            {submitted && problems.type ? (
              <ErrorText>{t('task.choose-type')}</ErrorText>
            ) : null}
          </View>
        )}

        {form.type ? (
          <>
            <View className="gap-1">
              <TextField
                label={textLabel}
                placeholder={textPlaceholder}
                value={form.text}
                editable={!saving}
                multiline
                aria-invalid={(submitted && problems.text) || textRejected}
                className="h-auto min-h-12 py-3"
                onChangeText={(text) =>
                  change({ text: text.replace(/[\r\n]+/g, ' ') })
                }
              />
              {submitted && problems.text ? (
                <ErrorText>{t('sched.required')}</ErrorText>
              ) : null}
              {textRejected ? (
                <ErrorText>{t('task.server-error')}</ErrorText>
              ) : null}
              {form.type === 'BINARY' ? (
                <Text className="px-1 text-[13px] leading-snug">
                  {t('task.statement-hint')}
                </Text>
              ) : null}
            </View>

            {form.type === 'NUMBER' ? (
              <>
                <TextField
                  label={t('task.unit')}
                  placeholder={t('task.unit-placeholder')}
                  value={form.unit}
                  editable={!saving}
                  autoCapitalize="none"
                  onChangeText={(unit) =>
                    change({ unit: unit.replace(/[\r\n]+/g, ' ') })
                  }
                />
                <View className="gap-1">
                  <View className="flex-row gap-3">
                    <LimitField
                      label={t('task.lowest')}
                      value={form.min}
                      invalid={
                        problems.bounds || (submitted && problems.badMin)
                      }
                      disabled={saving}
                      signLabel={format(t('task.sign'), {
                        field: t('task.lowest'),
                      })}
                      onChange={(next) => change({ min: next })}
                    />
                    <LimitField
                      label={t('task.highest')}
                      value={form.max}
                      invalid={
                        problems.bounds || (submitted && problems.badMax)
                      }
                      disabled={saving}
                      signLabel={format(t('task.sign'), {
                        field: t('task.highest'),
                      })}
                      onChange={(next) => change({ max: next })}
                    />
                  </View>
                  {submitted && (problems.badMin || problems.badMax) ? (
                    <ErrorText>{t('task.not-number')}</ErrorText>
                  ) : null}
                  {problems.bounds ? (
                    <ErrorText>{t('task.bounds-error')}</ErrorText>
                  ) : null}
                  {outcomeLine ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      className="px-1 text-[13px] leading-snug"
                    >
                      {outcomeLine}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : null}

            {canFail(form) ? (
              <Text className="px-1 text-[13px] leading-snug">
                {t('task.comment-always')}
              </Text>
            ) : null}

            <View className="border-input-edge rounded-2xl border">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: weightOpen, disabled: saving }}
                disabled={saving}
                onPress={() => setWeightOpen((open) => !open)}
                className="active:bg-accent min-h-12 flex-row items-center justify-between gap-3 rounded-2xl px-4"
              >
                <Text className="font-sans-medium min-w-0 flex-1 text-[15px]">
                  {format(
                    t(
                      form.weight === DEFAULT_WEIGHT
                        ? 'task.weight-std'
                        : 'task.weight-val',
                    ),
                    { n: String(form.weight) },
                  )}
                </Text>
                <ChevronRight
                  className={cn(
                    'text-muted-foreground size-5',
                    weightOpen && 'rotate-90',
                  )}
                />
              </Pressable>
              {weightOpen ? (
                <View className="border-border border-t px-4 py-3">
                  <View
                    accessibilityRole="adjustable"
                    accessibilityLabel={t('task.weight')}
                    className="flex-row items-center justify-center gap-4"
                  >
                    <StepButton
                      icon={Minus}
                      label={t('task.less')}
                      disabled={saving || form.weight <= 1}
                      onPress={() => change({ weight: form.weight - 1 })}
                    />
                    <Text
                      accessibilityLiveRegion="polite"
                      className="font-sans-semibold w-10 text-center text-[22px]"
                    >
                      {form.weight}
                    </Text>
                    <StepButton
                      icon={Plus}
                      label={t('task.more-weight')}
                      disabled={saving || form.weight >= 10}
                      onPress={() => change({ weight: form.weight + 1 })}
                    />
                  </View>
                  <Text className="mt-2 text-center text-[13px]">
                    {t('task.weight-hint')}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <DiscardChangesDialog
        visible={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="alert"
      className="text-destructive-soft-foreground px-1 text-[13px] font-medium"
    >
      {children}
    </Text>
  );
}

function InfoLine({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2 px-1">
      <Info className="text-foreground mt-px size-4 shrink-0" />
      <Text className="min-w-0 flex-1 text-[13px] leading-snug">{text}</Text>
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'border-input-edge bg-card size-11 items-center justify-center rounded-full border',
        disabled ? 'opacity-40' : 'active:bg-accent',
      )}
    >
      <Icon className="text-foreground size-5" />
    </Pressable>
  );
}

type LimitFieldProps = {
  label: string;
  value: string;
  invalid: boolean;
  disabled: boolean;
  signLabel: string;
  onChange: (value: string) => void;
};

/** A reading's limit: numbers only, with a button for the minus sign. */
function LimitField({
  label,
  value,
  invalid,
  disabled,
  signLabel,
  onChange,
}: LimitFieldProps) {
  return (
    <View className="min-w-0 flex-1 flex-row items-end gap-1.5">
      <TextField
        label={label}
        value={showNumber(value)}
        editable={!disabled}
        keyboardType="decimal-pad"
        aria-invalid={invalid}
        containerClassName="min-w-0 flex-1"
        onChangeText={(next) => onChange(cleanLimitInput(next))}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signLabel}
        accessibilityState={{ checked: value.startsWith('-'), disabled }}
        disabled={disabled}
        onPress={() => onChange(flipSign(value))}
        className={cn(
          'border-input-edge bg-card mb-0.5 size-11 shrink-0 items-center justify-center rounded-2xl border',
          disabled ? 'opacity-60' : 'active:bg-accent',
        )}
      >
        <Text className="font-sans-semibold text-[16px]">±</Text>
      </Pressable>
    </View>
  );
}

export { TaskSheet };
export type { TaskSheetProps };
