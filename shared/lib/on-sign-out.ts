/**
 * What a feature that keeps its own data on the phone clears when the person signs
 * out. A feature registers once, where it is defined; sign-out runs them all and
 * never needs to know which features exist.
 */
type SignOutHandler = (userId: number | undefined) => void;

const handlers = new Set<SignOutHandler>();

/** Register a clean-up; the returned function takes it off again. */
export function onSignOut(handler: SignOutHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Run every registered clean-up, for the person who is signing out. */
export function runSignOutHandlers(userId: number | undefined): void {
  for (const handler of handlers) handler(userId);
}
