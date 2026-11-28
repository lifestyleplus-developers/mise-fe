import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * One unsent write, kept after its session ended. It is sent only by the person
 * who made it, when they sign in again: sent with anyone else's token it would be
 * recorded as theirs.
 */
export type HeldWrite = {
  ownerId: number;
  ownerName: string;
  businessId: number;
  mutationKey: readonly unknown[];
  variables: unknown;
  /** What the late dialog needs, read while the run or session was still cached. */
  detail: unknown;
};

type HeldWritesStore = {
  items: HeldWrite[];
  hasHydrated: boolean;
  hold: (items: HeldWrite[]) => void;
  /** Remove and return what this person is holding. */
  takeFor: (ownerId: number) => HeldWrite[];
};

export const useHeldWrites = create<HeldWritesStore>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      hold: (items) => set((state) => ({ items: [...state.items, ...items] })),
      takeFor: (ownerId) => {
        const mine = get().items.filter((item) => item.ownerId === ownerId);
        if (mine.length > 0) {
          set((state) => ({
            items: state.items.filter((item) => item.ownerId !== ownerId),
          }));
        }
        return mine;
      },
    }),
    {
      name: 'mise.held-writes',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ items }) => ({ items }),
      onRehydrateStorage: () => () => {
        useHeldWrites.setState({ hasHydrated: true });
      },
    },
  ),
);
