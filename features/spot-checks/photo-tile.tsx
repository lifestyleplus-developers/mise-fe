import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';
import { ImageIcon, CircleDashed, ImageOff } from 'lucide-react-native';
import { Image, View } from 'react-native';

export type PhotoTileKind = 'photo' | 'replaced' | 'missing' | 'purged';

type PhotoTileProps = {
  kind: PhotoTileKind;
  /** The caption: who took it and when, "Not taken", or the retention notice. */
  label: string;
  /** The prompt it answers, short. */
  sub?: string;
  /** The picture. The mock's `mock://` locations have nothing to draw, so a stand-in shows. */
  uri?: string | null;
};

const drawable = (uri: string | null | undefined): uri is string =>
  !!uri && !uri.startsWith('mock://');

/**
 * One photograph of a run, with its caption. A retake leaves the earlier photograph
 * as a `replaced` tile beside the new one, each with its own time. A prompt with no
 * photograph is a dashed `missing` tile; one removed under the retention policy is
 * `purged`, with the reason.
 */
export function PhotoTile({ kind, label, sub, uri }: PhotoTileProps) {
  const solid = kind === 'photo' || kind === 'replaced';
  return (
    <View
      className={cn(
        'w-28 shrink-0 gap-1.5',
        kind === 'replaced' && 'opacity-80',
      )}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={cn(
          'text-muted-foreground h-24 w-28 items-center justify-center overflow-hidden rounded-2xl',
          solid
            ? 'border-border bg-muted border'
            : 'border-border bg-card border-2 border-dashed',
        )}
      >
        {solid && drawable(uri) ? (
          <Image source={{ uri }} className="size-full" resizeMode="cover" />
        ) : kind === 'missing' ? (
          <CircleDashed className="text-muted-foreground size-6" />
        ) : kind === 'purged' ? (
          <ImageOff className="text-muted-foreground size-6" />
        ) : (
          <ImageIcon className="text-muted-foreground size-6" />
        )}
      </View>
      <Text
        className={cn(
          'text-[12px] leading-snug',
          kind === 'replaced' || kind === 'purged'
            ? 'text-muted-foreground'
            : 'font-sans-semibold',
        )}
      >
        {label}
      </Text>
      {sub ? (
        <Text className="text-muted-foreground text-[12px] leading-snug">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
