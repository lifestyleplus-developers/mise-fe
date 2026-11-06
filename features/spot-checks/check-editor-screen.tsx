import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { SpotCheck } from '@/shared/api/types';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DayOfMonthSheet } from '@/shared/components/day-of-month-sheet';
import { DiscardChangesDialog } from '@/shared/components/discard-changes-dialog';
import { PickerField } from '@/shared/components/picker-field';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Skeleton } from '@/shared/components/skeleton';
import { TimePickerSheet } from '@/shared/components/time-picker-sheet';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import { WeekdayChips } from '@/shared/components/weekday-chips';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Info, Plus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  canSaveCheck,
  CHECK_FREQUENCIES,
  EMPTY_CHECK_FORM,
  formFromCheck,
  liveRows,
  MAX_REVEAL_WINDOW,
  MIN_REVEAL_WINDOW,
  moveRow,
  newRowKey,
  normalizeCheckForm,
  stepWindow,
  toCheckRequest,
  withoutLists,
  type CheckForm,
  type DraftRow,
} from './check-form';
import {
  checkMessage,
  classifyCheckError,
  isListLocked,
  type CheckFailure,
} from './check-errors';
import { usePlatformLimit, usePlatformLimits } from './platform-limits';
import {
  CheckRowList,
  RowEditSheet,
  RowMenuSheet,
  type RowKind,
} from './check-rows';
import { Stepper } from './stepper';
import {
  useCreateSpotCheck,
  useSpotCheck,
  useUpdateSpotCheck,
} from './use-spot-checks';
import { useSpotCheckOutlets } from './use-spot-check-outlets';

/**
 * SPT-05's editor. With an `id` it edits that check; without, it writes a new one
 * for the outlet in `outlet`.
 */
export function CheckEditorScreen() {
  const { id, outlet } = useLocalSearchParams<{
    id?: string;
    outlet?: string;
  }>();
  if (id === undefined) {
    return <EditorForm check={null} outletId={Number(outlet)} />;
  }
  return <LoadedEditor id={Number(id)} />;
}

/** Loads the check, and says so when it cannot. */
function LoadedEditor({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const query = useSpotCheck(id);
  const outlets = useSpotCheckOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const failure = query.isError ? classifyCheckError(query.error) : null;
  const outletOff =
    query.data !== undefined &&
    !outlets.isPending &&
    !outlets.isError &&
    !outlets.outlets.some((o) => o.id === query.data!.outlet_id);
  const moduleOff =
    failure === 'gone' ||
    outletOff ||
    (!outlets.isPending && !outlets.isError && outlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.spot-checks-off'), {
        outlet:
          outlets.outlets.find((o) => o.id === query.data?.outlet_id)?.name ??
          '',
      }),
    );
    router.replace('/modules');
  }, [moduleOff, outlets.outlets, query.data, router, setModulesNotice, t]);

  if (query.data && !outletOff) {
    return (
      <EditorForm
        key={query.data.id}
        check={query.data}
        outletId={query.data.outlet_id}
      />
    );
  }

  return (
    <PushedScreen
      title=""
      eyebrow={t('spot.checks')}
      adminOnly
      backHref="/spot-checks/checks"
    >
      {failure === 'forbidden' ? (
        <View className="mx-4">
          <Banner tone="error" message={t('spot.forbidden-edit')} />
        </View>
      ) : failure === 'failed' ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="shadow-card border-border bg-card mx-4 gap-3 rounded-3xl border p-4"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11 w-2/3 self-end" />
          <Skeleton className="h-11 w-1/2 self-end" />
        </View>
      )}
    </PushedScreen>
  );
}

type RowSheet =
  | { kind: RowKind; step: 'menu'; row: DraftRow }
  | { kind: RowKind; step: 'edit'; row?: DraftRow }
  | { kind: RowKind; step: 'archive'; row: DraftRow }
  | null;

