import { ConfigManagers } from '@/features/attendance/config-managers';
import {
  classifyConfigError,
  configMessage,
  type ConfigFailure,
} from '@/features/attendance/config-errors';
import {
  CONFIG_FREQUENCIES,
  EMPTY_FORM,
  formFromConfig,
  normalizeForm,
  toConfigRequest,
  type ScheduleForm,
} from '@/features/attendance/config-form';
import { useConfigText } from '@/features/attendance/config-text';
import {
  useAttendanceConfig,
  useCreateAttendanceConfig,
  useUpdateAttendanceConfig,
} from '@/features/attendance/use-attendance-configs';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { ScheduleFields } from '@/features/checklist-editor/schedule-fields';
import {
  checkForm,
  hasProblems,
  withValidLastRun,
} from '@/features/checklist-editor/schedule-form';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import type { AttendanceConfig } from '@/shared/api/types';
import { DiscardChangesDialog } from '@/shared/components/discard-changes-dialog';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { useUnsavedChanges } from '@/shared/lib/use-unsaved-changes';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * ATT-04's editor. With an `id` it edits that configuration; without, it writes a
 * new one for the outlet in `outlet`.
 */
export function ConfigEditorScreen() {
  const { id, outlet, appoint } = useLocalSearchParams<{
    id?: string;
    outlet?: string;
    appoint?: string;
  }>();
  if (id === undefined) {
    return <EditorForm config={null} outletId={Number(outlet)} />;
  }
  return <LoadedEditor id={Number(id)} openPicker={appoint === '1'} />;
}

