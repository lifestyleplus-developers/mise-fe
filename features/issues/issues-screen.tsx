import { useMe } from '@/features/auth/use-me';
import { FilterChip } from '@/features/home/filter-chip';
import { TabScreen } from '@/features/shell/tab-screen';
import { ApiError } from '@/shared/api/client';
import { useQueuedWrites } from '@/shared/api/query-helpers';
import type { IncidentStatus } from '@/shared/api/types';
import { EmptyState } from '@/shared/components/empty-state';
import { OptionList } from '@/shared/components/option-list';
import { PendingPill } from '@/shared/components/pending-pill';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SegmentedControl } from '@/shared/components/segmented-control';
import { Banner } from '@/shared/components/ui/banner';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { format, useT } from '@/shared/i18n';
import { useRouter } from 'expo-router';
import { ClipboardCheck, SearchX, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { IssueCard } from './issue-card';
import {
  RESOLVE_KEY,
  type IssueFilters,
  type ResolveVariables,
} from './issue-keys';
import { AtRiskBlock } from './at-risk-block';
import { CardSkeletons } from './card-skeletons';
import { useIncidents, useIssueFilterOptions } from './use-incidents';

const ALL = '';

type Sheet = 'outlet' | 'checklist' | null;

/** Issues (ISS-01, FE Spec §3.6): the runs that were not perfect, open first. */
export function IssuesScreen() {
  const { data: me } = useMe();
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = React.useState<IncidentStatus>('OPEN');
  const [outletId, setOutletId] = React.useState<number>();
  const [checklistId, setChecklistId] = React.useState<number>();
  const [sheet, setSheet] = React.useState<Sheet>(null);

  const filters: IssueFilters = { status, outletId, checklistId };
  const incidents = useIncidents(filters);
  const options = useIssueFilterOptions();
  const queued = useQueuedWrites<ResolveVariables>(RESOLVE_KEY, (variables) =>
    String(variables.incidentId),
  );
  const waiting = new Set(
    queued
      .filter((write) => write.kind === 'waiting')
      .map((write) => write.variables.incidentId),
  );

  if (!me) return null;

  const rows = incidents.data?.pages.flatMap((page) => page.results) ?? [];
  const outlets = options.data?.outlets ?? [];
  const checklists = options.data?.checklists ?? [];
  const outletName = outlets.find((o) => o.id === outletId)?.name;
  const checklistName = checklists.find((c) => c.id === checklistId)?.name;
  const filterLabel = [outletName, checklistName].filter(Boolean).join(' · ');
  const showChips = outlets.length > 1 || checklists.length > 0;
  const loadedWithError = incidents.isError && incidents.data !== undefined;
  const forbidden =
    incidents.error instanceof ApiError && incidents.error.status === 403;

  function clearFilters() {
    setOutletId(undefined);
    setChecklistId(undefined);
  }

  let body: React.ReactNode;
  if (incidents.isPending && !incidents.isError) {
    body = <CardSkeletons count={4} />;
  } else if (!incidents.data || forbidden) {
    // Failed with nothing to show: say so, and offer another go.
    body = (
      <View className="mx-4 gap-2">
        <Banner tone="error" message={t('iss.load-failed')} />
        <Button
          variant="outline"
          className="self-start"
          disabled={incidents.isRefetching}
          onPress={() => void incidents.refetch()}
        >
          <Text>{t('iss.try-again')}</Text>
        </Button>
      </View>
    );
  } else if (rows.length === 0) {
    body = filterLabel ? (
      <EmptyState
        icon={SearchX}
        title={format(
          t(
            status === 'OPEN'
              ? 'iss.empty-filter'
              : 'iss.empty-filter-resolved',
          ),
          { what: filterLabel },
        )}
        action={
          <Button variant="outline" onPress={clearFilters}>
            <Text>{t('home.clear-filter')}</Text>
          </Button>
        }
      />
    ) : status === 'RESOLVED' ? (
      <EmptyState icon={ClipboardCheck} title={t('iss.empty-resolved')} />
    ) : (
      <EmptyState
        icon={ShieldCheck}
        title={t('iss.empty')}
        body={t('iss.empty-body')}
      />
    );
  } else {
    body = (
      <>
        <View className="gap-3">
          {rows.map((incident) => (
            <IssueCard
              key={incident.id}
              incident={incident}
              waiting={waiting.has(incident.id)}
              onPress={() =>
                router.push({
                  pathname: '/issues/[id]',
                  params: { id: incident.id },
                })
              }
            />
          ))}
        </View>
        {incidents.isFetchingNextPage ? (
          <View className="mt-3">
            <CardSkeletons count={1} />
          </View>
        ) : null}
      </>
    );
  }

  const sheetOptions = sheet === 'outlet' ? outlets : checklists;
  const sheetValue =
    (sheet === 'outlet' ? outletId : checklistId)?.toString() ?? ALL;

  return (
    <TabScreen
      title={t('tab.issues')}
      eyebrow={me.business.name}
      onEndReached={() => {
        if (incidents.hasNextPage && !incidents.isFetchingNextPage) {
          void incidents.fetchNextPage();
        }
      }}
    >
      {loadedWithError ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void incidents.refetch()}
          retrying={incidents.isRefetching}
        />
      ) : null}

      {waiting.size > 0 ? (
        <View className="mx-4 mb-3">
          <PendingPill
            label={
              waiting.size === 1
                ? t('iss.pending-line')
                : format(t('iss.pending-line-n'), { n: String(waiting.size) })
            }
          />
        </View>
      ) : null}

      {canAdminister(me.user.tenant_role) ? <AtRiskBlock /> : null}

      {canAdminister(me.user.tenant_role) ? (
        <Text
          accessibilityRole="header"
          className="font-sans-semibold mx-5 mb-2 text-[15px] leading-snug"
        >
          {t('iss.open-issues')}
        </Text>
      ) : null}

      <View className="mx-4 mb-3 gap-2">
        <SegmentedControl
          label={t('iss.show')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'OPEN', label: t('iss.open') },
            { value: 'RESOLVED', label: t('iss.resolved') },
          ]}
        />
        {showChips ? (
          <View className="flex-row flex-wrap gap-2">
            {outlets.length > 1 ? (
              <FilterChip
                label={t('home.all-outlets')}
                value={outletName}
                clearLabel={t('home.clear-filter')}
                onOpen={() => setSheet('outlet')}
                onClear={() => setOutletId(undefined)}
              />
            ) : null}
            <FilterChip
              label={t('home.all-checklists')}
              value={checklistName}
              clearLabel={t('home.clear-filter')}
              onOpen={() => setSheet('checklist')}
              onClear={() => setChecklistId(undefined)}
            />
          </View>
        ) : null}
      </View>

      {body}

      <BottomSheet
        visible={sheet !== null}
        title={t(
          sheet === 'outlet' ? 'home.outlet-sheet' : 'home.checklist-sheet',
        )}
        onDismiss={() => setSheet(null)}
        footer={
          <Button variant="outline" onPress={() => setSheet(null)}>
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <OptionList
          value={sheetValue}
          options={[
            {
              value: ALL,
              label: t(
                sheet === 'outlet' ? 'home.all-outlets' : 'home.all-checklists',
              ),
            },
            ...sheetOptions.map((ref) => ({
              value: String(ref.id),
              label: ref.name,
            })),
          ]}
          onChange={(value) => {
            const next = value === ALL ? undefined : Number(value);
            if (sheet === 'outlet') setOutletId(next);
            else setChecklistId(next);
            setSheet(null);
          }}
        />
      </BottomSheet>
    </TabScreen>
  );
}
