import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { format, useT } from '@/shared/i18n';
import { dropIndex, moveItem, shiftFor } from '@/shared/lib/reorder';
import { cn } from '@/shared/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  GripVertical,
} from 'lucide-react-native';
import * as React from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';

type SortableAction = {
  key: string;
  label: string;
  /** Drawn in red, for something that cannot be taken back. */
  destructive?: boolean;
  onPress: () => void;
};

type SortableListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string | number;
  /** The row's name for the menu title and screen readers. */
  labelOf: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Called with the whole list in its new order. */
  onReorder: (items: T[]) => void;
  /** Entries added to the menu after Move up and Move down, e.g. Remove. */
  actionsFor?: (item: T, index: number) => SortableAction[];
  disabled?: boolean;
  /**
   * Tells the screen a drag has begun or ended, so it can stop its own
   * scrolling while a finger is moving a row.
   */
  onDragChange?: (dragging: boolean) => void;
};

type Drag = { from: number; to: number };

/**
 * A list whose rows can be put in order. Hold the grip and drag; or open a
 * row's menu for Move up and Move down, which is also how long moves are made
 * (a drag does not scroll the page). A screen reader gets the same two moves
 * as adjust actions on the grip.
 */
function SortableList<T>({
  items,
  keyOf,
  labelOf,
  renderItem,
  onReorder,
  actionsFor,
  disabled = false,
  onDragChange,
}: SortableListProps<T>) {
  const t = useT();
  const [heights, setHeights] = React.useState<Record<string, number>>({});
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [menuIndex, setMenuIndex] = React.useState<number | null>(null);

  const rowHeights = items.map((item) => heights[String(keyOf(item))] ?? 0);

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || to === from) return;
    onReorder(moveItem(items, from, to));
    AccessibilityInfo.announceForAccessibility(
      format(t('sort.moved'), {
        n: String(to + 1),
        total: String(items.length),
      }),
    );
  }

  function endDrag() {
    setDrag(null);
    onDragChange?.(false);
  }

  const menuItem = menuIndex === null ? undefined : items[menuIndex];
  const menuActions: SortableAction[] =
    menuItem === undefined || menuIndex === null
      ? []
      : (actionsFor?.(menuItem, menuIndex) ?? []);

  return (
    <>
      <View className="shadow-card border-border bg-card overflow-hidden rounded-3xl border">
        {items.map((item, index) => {
          const key = String(keyOf(item));
          const top = rowHeights.slice(0, index).reduce((a, b) => a + b, 0);
          const total = rowHeights.reduce((a, b) => a + b, 0);
          return (
            <SortableRow
              key={key}
              index={index}
              label={labelOf(item)}
              first={index === 0}
              dragging={drag?.from === index}
              shift={
                drag
                  ? shiftFor(index, drag.from, drag.to, rowHeights[drag.from])
                  : 0
              }
              minDy={-top}
              maxDy={total - top - rowHeights[index]}
              disabled={disabled}
              onHeight={(height) =>
                setHeights((previous) =>
                  previous[key] === height
                    ? previous
                    : { ...previous, [key]: height },
                )
              }
              onDragStart={() => {
                setDrag({ from: index, to: index });
                onDragChange?.(true);
              }}
              onDragMove={(dy) => {
                const to = dropIndex(rowHeights, index, dy);
                setDrag((current) =>
                  current && current.to !== to ? { ...current, to } : current,
                );
              }}
              onDragEnd={(dy) => {
                const to = dropIndex(rowHeights, index, dy);
                endDrag();
                move(index, to);
              }}
              onDragCancel={endDrag}
              onMove={(delta) => move(index, index + delta)}
              onOpenMenu={() => setMenuIndex(index)}
            >
              {renderItem(item, index)}
            </SortableRow>
          );
        })}
      </View>

      <BottomSheet
        visible={menuItem !== undefined}
        title={menuItem === undefined ? '' : labelOf(menuItem)}
        onDismiss={() => setMenuIndex(null)}
        footer={
          <Button
            variant="outline"
            className="w-full"
            onPress={() => setMenuIndex(null)}
          >
            <Text>{t('admin.cancel')}</Text>
          </Button>
        }
      >
        <View className="border-border bg-card overflow-hidden rounded-3xl border">
          <MenuRow
            icon={ArrowUp}
            label={t('sort.move-up')}
            disabled={menuIndex === 0}
            onPress={() => {
              const from = menuIndex;
              setMenuIndex(null);
              if (from !== null) move(from, from - 1);
            }}
          />
          <MenuRow
            icon={ArrowDown}
            label={t('sort.move-down')}
            divider
            disabled={menuIndex === items.length - 1}
            onPress={() => {
              const from = menuIndex;
              setMenuIndex(null);
              if (from !== null) move(from, from + 1);
            }}
          />
          {menuActions.map((action) => (
            <MenuRow
              key={action.key}
              label={action.label}
              destructive={action.destructive}
              divider
              onPress={() => {
                setMenuIndex(null);
                action.onPress();
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

type MenuRowProps = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  divider?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

function MenuRow({
  label,
  icon: Icon,
  divider = false,
  disabled = false,
  destructive = false,
  onPress,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-14 flex-row items-center gap-3 px-4 py-2',
        divider && 'border-border border-t',
        disabled ? 'opacity-40' : 'active:bg-accent',
      )}
    >
      {Icon ? <Icon className="text-foreground size-5" /> : null}
      <Text
        className={cn(
          'font-sans-medium min-w-0 flex-1 text-[16px]',
          destructive && 'text-destructive-soft-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SortableRowProps = {
  index: number;
  label: string;
  first: boolean;
  /** This row is the one being dragged. */
  dragging: boolean;
  /** How far a row that is not being dragged moves to make room. */
  shift: number;
  /** The furthest the row may be dragged up and down, so it stays in the list. */
  minDy: number;
  maxDy: number;
  disabled: boolean;
  onHeight: (height: number) => void;
  onDragStart: () => void;
  onDragMove: (dy: number) => void;
  onDragEnd: (dy: number) => void;
  onDragCancel: () => void;
  onMove: (delta: -1 | 1) => void;
  onOpenMenu: () => void;
  children: React.ReactNode;
};

function SortableRow(props: SortableRowProps) {
  const t = useT();
  const { first, dragging, shift, disabled, label, children } = props;
  const [offset] = React.useState(() => new Animated.Value(0));
  /** Where the finger was on the screen when it took hold of the grip. */
  const startY = React.useRef(0);

  /** How far the finger has moved, kept inside the list. */
  const travel = (pageY: number) =>
    Math.min(props.maxDy, Math.max(props.minDy, pageY - startY.current));

  return (
    <Animated.View
      onLayout={(event) => props.onHeight(event.nativeEvent.layout.height)}
      style={{
        transform: [{ translateY: dragging ? offset : shift }],
        zIndex: dragging ? 10 : 0,
        elevation: dragging ? 4 : 0,
      }}
      className={cn(
        'flex-row items-center',
        !first && 'border-border border-t',
        dragging ? 'bg-accent' : 'bg-card',
      )}
    >
      <View
        onStartShouldSetResponder={() => !disabled}
        // Once a row is held, a parent scroller must not take the gesture.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          startY.current = event.nativeEvent.pageY;
          props.onDragStart();
        }}
        onResponderMove={(event) => {
          const dy = travel(event.nativeEvent.pageY);
          offset.setValue(dy);
          props.onDragMove(dy);
        }}
        onResponderRelease={(event) => {
          const dy = travel(event.nativeEvent.pageY);
          offset.setValue(0);
          props.onDragEnd(dy);
        }}
        onResponderTerminate={() => {
          offset.setValue(0);
          props.onDragCancel();
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={format(t('sort.reorder'), { name: label })}
        accessibilityHint={t('sort.reorder-hint')}
        accessibilityState={{ disabled }}
        accessibilityActions={[
          { name: 'increment', label: t('sort.move-down') },
          { name: 'decrement', label: t('sort.move-up') },
        ]}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          if (event.nativeEvent.actionName === 'increment') props.onMove(1);
          if (event.nativeEvent.actionName === 'decrement') props.onMove(-1);
        }}
        className={cn(
          'size-11 shrink-0 items-center justify-center',
          disabled && 'opacity-40',
        )}
      >
        <GripVertical className="text-muted-foreground size-5" />
      </View>
      <View className="min-w-0 flex-1 py-3">{children}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={format(t('sort.menu'), { name: label })}
        disabled={disabled}
        onPress={props.onOpenMenu}
        className={cn(
          'active:bg-accent size-11 shrink-0 items-center justify-center rounded-full',
          disabled && 'opacity-40',
        )}
      >
        <EllipsisVertical className="text-foreground size-5" />
      </Pressable>
    </Animated.View>
  );
}

export { SortableList };
export type { SortableAction, SortableListProps };