/** Loads the configuration, and says so when it cannot. */
function LoadedEditor({ id, openPicker }: { id: number; openPicker: boolean }) {
  const t = useT();
  const router = useRouter();
  const query = useAttendanceConfig(id);
  const outlets = useAttendanceOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const failure = query.isError ? classifyConfigError(query.error) : null;
  // The list loaded without it: gone, or its outlet no longer runs attendance.
  const missing = query.isSuccess && !query.config;
  const outletOff =
    query.config !== undefined &&
    !outlets.isPending &&
    !outlets.isError &&
    !outlets.outlets.some((o) => o.id === query.config!.outlet_id);
  const moduleOff =
    failure === 'gone' ||
    outletOff ||
    (!outlets.isPending &&
      !outlets.isError &&
      outlets.outlets.length === 0 &&
      query.isSuccess);

  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.attendance-off'), {
        outlet:
          outlets.outlets.find((o) => o.id === query.config?.outlet_id)?.name ??
          '',
      }),
    );
    router.replace('/modules');
  }, [moduleOff, outlets.outlets, query.config, router, setModulesNotice, t]);

  if (query.config && !outletOff) {
    return (
      <EditorForm
        key={query.config.id}
        config={query.config}
        outletId={query.config.outlet_id}
        openPicker={openPicker}
      />
    );
  }

  return (
    <PushedScreen
      title=""
      eyebrow={t('modules.attendance')}
      adminOnly
      backHref="/attendance/configs"
    >
      {failure === 'forbidden' ? (
        <View className="mx-4">
          <Banner tone="error" message={t('cfg.forbidden')} />
        </View>
      ) : missing ? (
        <View className="mx-4">
          <Banner tone="error" message={t('cfg.gone')} />
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

function EditorForm({
  config,
  outletId,
  openPicker = false,
}: {
  config: AttendanceConfig | null;
  outletId: number;
  openPicker?: boolean;
}) {
  const t = useT();
  const theme = useAppliedTheme();
  const router = useRouter();
  const text = useConfigText();
  const outlets = useAttendanceOutlets();

  const isNew = config === null;
  const id = config?.id ?? 0;
  const initial = config ? formFromConfig(config) : EMPTY_FORM;
  const archivedView = config?.is_archived ?? false;

  const [form, setForm] = React.useState<ScheduleForm>(initial);
  const [submitted, setSubmitted] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const [failure, setFailure] = React.useState<ConfigFailure | null>(null);
  const [serverText, setServerText] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const create = useCreateAttendanceConfig();
  const update = useUpdateAttendanceConfig(id);
  const saving = create.isPending || update.isPending;

  const guard = useUnsavedChanges({
    initial: normalizeForm(initial),
    current: normalizeForm(form),
    saving,
  });

  // A refused role makes the editor read-only; the configuration may also be gone.
  const locked = failure === 'forbidden' || failure === 'gone';
  const disabled = archivedView || locked || saving;
  const outletName = outlets.outlets.find((o) => o.id === outletId)?.name;
  const multiOutlet = outlets.outlets.length > 1;

  function edit(patch: Partial<ScheduleForm>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      return 'start' in patch || 'recurrence' in patch
        ? withValidLastRun(next)
        : next;
    });
    setNotice(null);
    setFailure(null);
    setServerText(null);
    setConflict(false);
  }

  function save() {
    if (hasProblems(checkForm(form))) {
      setSubmitted(true);
      return;
    }
    const request = toConfigRequest(form);
    const onError = (error: unknown) => {
      const kind = classifyConfigError(error);
      if (kind === 'overlap') setConflict(true);
      else {
        setFailure(kind);
        setServerText(kind === 'rejected' ? configMessage(error) : null);
      }
    };
    if (isNew) {
      create.mutate(
        { ...request, outlet_id: outletId },
        {
          onError,
          // Straight on to appointing a manager: nobody can mark it without one.
          onSuccess: (created) =>
            guard.leave(() =>
              router.replace({
                pathname: '/attendance/configs/[id]',
                params: { id: created.id, appoint: '1' },
              }),
            ),
        },
      );
    } else {
      update.mutate(request, {
        onError,
        onSuccess: (saved) => {
          setForm(formFromConfig(saved));
          setNotice(t('cfg.saved'));
        },
      });
    }
  }

  const title = isNew ? t('cfg.new') : config ? text.title(config) : '';

  const footer =
    locked || archivedView ? undefined : (
      <Button
        className="w-full"
        disabled={saving || (!isNew && !guard.changed)}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator
            size="small"
            color={THEME[theme].primaryForeground}
          />
        ) : null}
        <Text>{t(isNew ? 'cfg.save-add-manager' : 'admin.save')}</Text>
      </Button>
    );

  return (
    <PushedScreen
      title={title}
      eyebrow={
        multiOutlet && outletName
          ? `${t('modules.attendance')} · ${outletName}`
          : t('modules.attendance')
      }
      adminOnly
      backHref="/attendance/configs"
      footer={footer}
    >
      <View className="gap-3 pb-3">
        {failure === 'forbidden' ? (
          <Notice tone="error" text={t('cfg.forbidden')} />
        ) : null}
        {failure === 'gone' ? (
          <Notice tone="error" text={t('cfg.gone')} />
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
        {notice ? <Notice tone="notice" text={notice} /> : null}
        {!isNew && !archivedView ? (
          <View className="mx-4 flex-row items-start gap-2 px-1">
            <Info className="text-foreground mt-px size-4 shrink-0" />
            <Text className="min-w-0 flex-1 text-[13px] leading-snug">
              {t('cfg.edits-apply')}
            </Text>
          </View>
        ) : null}
      </View>

      <ScheduleFields
        form={form}
        onChange={edit}
        submitted={submitted}
        conflict={conflict}
        disabled={disabled}
        frequencies={CONFIG_FREQUENCIES}
        namePlaceholder={t('cfg.name-ph')}
        rhythmHint={t('cfg.rhythm-hint')}
        afterName={
          <View className="gap-2">
            <Text className="font-sans-semibold text-[13px]">
              {t('cfg.method')}
            </Text>
            {/* One method in this release; kept a selector for the next. */}
            <SegmentedControl
              label={t('cfg.method')}
              value="MANUAL"
              options={[{ value: 'MANUAL', label: t('cfg.manual') }]}
              onChange={() => undefined}
            />
          </View>
        }
      />

      {config ? (
        <ConfigManagers
          config={config}
          disabled={archivedView || locked}
          openPicker={openPicker}
          onNotice={setNotice}
          onLocked={(kind) => setFailure(kind)}
        />
      ) : null}

      <DiscardChangesDialog
        visible={guard.discardOpen}
        onKeepEditing={guard.keepEditing}
        onDiscard={guard.discard}
      />
    </PushedScreen>
  );
}

function Notice({ tone, text }: { tone: 'error' | 'notice'; text: string }) {
  return (
    <View className="mx-4">
      <Banner tone={tone} message={text} />
    </View>
  );
}
