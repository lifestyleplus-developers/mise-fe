import { Text } from '@/shared/components/ui/text';
import { useT, type MessageKey } from '@/shared/i18n';
import type { Role } from '@/shared/constants/roles';
import { User } from 'lucide-react-native';
import { View } from 'react-native';

type ProfileCardProps = {
  /** Authored content: shown exactly as typed. */
  fullName: string;
  username: string;
  role: Role;
};

/**
 * Who is signed in: an avatar, their name, their username, and their role. The layout
 * is ABM's profile card. Mise has no email, so the username takes its place.
 */
export function ProfileCard({ fullName, username, role }: ProfileCardProps) {
  const t = useT();
  const roleLabel = t(`role.${role}` as MessageKey);
  return (
    <View
      accessible
      accessibilityLabel={`${fullName}, @${username}, ${roleLabel}`}
      className="shadow-card border-border bg-card mx-4 mb-5 flex-row items-center gap-3 rounded-3xl border p-4"
    >
      <View className="bg-secondary size-11 shrink-0 items-center justify-center rounded-full">
        <User className="text-foreground size-[22px]" />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="font-sans-semibold text-[17px] leading-snug"
        >
          {fullName}
        </Text>
        <Text
          numberOfLines={1}
          className="text-muted-foreground mt-0.5 text-[14px]"
        >
          @{username}
        </Text>
      </View>
      <View className="bg-primary shrink-0 self-start rounded-lg px-2.5 py-1">
        <Text className="text-primary-foreground font-sans-semibold text-[11px] tracking-wider uppercase">
          {roleLabel}
        </Text>
      </View>
    </View>
  );
}
