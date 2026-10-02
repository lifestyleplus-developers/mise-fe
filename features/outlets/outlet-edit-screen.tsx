import { ArchivedBadge } from '@/features/outlets/archived-badge';
import {
  classifySaveError,
  isForbidden,
} from '@/features/outlets/outlet-errors';
import {
  useOutletNotice,
  useOutletNoticeText,
} from '@/features/outlets/outlet-notice';
import {
  useArchiveOutlet,
  useOutlet,
  useUpdateOutlet,
} from '@/features/outlets/use-outlets';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { SwitchRow } from '@/shared/components/switch-row';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { TextField } from '@/shared/components/ui/text-field';
import type { Outlet } from '@/shared/api/types';
import { format, useT } from '@/shared/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const CARD = 'shadow-card border-border bg-card mx-4 rounded-3xl border';

/** Outlet edit (ADM-01): rename, attendance switch, archive. */
export function OutletEditScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const {
    data: outlet,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOutlet(Number(rawId));

  const forbidden = isError && isForbidden(error);

  return (
    <PushedScreen
      title={outlet?.name ?? t('more.outlets')}
      adminOnly
      backHref="/outlets"
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
    >
      {forbidden ? (
        <View className="mx-4">
          <Banner tone="error" message={t('admin.no-access')} />
        </View>
      ) : (
        <>
          {isError ? (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
              retrying={isRefetching}
            />
          ) : null}
          {!outlet ? (
            isError ? null : (
              <EditSkeleton />
            )
          ) : outlet.is_archived ? (
            <ArchivedView outlet={outlet} />
          ) : (
            <OutletForm key={outlet.id} outlet={outlet} />
          )}
        </>
      )}
    </PushedScreen>
  );
}

function EditSkeleton() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`${CARD} gap-3 p-4`}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-12 rounded-2xl" />
      <Skeleton className="h-11" />
    </View>
  );
}

function ArchivedView({ outlet }: { outlet: Outlet }) {
  const t = useT();
  return (
    <View className={`${CARD} gap-3 p-4`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-sans-semibold text-[13px]">
          {t('outlets.name')}
        </Text>
        <ArchivedBadge />
      </View>
      <Text className="bg-muted rounded-2xl px-4 py-3 text-[15px]">
        {outlet.name}
      </Text>
      <Text className="px-1 text-[13px]">{t('outlets.archived-note')}</Text>
    </View>
  );
}

function OutletForm({ outlet }: { outlet: Outlet }) {
  const t = useT();
  const router = useRouter();
  const rename = useUpdateOutlet(outlet.id);
  const attendance = useUpdateOutlet(outlet.id);
  const archive = useArchiveOutlet(outlet.id);
  const notice = useOutletNotice((state) => state.notice);
  const noticeText = useOutletNoticeText();
  const setNotice = useOutletNotice((state) => state.setNotice);
  const clearNotice = useOutletNotice((state) => state.clearNotice);
  const [name, setName] = React.useState(outlet.name);
  const [confirming, setConfirming] = React.useState(false);

  const trimmed = name.trim();
  const renameFailure = rename.isError ? classifySaveError(rename.error) : null;
  const failedText = `${t('admin.save-failed')} ${t('common.offline')}`;

  const attendanceOn = attendance.isPending
    ? Boolean(attendance.variables?.attendance_enabled)
    : outlet.attendance_enabled;

  function saveName() {
    if (!trimmed || trimmed === outlet.name || rename.isPending) return;
    rename.mutate(
      { name: trimmed },
      { onSuccess: () => setNotice({ kind: 'renamed', name: trimmed }) },
    );
  }

  function confirmArchive() {
    setConfirming(false);
    archive.mutate(undefined, {
      onSuccess: () => {
        setNotice({ kind: 'archived', name: outlet.name });
        router.back();
      },
    });
  }

  return (
    <>
      {notice?.kind === 'renamed' && noticeText ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={noticeText} />
        </View>
      ) : null}

      <View className={`${CARD} gap-4 p-4`}>
        {renameFailure && renameFailure !== 'name-taken' ? (
          <Banner tone="error" message={failedText} />
        ) : null}
        <View>
          <TextField
            label={t('outlets.name')}
            value={name}
            onChangeText={(value) => {
              setName(value);
              rename.reset();
              clearNotice();
            }}
            onSubmitEditing={saveName}
            returnKeyType="done"
            className={
              renameFailure === 'name-taken' ? 'border-destructive' : undefined
            }
          />
          {renameFailure === 'name-taken' ? (
            <Text
              accessibilityRole="alert"
              className="text-destructive-soft-foreground font-sans-medium mt-1.5 px-1 text-[13px]"
            >
              {t('outlets.name-taken')}
            </Text>
          ) : null}
        </View>
        <Button
          disabled={!trimmed || trimmed === outlet.name || rename.isPending}
          onPress={saveName}
        >
          <Text>{t('admin.save')}</Text>
        </Button>
      </View>

      <View className={`${CARD} mt-4 overflow-hidden`}>
        <SwitchRow
          label={t('outlets.attendance')}
          hint={t('outlets.attendance-hint')}
          checked={attendanceOn}
          disabled={attendance.isPending}
          onChange={(value) => attendance.mutate({ attendance_enabled: value })}
        />
        {attendance.isError ? (
          <View className="px-4 pb-3">
            <Banner
              tone="error"
              message={`${t('admin.save-failed')} ${t(
                outlet.attendance_enabled
                  ? 'outlets.attendance-still-on'
                  : 'outlets.attendance-still-off',
              )} ${t('common.offline')}`}
            />
          </View>
        ) : null}
      </View>

      <View className="mx-4 mt-8">
        {archive.isError ? (
          <View className="mb-3">
            <Banner
              tone="error"
              message={`${t('outlets.archive-failed')} ${t('common.offline')}`}
            />
          </View>
        ) : null}
        <Button
          variant="outline"
          onPress={() => {
            archive.reset();
            setConfirming(true);
          }}
          className="border-destructive/50 bg-card min-h-12 w-full px-5"
        >
          <Archive className="text-destructive-soft-foreground size-[18px]" />
          <Text className="text-destructive-soft-foreground font-sans-semibold text-[15px]">
            {t('outlets.archive')}
          </Text>
        </Button>
      </View>

      <ConfirmDialog
        visible={confirming}
        icon={Archive}
        title={format(t('outlets.archive-title'), { name: outlet.name })}
        body={t('outlets.archive-body')}
        safe={{
          label: t('admin.cancel'),
          onPress: () => setConfirming(false),
        }}
        other={{
          label: t('outlets.archive-confirm'),
          onPress: confirmArchive,
        }}
      />
    </>
  );
}
