import { useRun } from '@/features/run/use-run';
import type { RunTask } from '@/shared/api/types';
import { Skeleton } from '@/shared/components/skeleton';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { Check, Circle, Flag } from 'lucide-react-native';
import { View } from 'react-native';

/** What was answered, in a few words: "Yes", "No", "3.8 °C" or "Photo taken". */
function useAnswerText() {
  const t = useT();
  return (task: RunTask): string | null => {
    if (task.answered_at === null) return null;
    if (task.answer_type === 'IMAGE') return t('run.photo-taken');
    if (task.answer_type === 'BINARY') {
      return task.answer_bool ? t('run.yes') : t('run.no');
    }
    if (task.answer_number === null) return null;
    return `${String(task.answer_number).replace('-', '−')}${task.unit ? ` ${task.unit}` : ''}`;
  };
}

/**
 * The tasks of one run, read-only, for a Home card to unfold: the task, and what has
 * been answered so far. A failed answer wears a flag and a pass a tick, so it is not
 * colour alone that says which; a task not answered yet is an empty circle.
 */
export function RunTasks({ runId }: { runId: number }) {
  const t = useT();
  const query = useRun(runId);
  const answerText = useAnswerText();

  if (query.isError && !query.data) {
    return (
      <View className="items-start gap-2 px-4 pb-3">
        <Text className="text-[14px]">{t('home.tasks-failed')}</Text>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isRefetching}
          onPress={() => void query.refetch()}
        >
          <Text>{t('common.retry')}</Text>
        </Button>
      </View>
    );
  }

  if (!query.data) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="gap-3 px-4 pb-3"
      >
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/3" />
      </View>
    );
  }

  return (
    <View className="gap-2.5 px-4 pb-3">
      {query.data.tasks.map((task) => {
        const answer = answerText(task);
        const failed = task.outcome === 'FAIL';
        return (
          <View
            key={task.id}
            accessible
            accessibilityLabel={format(
              answer ? t('home.task-answered') : t('home.task-open'),
              { task: task.text, answer: answer ?? '' },
            )}
            className="flex-row items-start gap-2.5"
          >
            {answer === null ? (
              <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            ) : failed ? (
              <Flag className="text-destructive-soft-foreground mt-0.5 size-4 shrink-0" />
            ) : (
              <Check
                className="text-foreground mt-0.5 size-4 shrink-0"
                strokeWidth={2.5}
              />
            )}
            <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-x-2">
              <Text className="min-w-0 shrink text-[14px] leading-snug">
                {task.text}
              </Text>
              {answer ? (
                <Text className="font-sans-semibold text-[13px]">{answer}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
