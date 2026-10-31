import { classifyConfigError } from '@/features/attendance/config-errors';
import { useConfigText } from '@/features/attendance/config-text';
import { useAttendanceConfigs } from '@/features/attendance/use-attendance-configs';
import { useAttendanceOutlets } from '@/features/attendance/use-attendance-outlets';
import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { EmptyState } from '@/shared/components/empty-state';
import {
  OutletPicker,
  useSelectedOutlet,
} from '@/shared/components/outlet-picker';
import { RetryBanner } from '@/shared/components/retry-banner';
import { Skeleton } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import { CalendarClock, ChevronRight, Info, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

/** Attendance configuration (ATT-04): the sessions each outlet runs, and who marks them. */
export function ConfigsScreen() {
  const t = useT();
  const router = useRouter();
  const { data: me } = useMe();
  const text = useConfigText();
  const outlets = useAttendanceOutlets();
  const [outlet, setOutletId] = useSelectedOutlet(outlets.outlets);
  const setModulesNotice = useModulesNotice((state) => state.setNotice);

  const configs = useAttendanceConfigs(outlet?.id, {
    enabled: outlet !== undefined,
  });
  const pull = usePullToRefresh(() => {
    void configs.refetch();
    outlets.refetch();
  });

  const failure = configs.isError ? classifyConfigError(configs.error) : null;
  const forbidden = failure === 'forbidden';
  const outletName = outlet?.name ?? me?.business.name ?? '';

  // Attendance switched off under us: back to Modules, with a word about it.
  const moduleOff =
    failure === 'gone' ||
    (!outlets.isPending && !outlets.isError && outlets.outlets.length === 0);
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.attendance-off'), { outlet: outletName }),
    );
    router.replace('/modules');
  }, [moduleOff, outletName, router, setModulesNotice, t]);

  const loading =
    outlets.isPending || (configs.isPending && outlet !== undefined);
  const list = configs.data ?? [];

  function addConfig() {
    if (!outlet) return;
    router.push({
      pathname: '/attendance/configs/new',
      params: { outlet: outlet.id },
    });
  }

  const body = (() => {
    if (forbidden) {
      return (
        <View className="mx-4">
          <Banner tone="error" message={t('cfg.forbidden')} />
        </View>
      );
    }
    if (loading) {
      return (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="gap-3"
        >
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              className="shadow-card border-border bg-card mx-4 gap-2 rounded-3xl border px-4 py-3"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </View>
          ))}
        </View>
      );
    }
    if (configs.isError || outlets.isError) return null; // The Retry banner says so.
    if (list.length === 0) {
      return (
        <EmptyState
          icon={CalendarClock}
          title={format(t('cfg.no-config'), { outlet: outletName })}
        />
      );
    }
    return (
      <View className="gap-3">
        {list.map((config) => (
          <Pressable
            key={config.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/attendance/configs/[id]',
                params: { id: config.id },
              })
            }
            className="shadow-card border-border bg-card active:bg-accent mx-4 min-h-16 flex-row items-center gap-3 rounded-3xl border px-4 py-3"
          >
            <View className="min-w-0 flex-1">
              <Text className="font-sans-semibold text-[16px] leading-snug">
                {text.title(config)}
              </Text>
              <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
                {text.line(config)}
              </Text>
              <View className="mt-1.5 flex-row items-center gap-1.5">
                {config.managers.length === 0 ? (
                  <Info className="text-foreground size-3.5 shrink-0" />
                ) : null}
                <Text className="min-w-0 flex-1 text-[13px] leading-snug">
                  {config.managers.length === 0
                    ? t('cfg.no-manager')
                    : config.managers.map((m) => m.full_name).join(', ')}
                </Text>
              </View>
            </View>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Pressable>
        ))}
      </View>
    );
  })();

  return (
    <PushedScreen
      title={t('modules.configs')}
      eyebrow={t('modules.attendance')}
      adminOnly
      backHref="/modules"
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
      footer={
        outlet && !forbidden ? (
          <Button className="w-full" onPress={addConfig}>
            <Plus className="text-primary-foreground size-5" />
            <Text>{t('cfg.add')}</Text>
          </Button>
        ) : undefined
      }
    >
      {forbidden ? null : (
        <View className="mx-4 mb-3">
          <OutletPicker
            outlets={outlets.outlets}
            value={outlet?.id ?? 0}
            onChange={setOutletId}
          />
        </View>
      )}
      {configs.isError || outlets.isError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void configs.refetch();
            outlets.refetch();
          }}
          retrying={configs.isRefetching || outlets.isRefetching}
        />
      ) : null}
      {body}
    </PushedScreen>
  );
}
