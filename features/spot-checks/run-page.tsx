import { useMe } from '@/features/auth/use-me';
import { useModulesNotice } from '@/features/shell/modules-notice';
import { PushedScreen } from '@/features/shell/pushed-screen';
import { ApiError } from '@/shared/api/client';
import type { SpotCheckRun } from '@/shared/api/types';
import { PendingPill } from '@/shared/components/pending-pill';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SkeletonRows } from '@/shared/components/skeleton';
import { Banner } from '@/shared/components/ui/banner';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';
import { usePullToRefresh } from '@/shared/lib/use-pull-to-refresh';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import {
  closedSummary,
  nextToTake,
  photoLinesFor,
  refusalKind,
  sentCount,
  waitingCount,
} from './capture-view';
import { CaptureSheet } from './capture-sheet';
import { closedLine } from './closed-line';
import { CountdownRing } from './countdown-ring';
import { PromptRow } from './prompt-row';
import { promptState, type PromptState } from './prompt-state';
import { SpotCheckLinks } from './spot-check-links';
import { subjectName } from './spot-outcome';
import { useCaptureFlow } from './use-capture-flow';
import { useSpotCountdown } from './use-spot-countdown';
import { useSpotCheckRun } from './use-spot-check-runs';
import { useSpotCheckOutlets } from './use-spot-check-outlets';
import { sendWaitingPhotoNow } from './use-spot-photo-queue';
import { useSpotPhotoUpload } from './use-spot-photo-upload';

type RunPageProps = {
  runId: number;
  /** Where Back goes when nothing is behind this screen. */
  backHref?: '/modules' | '/spot-checks';
};

/**
 * One revealed (or just closed) spot check (SPT-01): the subject, the countdown, and
 * the prompts in order, each taking a photograph. 🔒 Before the reveal the run has no
 * subject, no times and no prompts, and this page shows none.
 */
