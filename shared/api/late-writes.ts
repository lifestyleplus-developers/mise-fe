/**
 * Where the app hears that a write was refused because its window had closed
 * (409 `window_closed`, FE Spec §6). The cache reports every such refusal here, no
 * matter which screen made the write, or whether it was replayed after a restart;
 * a feature registers once, where it is defined, and says what the person is told.
 */
export type LateWrite = {
  /** Which kind of write: the mutation key it was made under. */
  mutationKey: readonly unknown[];
  variables: unknown;
  /** What `onMutate` returned, when the write was made in this session. */
  context: unknown;
  /** The mutation's `meta`; a write held across a session carries what the dialog needs. */
  meta: Record<string, unknown> | undefined;
};

type LateWriteHandler = (write: LateWrite) => void;

const handlers = new Set<LateWriteHandler>();

/** Register a handler; the returned function takes it off again. */
export function onLateWrite(handler: LateWriteHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function reportLateWrite(write: LateWrite): void {
  for (const handler of handlers) handler(write);
}
