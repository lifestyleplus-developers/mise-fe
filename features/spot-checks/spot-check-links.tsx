import { useMe } from '@/features/auth/use-me';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { canAdminister } from '@/shared/constants/roles';
import { useT, type MessageKey } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { usePathname, useRouter, type Href } from 'expo-router';
import { ClipboardList, LayoutGrid, ListChecks } from 'lucide-react-native';
import { View } from 'react-native';

type LinkDef = {
  href: '/spot-checks/results' | '/spot-checks/checks' | '/spot-checks/areas';
  label: MessageKey;
  Icon: typeof ListChecks;
  /** Head office only. */
  admin: boolean;
};

const LINKS: LinkDef[] = [
  {
    href: '/spot-checks/results',
    label: 'spot.results',
    Icon: ListChecks,
    admin: false,
  },
  {
    href: '/spot-checks/checks',
    label: 'spot.checks',
    Icon: ClipboardList,
    admin: true,
  },
  {
    href: '/spot-checks/areas',
    label: 'spot.areas',
    Icon: LayoutGrid,
    admin: true,
  },
];

/**
 * The row under the capture screen's title: Results for everyone who can open Spot
 * checks, and Checks and Areas for ADMIN and OWNER, who author them. Everyone lands
 * on the capture screen first; these are the ways on from it.
 *
 * The one you are in is filled in. Moving between them replaces the screen rather
 * than stacking another on top, so Back always goes the same short way (to the
 * capture screen, then Modules) however many times you switched. Tapping the one
 * you are on does nothing; from deeper inside it (one run, one check) it returns to
 * its list.
 */
export function SpotCheckLinks() {
  const { data: me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  if (!me) return null;
  const admin = canAdminister(me.user.tenant_role);
  // On the capture screen (or one run's capture) there is no tab to leave: push, so
  // Back returns to it. From another tab, replace.
  const insideTab = LINKS.some(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  function open(href: LinkDef['href']) {
    if (pathname === href) return;
    if (insideTab) router.replace(href as Href);
    else router.push(href as Href);
  }

  return (
    <View className="mx-4 mb-3 flex-row flex-wrap gap-2">
      {LINKS.filter((link) => admin || !link.admin).map(
        ({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Button
              key={href}
              variant={active ? 'default' : 'outline'}
              size="sm"
              accessibilityState={{ selected: active }}
              onPress={() => open(href)}
            >
              <Icon
                className={cn(
                  'size-4',
                  active ? 'text-primary-foreground' : 'text-foreground',
                )}
              />
              <Text>{t(label)}</Text>
            </Button>
          );
        },
      )}
    </View>
  );
}