function EditorForm({
  check,
  outletId,
}: {
  check: SpotCheck | null;
  outletId: number;
}) {
  const t = useT();
  const theme = useAppliedTheme();
  const router = useRouter();
  const formatClock = useFormatClock();
  const outlets = useSpotCheckOutlets();

  const isNew = check === null;
  const archivedView = check?.is_archived ?? false;
  const initial = React.useMemo(
    () => (check ? formFromCheck(check) : EMPTY_CHECK_FORM),
    [check],
  );

  const [form, setForm] = React.useState<CheckForm>(initial);
  const [failure, setFailure] = React.useState<CheckFailure | null>(null);
  const [serverText, setServerText] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<RowSheet>(null);
  const [picker, setPicker] = React.useState<'time' | 'day' | null>(null);
  const [archivingCheck, setArchivingCheck] = React.useState(false);

  const create = useCreateSpotCheck();
  const update = useUpdateSpotCheck(check?.id ?? 0);
  // A platform that will not change the prompts or items of a check that exists
  // (SPT-05 `itemFallback`): they read as they are, and Save sends the rest.
  const listEditLimited = usePlatformLimit('listEdit');
  const learn = usePlatformLimits((state) => state.learn);
  const listsLocked = !isNew && listEditLimited;
  const saving = create.isPending || update.isPending;

  const guard = useUnsavedChanges({
    initial: normalizeCheckForm(initial),
    current: normalizeCheckForm(form),
    saving,
  });

  // A refused role makes the editor read-only; the check may also be gone.
  const locked = failure === 'forbidden' || failure === 'gone';
  const disabled = archivedView || locked || saving;
  const outletName = outlets.outlets.find((o) => o.id === outletId)?.name ?? '';
  const multiOutlet = outlets.outlets.length > 1;

  function edit(patch: Partial<CheckForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setFailure(null);
    setServerText(null);
  }

  function editRows(kind: RowKind, change: (rows: DraftRow[]) => DraftRow[]) {
    const field = kind === 'prompt' ? 'prompts' : 'items';
    setForm((current) => ({ ...current, [field]: change(current[field]) }));
    setFailure(null);
    setServerText(null);
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/spot-checks/checks');
  }

  function onError(error: unknown) {
    const kind = classifyCheckError(error);
    setFailure(kind);
    setServerText(kind === 'rejected' ? checkMessage(error) : null);
  }

  function save() {
    if (!canSaveCheck(form) || saving) return;
    const request = toCheckRequest(form);
    if (isNew) {
      create.mutate(
        { ...request, outlet_id: outletId },
        { onError, onSuccess: () => guard.leave(leave) },
      );
    } else if (listsLocked) {
      update.mutate(withoutLists(request), {
        onError,
        onSuccess: () => guard.leave(leave),
      });
    } else {
      update.mutate(request, {
        onError: (error) => {
          if (!isListLocked(error)) return onError(error);
          // Told the list cannot change: put it back as it was, keep every other
          // edit, and say so. Save then sends only what the platform will take.
          learn('listEdit');
          setForm((current) => ({
            ...current,
            prompts: initial.prompts,
            items: initial.items,
          }));
        },
        onSuccess: () => guard.leave(leave),
      });
    }
  }

  function archiveCheck() {
    setArchivingCheck(false);
    update.mutate(
      { is_archived: true },
      { onError, onSuccess: () => guard.leave(leave) },
    );
  }

  function saveRow(text: string, weight: number) {
    if (!sheet || sheet.step !== 'edit') return;
    const { kind, row } = sheet;
    editRows(kind, (rows) =>
      row
        ? rows.map((existing) =>
            existing.key === row.key
              ? {
                  ...existing,
                  text,
                  weight: kind === 'item' ? weight : existing.weight,
                }
              : existing,
          )
        : [
            ...rows,
            { key: newRowKey(), text, weight, archived: false, saved: false },
          ],
    );
    setSheet(null);
  }

  function move(direction: -1 | 1) {
    if (!sheet || sheet.step !== 'menu') return;
    const { kind, row } = sheet;
    editRows(kind, (rows) => moveRow(rows, row.key, direction));
    setSheet(null);
  }

  function archiveRow() {
    if (!sheet || sheet.step !== 'archive') return;
    const { kind, row } = sheet;
    editRows(kind, (rows) =>
      rows.map((existing) =>
        existing.key === row.key ? { ...existing, archived: true } : existing,
      ),
    );
    setSheet(null);
  }

  const title = check?.name ?? t('spot.new-check');
  const prompts = liveRows(form.prompts);
  const items = liveRows(form.items);
  const readOnly = archivedView || locked;

  const footer = readOnly ? undefined : (
    <Button
      className="w-full"
      disabled={saving || !canSaveCheck(form) || (!isNew && !guard.changed)}
      onPress={save}
    >
      {saving ? (
        <ActivityIndicator
          size="small"
          color={THEME[theme].primaryForeground}
        />
      ) : null}
      <Text>{t('admin.save')}</Text>
    </Button>
  );

  const subjectHint =
    form.subject === 'STAFF'
      ? format(t('spot.subject-staff'), { outlet: outletName })
      : t('spot.subject-area');

  return (
    <PushedScreen
      title={title}
      eyebrow={
        multiOutlet && outletName
          ? format(t('spot.eyebrow'), { outlet: outletName })
          : t('spot.checks')
      }
      adminOnly
      backHref="/spot-checks/checks"
      footer={footer}
    >
      <View className="gap-3 pb-3">
        {failure === 'forbidden' ? (
          <Notice tone="error" text={t('spot.forbidden-edit')} />
        ) : null}
        {failure === 'rejected' ? (
          <Notice
            tone="error"
            text={
              serverText ?? `${t('admin.save-failed')} ${t('common.offline')}`
            }
          />
        ) : null}
        {failure === 'failed' ? (
          <Notice
            tone="error"
            text={`${t('admin.save-failed')} ${t('common.offline')}`}
          />
        ) : null}
        {failure === 'gone' ? (
          <Notice tone="error" text={t('spot.forbidden-edit')} />
        ) : null}
        {!isNew && !readOnly ? (
          <View className="mx-4 flex-row items-start gap-2 px-1">
            <Info className="text-foreground mt-px size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[13px] leading-snug">
              {t('spot.apply-next')}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="shadow-card border-border bg-card mx-4 gap-5 rounded-3xl border p-4">
        <TextField
          label={t('spot.name')}
          placeholder={t('spot.name-ph')}
          value={form.name}
          editable={!disabled}
          onChangeText={(name) => edit({ name: name.replace(/[\r\n]+/g, ' ') })}
        />

        <View className="gap-2">
          <Text className="font-sans-semibold text-[13px]">
            {t('spot.subject')}
          </Text>
          {/* Chosen when the check is made, fixed after. */}
          <View
            pointerEvents={isNew && !disabled ? 'auto' : 'none'}
            className={isNew && !disabled ? undefined : 'opacity-60'}
          >
            <SegmentedControl
              label={t('spot.subject')}
              value={form.subject}
              options={[
                { value: 'STAFF', label: t('spot.staff') },
                { value: 'AREA', label: t('spot.area') },
              ]}
              onChange={(subject) => edit({ subject })}
            />
          </View>
          <Text className="px-1 text-[13px] leading-snug">
            {subjectHint}
            {form.subject === 'AREA' ? (
              <>
                {' '}
                <Text
                  accessibilityRole="link"
                  onPress={() => router.push('/spot-checks/areas')}
                  className="font-sans-semibold text-[13px] underline"
                >
                  {t('spot.areas')}
                </Text>
              </>
            ) : null}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-[13px]">
            {t('sched.how-often')}
          </Text>
          <View
            pointerEvents={disabled ? 'none' : 'auto'}
            className={disabled ? 'opacity-60' : undefined}
          >
            <SegmentedControl
              label={t('sched.how-often')}
              value={form.recurrence}
              options={CHECK_FREQUENCIES.map((value) => ({
                value,
                label: t(`sched.freq.${value}` as MessageKey),
              }))}
              onChange={(recurrence) => edit({ recurrence })}
            />
          </View>
        </View>

        {form.recurrence === 'WEEKLY' ? (
          <View className="gap-2">
            <Text className="font-sans-semibold text-[13px]">
              {t('sched.days')}
            </Text>
            <WeekdayChips
              label={t('sched.days')}
              value={form.weekdays}
              disabled={disabled}
              onChange={(weekdays) => edit({ weekdays })}
            />
          </View>
        ) : null}

        {form.recurrence === 'MONTHLY' ? (
          <PickerField
            label={t('sched.day-of-month')}
            value={format(t('picker.day-n'), { n: String(form.day) })}
            disabled={disabled}
            onPress={() => setPicker('day')}
          />
        ) : null}

        <View className="gap-1.5">
          <PickerField
            label={t('spot.sel-time')}
            value={form.start ? formatClock(form.start) : t('sched.choose')}
            disabled={disabled}
            onPress={() => setPicker('time')}
          />
          <Text className="px-1 text-[12px] leading-snug">
            {t('spot.sel-hint')}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="font-sans-semibold text-[13px]">
            {t('spot.window')}
          </Text>
          <Stepper
            display={format(t('spot.minutes'), { n: String(form.window) })}
            lessLabel={t('spot.shorter')}
            moreLabel={t('spot.longer')}
            disabled={disabled}
            lessDisabled={form.window <= MIN_REVEAL_WINDOW}
            moreDisabled={form.window >= MAX_REVEAL_WINDOW}
            onLess={() => edit({ window: stepWindow(form.window, -1) })}
            onMore={() => edit({ window: stepWindow(form.window, 1) })}
          />
          <Text className="px-1 text-[12px] leading-snug">
            {t('spot.window-hint')}
          </Text>
        </View>
      </View>

      {listsLocked ? (
        <Notice tone="notice" text={t('spot.item-fallback')} />
      ) : null}

      <Section
        title={t('spot.prompts')}
        hint={t('spot.prompts-hint')}
        addLabel={t('spot.add-prompt')}
        readOnly={disabled || listsLocked}
        onAdd={() => setSheet({ kind: 'prompt', step: 'edit' })}
      >
        <CheckRowList
          rows={prompts}
          kind="prompt"
          onMenu={
            disabled || listsLocked
              ? undefined
              : (row) => setSheet({ kind: 'prompt', step: 'menu', row })
          }
        />
      </Section>

      <Section
        title={t('spot.items')}
        hint={t('spot.items-hint')}
        addLabel={t('spot.add-item')}
        readOnly={disabled || listsLocked}
        onAdd={() => setSheet({ kind: 'item', step: 'edit' })}
      >
        <CheckRowList
          rows={items}
          kind="item"
          onMenu={
            disabled || listsLocked
              ? undefined
              : (row) => setSheet({ kind: 'item', step: 'menu', row })
          }
        />
      </Section>

      {!isNew && !readOnly ? (
        <View className="mx-4 mt-6">
          <Button
            variant="outline"
            disabled={saving}
            className="border-destructive/50 w-full"
            onPress={() => setArchivingCheck(true)}
          >
            <Archive className="text-destructive-soft-foreground size-[18px]" />
            <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
              {t('spot.archive-check')}
            </Text>
          </Button>
        </View>
      ) : null}

      <TimePickerSheet
        visible={picker === 'time'}
        title={t('spot.sel-time')}
        value={form.start || '14:00'}
        onClose={() => setPicker(null)}
        onConfirm={(start) => {
          setPicker(null);
          edit({ start });
        }}
      />
      <DayOfMonthSheet
        visible={picker === 'day'}
        title={t('sched.day-of-month')}
        value={form.day}
        onClose={() => setPicker(null)}
        onConfirm={(day) => {
          setPicker(null);
          edit({ day });
        }}
      />

      {sheet?.step === 'menu' ? (
        <RowMenuSheet
          title={sheet.row.text}
          onClose={() => setSheet(null)}
          onEdit={() =>
            setSheet({ kind: sheet.kind, step: 'edit', row: sheet.row })
          }
          onMoveUp={() => move(-1)}
          onMoveDown={() => move(1)}
          onArchive={() =>
            setSheet({ kind: sheet.kind, step: 'archive', row: sheet.row })
          }
        />
      ) : null}
      {sheet?.step === 'edit' ? (
        <RowEditSheet
          key={sheet.row?.key ?? 'new'}
          kind={sheet.kind}
          row={sheet.row}
          onClose={() => setSheet(null)}
          onSave={saveRow}
        />
      ) : null}

      <ConfirmDialog
        visible={sheet?.step === 'archive'}
        icon={Archive}
        tone="warning"
        title={format(t('spot.archive-item-title'), {
          name: sheet?.step === 'archive' ? sheet.row.text : '',
        })}
        body={t('spot.archive-item-body')}
        safe={{ label: t('admin.cancel'), onPress: () => setSheet(null) }}
        other={{ label: t('spot.archive'), onPress: archiveRow }}
      />
      <ConfirmDialog
        visible={archivingCheck}
        icon={Archive}
        tone="warning"
        title={format(t('spot.archive-title'), { name: check?.name ?? '' })}
        body={t('spot.archive-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setArchivingCheck(false),
        }}
        other={{ label: t('spot.archive'), onPress: archiveCheck }}
      />

      <DiscardChangesDialog
        visible={guard.discardOpen}
        onKeepEditing={guard.keepEditing}
        onDiscard={guard.discard}
      />
    </PushedScreen>
  );
}

/** A titled list with its hint and an Add button: one for prompts, one for items. */
function Section({
  title,
  hint,
  addLabel,
  readOnly,
  onAdd,
  children,
}: {
  title: string;
  hint: string;
  addLabel: string;
  readOnly: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="mx-4 mt-5">
      <Text
        accessibilityRole="header"
        className="font-display px-1 text-[20px] leading-tight"
      >
        {title}
      </Text>
      <Text className="mt-1 px-1 text-[13px] leading-snug">{hint}</Text>
      {children}
      {readOnly ? null : (
        <Button
          variant="outline"
          className="border-input-edge mt-2 w-full"
          onPress={onAdd}
        >
          <Plus className="text-foreground size-[18px]" />
          <Text>{addLabel}</Text>
        </Button>
      )}
    </View>
  );
}

function Notice({ tone, text }: { tone: 'error' | 'notice'; text: string }) {
  return (
    <View className="mx-4">
      <Banner tone={tone} message={text} />
    </View>
  );
}
