import { Avatar } from '@/shared/components/avatar';
import { RetryBanner } from '@/shared/components/retry-banner';
import { SearchField } from '@/shared/components/search-field';
import { Skeleton } from '@/shared/components/skeleton';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { THEME } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { useAppliedTheme } from '@/shared/stores/theme-store';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

type PickerPerson = {
  id: number;
  /** Authored content: shown exactly as typed. */
  name: string;
  username?: string;
  /**
   * Why this person cannot be chosen, e.g. "Team Member here". When set the
   * row is greyed out and cannot be tapped, and says why instead of the
   * username.
   */
  disabledReason?: string;
};

type PeoplePickerProps = {
  visible: boolean;
  title: string;
  /** Undefined until the list has loaded. */
  people: readonly PickerPerson[] | undefined;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onPick: (person: PickerPerson) => void;
  onClose: () => void;
  /** The person being added right now: their row spins and the rest wait. */
  pendingId?: number | null;
  /** Overrides the wording when a search finds no one. */
  noResultMessage?: (query: string) => string;
};

/** A searchable list of people to choose one from, in a bottom sheet. */
function PeoplePicker({
  visible,
  title,
  people,
  loading = false,
  failed = false,
  onRetry,
  onPick,
  onClose,
  pendingId = null,
  noResultMessage,
}: PeoplePickerProps) {
  const t = useT();
  const theme = useAppliedTheme();
  const [query, setQuery] = React.useState('');
  const [wasVisible, setWasVisible] = React.useState(visible);
  // A fresh search each time it opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery('');
  }

  const needle = query.trim().toLowerCase();
  const shown = (people ?? []).filter(
    (person) =>
      !needle ||
      person.name.toLowerCase().includes(needle) ||
      (person.username ?? '').toLowerCase().includes(needle),
  );
  const busy = pendingId !== null;

  return (
    <BottomSheet
      visible={visible}
      title={title}
      onDismiss={busy ? () => {} : onClose}
      footer={
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onPress={onClose}
        >
          <Text>{t('admin.cancel')}</Text>
        </Button>
      }
    >
      <View className="mb-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('people.search')}
          clearLabel={t('people.clear')}
        />
      </View>

      {failed ? (
        <View className="-mx-4">
          <RetryBanner
            message={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={onRetry ?? (() => {})}
          />
        </View>
      ) : null}

      {loading && !people ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="border-border bg-card overflow-hidden rounded-3xl border"
        >
          {[0, 1, 2, 3].map((row) => (
            <View
              key={row}
              className={cn(
                'min-h-14 flex-row items-center gap-3 px-4 py-2',
                row > 0 && 'border-border border-t',
              )}
            >
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-3.5 w-2/5" />
            </View>
          ))}
        </View>
      ) : people && shown.length === 0 ? (
        <Text className="text-muted-foreground px-1 py-4 text-center text-[14px] leading-snug">
          {people.length === 0 || !needle
            ? t('people.none')
            : noResultMessage
              ? noResultMessage(query.trim())
              : format(t('people.no-result'), { name: query.trim() })}
        </Text>
      ) : (
        <ScrollView
          className="max-h-[340px]"
          keyboardShouldPersistTaps="handled"
        >
          <View className="border-border bg-card overflow-hidden rounded-3xl border">
            {shown.map((person, index) => {
              const unavailable = person.disabledReason !== undefined;
              const pending = pendingId === person.id;
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unavailable
                      ? `${person.name}, ${person.disabledReason}`
                      : person.name
                  }
                  accessibilityState={{
                    disabled: unavailable || busy,
                    busy: pending,
                  }}
                  disabled={unavailable || busy}
                  onPress={() => onPick(person)}
                  className={cn(
                    'min-h-14 flex-row items-center gap-3 px-4 py-2',
                    index > 0 && 'border-border border-t',
                    unavailable && 'opacity-50',
                    !unavailable && !busy && 'active:bg-accent',
                    busy && !pending && !unavailable && 'opacity-60',
                  )}
                >
                  <Avatar name={person.name} />
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-medium text-[15px] break-words">
                      {person.name}
                    </Text>
                    {pending ? (
                      <Text className="text-muted-foreground text-[13px]">
                        {format(t('people.adding'), { name: person.name })}
                      </Text>
                    ) : unavailable ? (
                      <Text className="text-muted-foreground text-[13px]">
                        {person.disabledReason}
                      </Text>
                    ) : person.username ? (
                      <Text className="text-muted-foreground text-[13px]">
                        @{person.username}
                      </Text>
                    ) : null}
                  </View>
                  {pending ? (
                    <ActivityIndicator
                      size="small"
                      color={THEME[theme].foreground}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

export { PeoplePicker };
export type { PeoplePickerProps, PickerPerson };
