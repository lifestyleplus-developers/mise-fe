import type { AtRiskReport } from '@/shared/api/types';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { formatDay, toDay } from '@/shared/lib/date-range';
import { useLanguageStore } from '@/shared/stores/language-store';
import { useRouter } from 'expo-router';
import { ChevronRight, ShieldCheck, Users } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { CardSkeletons } from './card-skeletons';
import { scorePercent } from './issue-card';
import { useAtRisk } from './use-at-risk';

type Row = AtRiskReport['results'][number];

/**
 * At risk (OVS-03, FE Spec §3.7): the worst runs closed in the last 24 hours,
 * at the top of Issues for ADMIN and OWNER. The window is fixed. Its own error
 * stays inside the block, so the list below still loads.
 */
export function AtRiskBlock() {
  const t = useT();
  const query = useAtRisk(true);
  const rows = query.data?.results ?? [];

  let body: React.ReactNode;
  if (query.isPending && !query.isError) {
    body = <CardSkeletons count={3} />;
  } else if (!query.data) {
    body = (
      <View className="mx-4 gap-2">
        <Banner tone="error" message={t('risk.failed')} />
        <Button
          variant="outline"
          className="self-start"
          disabled={query.isRefetching}
          onPress={() => void query.refetch()}
        >
          <Text>{t('iss.try-again')}</Text>
        </Button>
      </View>
    );
  } else if (rows.length === 0) {
    body = (
      <View className="shadow-card border-border bg-card mx-4 flex-row items-center gap-2 rounded-3xl border px-4 py-4">
        <ShieldCheck className="text-foreground size-5 shrink-0" />
        <Text className="min-w-0 flex-1 text-[15px] leading-snug">
          {t('risk.empty')}
        </Text>
      </View>
    );
  } else {
    body = (
      <View className="gap-3">
        {rows.map((row) => (
          <RiskCard key={row.run_id} row={row} />
        ))}
      </View>
    );
  }

  return (
    <View className="mb-5">
      <Text
        accessibilityRole="header"
        className="font-sans-semibold mx-5 mb-2 text-[15px] leading-snug"
      >
        {t('risk.heading')}
      </Text>
      {body}
    </View>
  );
}

function RiskCard({ row }: { row: Row }) {
  const t = useT();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);

  const opened = toDay(new Date(row.window_open));
  // Today's runs need no date; an older one says which day.
  const score =
    opened === toDay(new Date())
      ? scorePercent(row.score)
      : `${scorePercent(row.score)} · ${formatDay(opened, language)}`;
  const managers =
    row.cl_admins.length > 0
      ? row.cl_admins.map((person) => person.full_name).join(', ')
      : t('iss.no-manager');
  const spoken = [row.checklist.name, row.outlet.name, score, managers].join(
    ', ',
  );
  const incidentId = row.incident_id;

  const content = (
    <>
      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-[16px] leading-snug">
          {row.checklist.name}
        </Text>
        <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
          {row.outlet.name}
        </Text>
        <Text className="font-sans-semibold mt-1.5 text-[14px]">{score}</Text>
        <View className="mt-1 flex-row items-start gap-1.5">
          <Users className="text-foreground mt-0.5 size-4 shrink-0" />
          <Text className="min-w-0 flex-1 text-[13px] leading-snug">
            {managers}
          </Text>
        </View>
      </View>
      {incidentId !== null ? (
        <ChevronRight className="text-muted-foreground mt-0.5 size-5 shrink-0" />
      ) : null}
    </>
  );
  const frame =
    'shadow-card border-border bg-card mx-4 min-h-16 flex-row items-start gap-3 rounded-3xl border px-4 py-3';

  // A run with no issue yet has nothing to open.
  return incidentId !== null ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={() =>
        router.push({
          pathname: '/issues/[id]',
          params: { id: incidentId },
        })
      }
      className={`${frame} active:bg-accent`}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={spoken} className={frame}>
      {content}
    </View>
  );
}
