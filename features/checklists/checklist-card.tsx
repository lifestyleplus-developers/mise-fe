import { Text } from '@/shared/components/ui/text';
import { ChevronRight, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

type ChecklistCardProps = {
  name: string;
  schedule: string;
  /** One line per outlet: its score, or the outlet alone for an implementer. */
  outlets: string[];
  /** "+2 more" once there are more outlets than fit. */
  more?: string;
  /** Replaces the outlet lines, e.g. "Not assigned to any outlet yet". */
  note?: string;
  /** Absent for implementers: they see the card but not its analytics. */
  onOpen?: () => void;
  openLabel: string;
  /** Absent unless the caller supervises this checklist somewhere. */
  team?: { label: string; ariaLabel: string; onPress: () => void };
};

/** One checklist on the Checklists tab (CHK-05, FE Spec §3.4). */
export function ChecklistCard({
  name,
  schedule,
  outlets,
  more,
  note,
  onOpen,
  openLabel,
  team,
}: ChecklistCardProps) {
  return (
    <View className="shadow-card border-border bg-card relative mx-4 mb-3 rounded-3xl border">
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          onPress={onOpen}
          className="active:bg-accent/60 absolute inset-0 rounded-3xl"
        />
      ) : null}
      <View pointerEvents="box-none" className="flex-row items-start gap-3 p-4">
        <View pointerEvents="none" className="min-w-0 flex-1">
          <Text className="font-sans-semibold text-[16px] leading-snug">
            {name}
          </Text>
          <Text className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
            {schedule}
          </Text>
          {note ? (
            <Text className="text-muted-foreground mt-2 text-[13px] leading-snug">
              {note}
            </Text>
          ) : outlets.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-0.5">
              {outlets.map((line) => (
                <Text
                  key={line}
                  className="font-sans-medium text-[14px] leading-snug"
                >
                  {line}
                </Text>
              ))}
              {more ? (
                <Text className="text-muted-foreground text-[14px] leading-snug">
                  {more}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="shrink-0 items-end gap-2">
          {team ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={team.ariaLabel}
              onPress={team.onPress}
              className="border-input-edge bg-card active:bg-accent min-h-11 flex-row items-center gap-1.5 rounded-full border px-3.5"
            >
              <Users className="text-foreground size-4" />
              <Text className="font-sans-semibold text-[13px]">
                {team.label}
              </Text>
            </Pressable>
          ) : null}
          {onOpen ? (
            <ChevronRight
              className={
                team
                  ? 'text-muted-foreground size-5'
                  : 'text-muted-foreground mt-0.5 size-5'
              }
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** First-load placeholder cards. */
export function ChecklistCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className="shadow-card border-border bg-card mx-4 mb-3 gap-2.5 rounded-3xl border p-4"
        >
          <View className="bg-muted h-4 w-1/2 rounded-full" />
          <View className="bg-muted h-3 w-1/3 rounded-full" />
          <View className="bg-muted mt-1 h-3.5 w-3/4 rounded-full" />
        </View>
      ))}
    </View>
  );
}
