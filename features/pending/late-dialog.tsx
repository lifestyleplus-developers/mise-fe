import { TriangleAlert } from 'lucide-react-native';
import { Modal, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT, type MessageKey } from '@/shared/i18n';
import { isoToClock } from '@/shared/lib/time';
import { useFormatClock } from '@/shared/lib/use-clock-format';

import { useLateRefusals, type LateGroup } from './late-refusals';

/**
 * "Your answer wasn't recorded" (FE Spec §6, case 4): the person did the work and
 * the record will not show it, so it is said plainly, once per kind, and says the
 * manager will see it as missed. They are shown one after another.
 */
export function LateDialog() {
  const t = useT();
  const formatClock = useFormatClock();
  const group = useLateRefusals((state) => state.groups[0]);
  const dismiss = useLateRefusals((state) => state.dismissFirst);
  if (!group) return null;

  const time = group.closeIso ? formatClock(isoToClock(group.closeIso)) : '';
  const { title, body } = wording(group, time, t);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View className="bg-scrim flex-1 items-center justify-center px-5">
        <View
          accessibilityViewIsModal
          accessibilityRole="alert"
          className="border-border bg-card w-full max-w-sm items-center rounded-[1.75rem] border p-6"
        >
          <View className="bg-warning-soft mb-4 size-12 items-center justify-center rounded-full">
            <TriangleAlert className="text-warning-soft-foreground size-6" />
          </View>
          <Text
            variant="h3"
            className="text-center text-[22px] leading-tight"
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text className="mt-2 text-center text-[14px] leading-snug">
            {body}
          </Text>
          <Button
            onPress={dismiss}
            className="mt-6 h-auto min-h-11 w-full px-3 py-2"
          >
            <Text className="font-sans-semibold text-center text-[14px]">
              {t('queue.late.ok')}
            </Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}

function wording(
  group: LateGroup,
  time: string,
  t: (key: MessageKey) => string,
): { title: string; body: string } {
  if (group.kind === 'marks') {
    return group.names.length === 1
      ? {
          title: t('queue.late-mark.title'),
          body: format(t('queue.late-mark.body'), {
            name: group.names[0],
            time,
          }),
        }
      : {
          title: t('queue.late-marks.title'),
          body: format(t('queue.late-marks.body'), {
            names: group.names.join(', '),
            time,
          }),
        };
  }

  if (group.kind === 'photo') {
    return {
      title: t('queue.late-photo.title'),
      // With none in yet there is nothing to say about a partial check.
      body:
        group.progress && group.progress.sent > 0
          ? format(t('queue.late-photo.partial'), {
              n: String(group.progress.sent),
              total: String(group.progress.total),
            })
          : t('spot.late-refused'),
    };
  }

  const { answers, changes, name } = group;
  if (answers.length > 0) {
    const first =
      answers.length === 1
        ? {
            title: t('queue.late.title'),
            body: format(t('queue.late.body'), { task: answers[0], time }),
          }
        : {
            title: t('queue.late-many.title'),
            body: format(t('queue.late-many.body'), {
              n: String(answers.length),
              name,
              time,
            }),
          };
    if (changes.length === 0) return first;
    const also = format(
      t(changes.length === 1 ? 'queue.late.also.one' : 'queue.late.also.many'),
      { n: String(changes.length) },
    );
    return { title: first.title, body: `${first.body} ${also}` };
  }
  return changes.length === 1
    ? {
        title: t('queue.late-change.title'),
        body: format(t('queue.late-change.body'), { task: changes[0], time }),
      }
    : {
        title: t('queue.late-changes.title'),
        body: format(t('queue.late-changes.body'), {
          n: String(changes.length),
          name,
          time,
        }),
      };
}
