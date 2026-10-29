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
 * Where a dragged row lands. The other rows keep their layout while one is lifted, so
 * its new place is found from where its leading edge has got to: its top edge when it
 * is dragged up, its bottom edge when dragged down. A row is passed once that edge goes
 * beyond the row's middle.
 *
 * It is the edge, not the dragged row's own middle, that decides. A row taller than its
 * neighbours, held at the end of the list, has its middle already beyond theirs and
 * could never pass them; its edge always can. `heights` are the rows' heights in their
 * current order.
 */
export function dropIndex(
  heights: readonly number[],
  from: number,
  dy: number,
): number {
  let top = 0;
  const tops: number[] = [];
  for (const height of heights) {
    tops.push(top);
    top += height;
  }
  const middle = (index: number) => tops[index] + heights[index] / 2;

  if (dy < 0) {
    const edge = tops[from] + dy;
    let to = 0;
    for (let index = 0; index < from; index++) {
      if (middle(index) < edge) to = index + 1;
    }
    return to;
  }
  if (dy > 0) {
    const edge = tops[from] + heights[from] + dy;
    let to = from;
    for (let index = from + 1; index < heights.length; index++) {
      if (middle(index) <= edge) to = index;
    }
    return to;
  }
  return from;
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
