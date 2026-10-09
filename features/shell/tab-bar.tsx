import { useMe } from '@/features/auth/use-me';
import { TAB_ICON, TAB_LABEL, visibleTabs } from '@/features/shell/tabs';
import { Text } from '@/shared/components/ui/text';
import { useT } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The floating pill (FE Spec §2). */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { data: me } = useMe();
  const insets = useSafeAreaInsets();
  const t = useT();

  if (!me) return null;

  const activeKey = state.routes[state.index]?.key;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-1.5 z-20"
      style={{ bottom: 16 + insets.bottom }}
    >
      <View
        accessibilityRole="tablist"
        aria-label={t('nav.tabs')}
        className="border-nav-border bg-nav-surface flex-row items-stretch rounded-[1.75rem] border p-1 shadow-sm shadow-black/10"
      >
        {visibleTabs(me).map((id) => {
          const route = state.routes.find((r) => r.name === id);
          if (!route) return null;
          const focused = route.key === activeKey;
          const Icon = TAB_ICON[id];

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route!.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route!.name, route!.params);
            }
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              className={cn(
                'min-h-[56px] min-w-11 flex-1 items-center justify-start gap-0.5 rounded-3xl border px-0.5 pt-2 pb-1.5',
                focused
                  ? 'border-nav-active bg-nav-segment'
                  : 'border-transparent',
              )}
            >
              <Icon
                className={cn(
                  'size-[22px] shrink-0',
                  focused ? 'text-nav-active' : 'text-nav-foreground',
                )}
                strokeWidth={focused ? 2.4 : 1.9}
              />
              <Text
                className={cn(
                  'font-sans-semibold w-full text-center text-[12px] leading-[1.15] tracking-[-0.01em]',
                  focused ? 'text-nav-active' : 'text-nav-foreground',
                )}
              >
                {t(TAB_LABEL[id])}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
