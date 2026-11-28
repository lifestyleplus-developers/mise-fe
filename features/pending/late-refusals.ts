import { create } from 'zustand';

/**
 * Writes the platform refused because the window had closed, grouped so a
 * reconnect that refuses five answers says so once. One group is one dialog
 * (NTF-01: one dialog per kind). Held in memory only: it is shown now or not at
 * all, and sign-out drops it.
 */
export type LateGroup =
  | {
      id: string;
      kind: 'answers';
      /** The run's checklist. */
      name: string;
      closeIso: string | null;
      /** Texts of the tasks answered for the first time. */
      answers: string[];
      /** Texts of the tasks whose earlier answer was being changed. */
      changes: string[];
    }
  | {
      id: string;
      kind: 'marks';
      closeIso: string | null;
      names: string[];
    }
  | {
      id: string;
      kind: 'photo';
      closeIso: string | null;
      /** Photographs already in, out of the check's prompts; null when not known. */
      progress: { sent: number; total: number } | null;
    };

type LateStore = {
  groups: LateGroup[];
  /** Add to the group with this id, or start it. */
  add: (
    id: string,
    make: () => LateGroup,
    update: (group: LateGroup) => LateGroup,
  ) => void;
  /** The person read the first one. */
  dismissFirst: () => void;
  clear: () => void;
};

export const useLateRefusals = create<LateStore>((set) => ({
  groups: [],
  add: (id, make, update) =>
    set((state) =>
      state.groups.some((group) => group.id === id)
        ? {
            groups: state.groups.map((group) =>
              group.id === id ? update(group) : group,
            ),
          }
        : { groups: [...state.groups, make()] },
    ),
  dismissFirst: () => set((state) => ({ groups: state.groups.slice(1) })),
  clear: () => set({ groups: [] }),
}));