export function RunPage({ runId, backHref = '/modules' }: RunPageProps) {
  const t = useT();
  const router = useRouter();
  const query = useSpotCheckRun(runId);
  // The query's own function keeps its identity between renders; a new arrow each
  // time would re-run any effect that depends on it.
  const { refetch: refetchRun } = query;
  const refetch = React.useCallback(() => void refetchRun(), [refetchRun]);
  const outlets = useSpotCheckOutlets();
  const setModulesNotice = useModulesNotice((state) => state.setNotice);
  const { data: me } = useMe();
  const pull = usePullToRefresh(refetch);

  const status = query.error instanceof ApiError ? query.error.status : null;
  const moduleOff = status === 404;
  React.useEffect(() => {
    if (!moduleOff) return;
    setModulesNotice(
      format(t('modules.spot-checks-off'), { outlet: me?.business.name ?? '' }),
    );
    router.replace('/modules');
  }, [moduleOff, me?.business.name, router, setModulesNotice, t]);

  const run = query.data;
  const outlet = outlets.outlets.find((o) => o.id === run?.outlet_id);
  const eyebrow =
    outlets.outlets.length > 1 && outlet
      ? format(t('spot.eyebrow'), { outlet: outlet.name })
      : t('modules.spot-checks');
  const frame = {
    backHref,
    eyebrow,
    onRefresh: pull.onRefresh,
    refreshing: pull.refreshing,
  } as const;

  if (!run || !run.subject || !run.captures) {
    // Not loaded, failed, or (🔒) not revealed yet: nothing about it to draw.
    return (
      <PushedScreen title={t('modules.spot-checks')} {...frame}>
        <SpotCheckLinks />
        {query.isError && !moduleOff ? (
          status === 403 ? (
            <View className="mx-4">
              <Banner tone="error" message={t('spot.role-lost')} />
            </View>
          ) : (
            <RetryBanner
              message={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={refetch}
              retrying={query.isRefetching}
            />
          )
        ) : (
          <SkeletonRows count={4} />
        )}
      </PushedScreen>
    );
  }

  return (
    <RunBody
      key={run.id}
      run={run}
      userId={me?.user.id}
      refetching={query.isRefetching}
      failed={query.isError}
      refetch={refetch}
      frame={frame}
    />
  );
}

type RunBodyProps = {
  run: SpotCheckRun;
  userId: number | undefined;
  failed: boolean;
  refetching: boolean;
  refetch: () => void;
  frame: Pick<
    React.ComponentProps<typeof PushedScreen>,
    'backHref' | 'eyebrow' | 'onRefresh' | 'refreshing'
  >;
};

function RunBody({
  run,
  userId,
  failed,
  refetching,
  refetch,
  frame,
}: RunBodyProps) {
  const t = useT();
  const formatClock = useFormatClock();
  const captures = run.captures ?? [];
  const upload = useSpotPhotoUpload(run.id);
  const flow = useCaptureFlow();
  const countdown = useSpotCountdown(run.window_close ?? undefined);

  // The clock reached the close before the platform said so: ask it.
  const closed = run.status === 'FINALIZED' || countdown.closed;
  const closedByClock = countdown.closed && run.status !== 'FINALIZED';
  // Once per run: if the platform is a little late to say so, the run is re-read
  // every 15 seconds anyway (`useSpotCheckRun`), so this only speeds up the usual
  // case. Asking again on every reply would be a request loop.
  const askedAboutClose = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!closedByClock || askedAboutClose.current === run.id) return;
    askedAboutClose.current = run.id;
    refetch();
  }, [closedByClock, run.id, refetch]);

  // The window ended while the camera or the preview was up: nothing taken now is
  // accepted, so close it and show the closed card.
  const captureStep = flow.state.step;
  const closeFlow = flow.close;
  React.useEffect(() => {
    if (closed && captureStep !== 'idle') closeFlow();
  }, [closed, captureStep, closeFlow]);

  const time = (iso: string) => formatClock(isoToClock(iso));
  const isManager = userId !== undefined && run.manager?.id === userId;

  // Fold the run's record, the photographs still on the phone and the send queue.
  const states: Record<number, PromptState> = {};
  let refusedForRole = false;
  for (const capture of captures) {
    const draft = upload.drafts.find((d) => d.position === capture.position);
    let queued =
      upload.queued.find(
        (q) => q.variables.request.capture_position === capture.position,
      ) ?? null;
    if (queued?.kind === 'refused') {
      const why = refusalKind(queued.error);
      if (why === 'forbidden') {
        refusedForRole = true;
        queued = null;
      }
    }
    states[capture.position] = promptState({ capture, draft, queued, closed });
  }
  // A refused send with the role gone: nothing more can be taken here.
  const forbidden = refusedForRole;
  const canCapture = isManager && !forbidden && !closed;
  const waiting = waitingCount(states);
  const next = nextToTake(captures, states);
  const sent = sentCount(captures);

  const name = subjectName(run);

  const lineText = {
    byAt: (who: string, when: string) =>
      format(t('spot.by-at'), { name: who, time: when }),
    newPhoto: (who: string, when: string) =>
      format(t('spot.new-photo'), { name: who, time: when }),
    replaced: (who: string, when: string) =>
      format(t('spot.replaced'), { name: who, time: when }),
    time,
  };

  function take(position: number, retake = false) {
    void flow.start(position, retake);
  }

  function useThisPhoto() {
    const { position, uri, retake } = flow.state;
    if (position === null || uri === null) return;
    upload.send(position, uri);
    // On to the next prompt, but not after a retake. The camera stays up and moves
    // on, so nothing closes and reopens in between.
    const following = retake
      ? undefined
      : nextToTake(captures, states, position);
    if (following) flow.next(following.position);
    else flow.close();
  }

  function sendNow(position: number) {
    if (upload.drafts.some((d) => d.position === position)) {
      upload.retry(position);
    } else {
      // In storage and queued: send this one now, and nothing else.
      sendWaitingPhotoNow(run.id, position);
    }
  }

  const summary = closedSummary({
    completion: run.completion,
    sent,
    total: captures.length,
  });

  const footer =
    canCapture && next ? (
      <Button className="min-h-12 w-full" onPress={() => take(next.position)}>
        <Camera className="text-primary-foreground size-5" />
        <Text>{format(t('spot.take-photo'), { prompt: next.prompt })}</Text>
      </Button>
    ) : canCapture && !next && waiting === 0 ? (
      <Text className="px-1 text-center text-[14px] leading-snug font-medium">
        {t('spot.all-taken')}
      </Text>
    ) : undefined;

  const focused =
    flow.state.position === null
      ? undefined
      : captures.find((c) => c.position === flow.state.position);

  return (
    <PushedScreen title={name} {...frame} footer={footer}>
      <Text className="font-sans-semibold mx-5 -mt-1 mb-3 text-[15px] leading-snug">
        {run.spot_check_name}
      </Text>

      <SpotCheckLinks />

      {failed ? (
        <RetryBanner
          message={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={refetch}
          retrying={refetching}
        />
      ) : null}
      {waiting > 0 ? (
        <View className="mx-4 mb-3">
          <PendingPill
            label={
              waiting === 1
                ? t('spot.n-waiting-one')
                : format(t('spot.n-waiting'), { n: String(waiting) })
            }
          />
        </View>
      ) : null}
      {forbidden ? (
        <View className="mx-4 mb-3">
          <Banner tone="error" message={t('spot.role-lost')} />
        </View>
      ) : null}
      {!isManager && !forbidden ? (
        <View className="mx-4 mb-3">
          <Banner tone="notice" message={t('spot.view-only')} />
        </View>
      ) : null}

      {!closed && run.window_close ? (
        <CountdownRing windowClose={run.window_close} />
      ) : (
        <View className="border-border bg-card mx-4 mb-3 rounded-3xl border px-4 py-4">
          <Text className="font-sans-bold text-[20px] leading-tight">
            {format(t('spot.closed-at'), {
              time: run.window_close ? time(run.window_close) : '',
            })}
          </Text>
          <Text className="mt-1.5 text-[15px] leading-snug">
            {closedLine(summary, t)}
          </Text>
        </View>
      )}

      <Text className="text-muted-foreground mx-5 mb-2 text-[13px] leading-snug font-medium">
        {t('spot.placeholder-prompts')}
      </Text>
      <View className="shadow-card border-border bg-card mx-4 overflow-hidden rounded-3xl border">
        {captures.map((capture, index) => {
          const state = states[capture.position];
          return (
            <PromptRow
              key={capture.position}
              first={index === 0}
              position={capture.position}
              prompt={capture.prompt}
              state={state}
              photoLines={photoLinesFor(capture, lineText)}
              lateLine={state === 'late' ? t('spot.late-refused') : undefined}
              onRetake={
                canCapture && state === 'sent'
                  ? () => take(capture.position, true)
                  : undefined
              }
              onRetry={
                canCapture && state === 'failed'
                  ? () => upload.retry(capture.position)
                  : undefined
              }
              onSendNow={
                state === 'waiting'
                  ? () => sendNow(capture.position)
                  : undefined
              }
            />
          );
        })}
      </View>

      {canCapture ? (
        <Text className="mx-5 mt-3 text-[13px] leading-snug">
          {format(t('spot.cant-find'), { name })}
        </Text>
      ) : null}

      <CaptureSheet
        state={flow.state}
        prompt={focused?.prompt ?? ''}
        windowClose={run.window_close ?? ''}
        onContinue={() => void flow.ask()}
        onOpenSettings={flow.openSettings}
        onAgain={() => void flow.again()}
        onRetake={flow.retake}
        onUse={useThisPhoto}
        onPhoto={flow.captured}
        onNoPhoto={flow.noPicture}
        onMountError={flow.cameraFailed}
        onClose={flow.close}
      />
    </PushedScreen>
  );
}
