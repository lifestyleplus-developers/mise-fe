import type { Href } from 'expo-router';

/**
 * A tapped push, kept until the signed-in shell can open it (NTF-01
 * `signedOut`: a tap before sign-in opens after it). Sign-out drops it, so it
 * cannot open for the next person.
 */
let pending: Href | null = null;
const listeners = new Set<() => void>();

export function offerTap(target: Href): void {
  pending = target;
  for (const listener of listeners) listener();
}

export function takeTap(): Href | null {
  const target = pending;
  pending = null;
  return target;
}

export function dropTap(): void {
  pending = null;
}

/** Called when a tap is offered; the returned function unsubscribes. */
export function onTapOffered(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
