/** A copy of `items` with the one at `from` moved to `to`. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Where a dragged row lands. The other rows keep their layout while one is
 * lifted, so its new place is the number of them whose middle sits above its
 * own middle. `heights` are the rows' heights in their current order.
 */
export function dropIndex(
  heights: readonly number[],
  from: number,
  dy: number,
): number {
  let top = 0;
  let center = 0;
  const middles: number[] = [];
  heights.forEach((height, index) => {
    if (index === from) center = top + height / 2 + dy;
    else middles.push(top + height / 2);
    top += height;
  });
  return middles.filter((middle) => middle < center).length;
}

/**
 * How far a row that is not being dragged moves to make room: up by the
 * dragged row's height when it is passed on the way down, down when passed on
 * the way up.
 */
export function shiftFor(
  index: number,
  from: number,
  to: number,
  draggedHeight: number,
): number {
  if (from < to && index > from && index <= to) return -draggedHeight;
  if (to < from && index >= to && index < from) return draggedHeight;
  return 0;
}
