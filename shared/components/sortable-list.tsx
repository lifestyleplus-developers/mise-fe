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
  /** Greyed out and not tappable; `hint` should say why. */
  disabled?: boolean;
  /** A line under the menu, e.g. why an action is disabled. */
  hint?: string;
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
  /** How far the held row has moved. Only one row is ever held. */
  const [offset] = React.useState(() => new Animated.Value(0));
  /** The row held and where the finger was when it took hold. Not for rendering. */
  const held = React.useRef<{ from: number; startY: number } | null>(null);

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
    held.current = null;
    offset.setValue(0);
    setDrag(null);
    onDragChange?.(false);
  }

  /** The row under a touch `y` points down from the top of the list. */
  function rowAt(y: number): number {
    let top = 0;
    for (let index = 0; index < rowHeights.length; index++) {
      top += rowHeights[index];
      if (y < top) return index;
    }
    return -1;
  }

  /** How far the finger has moved since it took hold, kept inside the list. */
  function travel(pageY: number, from: number, startY: number): number {
    const above = rowHeights.slice(0, from).reduce((a, b) => a + b, 0);
    const total = rowHeights.reduce((a, b) => a + b, 0);
    const min = -above;
    const max = total - above - rowHeights[from];
    return Math.min(max, Math.max(min, pageY - startY));
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
          return (
            <SortableRow
              key={key}
              label={labelOf(item)}
              first={index === 0}
              dragging={drag?.from === index}
              offset={offset}
              shift={
                drag
                  ? shiftFor(index, drag.from, drag.to, rowHeights[drag.from])
                  : 0
              }
              disabled={disabled}
              onHeight={(height) =>
                setHeights((previous) =>
                  previous[key] === height
                    ? previous
                    : { ...previous, [key]: height },
                )
              }
              onMove={(delta) => move(index, index + delta)}
              onOpenMenu={() => setMenuIndex(index)}
            >
              {renderItem(item, index)}
            </SortableRow>
          );
        })}
        {/*
          The strip that takes the touch. It sits over the grips and never moves: a
          touch handled by the row being dragged is handled by something that is moving
          under the finger, which is what made dragging up give out after a row.
        */}
        <View
          accessible={false}
          importantForAccessibility="no"
          pointerEvents={disabled ? 'none' : 'auto'}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 44,
          }}
          onStartShouldSetResponder={() => !disabled}
          // Once a row is held, a parent scroller must not take the gesture.
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            const from = rowAt(event.nativeEvent.locationY);
            if (from < 0) return false;
            held.current = { from, startY: event.nativeEvent.pageY };
            setDrag({ from, to: from });
            onDragChange?.(true);
            // Returning true stops a parent scroller taking the touch back.
            return true;
          }}
          onResponderMove={(event) => {
            const gesture = held.current;
            if (!gesture) return;
            const dy = travel(
              event.nativeEvent.pageY,
              gesture.from,
              gesture.startY,
            );
            offset.setValue(dy);
            const to = dropIndex(rowHeights, gesture.from, dy);
            setDrag((current) =>
              current && current.to !== to ? { ...current, to } : current,
            );
          }}
          onResponderRelease={(event) => {
            const gesture = held.current;
            if (!gesture) return;
            const dy = travel(
              event.nativeEvent.pageY,
              gesture.from,
              gesture.startY,
            );
            const to = dropIndex(rowHeights, gesture.from, dy);
            endDrag();
            move(gesture.from, to);
          }}
          onResponderTerminate={endDrag}
        />
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
              disabled={action.disabled}
              divider
              onPress={() => {
                setMenuIndex(null);
                action.onPress();
              }}
            />
          ))}
        </View>
        {menuActions
          .filter((action) => action.hint)
          .map((action) => (
            <Text
              key={action.key}
              className="mt-2 px-1 text-[13px] leading-snug"
            >
              {action.hint}
            </Text>
          ))}
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
  label: string;
  first: boolean;
  /** This row is the one being dragged. */
  dragging: boolean;
  /** How far the held row has moved; this row follows it while it is the one held. */
  offset: Animated.Value;
  /** How far a row that is not being dragged moves to make room. */
  shift: number;
  disabled: boolean;
  onHeight: (height: number) => void;
  onMove: (delta: -1 | 1) => void;
  onOpenMenu: () => void;
  children: React.ReactNode;
};

function SortableRow(props: SortableRowProps) {
  const t = useT();
  const { first, dragging, shift, offset, disabled, label, children } = props;

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
      {/* The grip is only for show and for a screen reader; the touch is taken by the
          strip over the list. */}
      <View
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
