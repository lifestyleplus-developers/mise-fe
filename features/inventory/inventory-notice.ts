import { create } from 'zustand';

type InventoryNoticeStore = {
  notice: string | null;
  setNotice: (notice: string) => void;
  clearNotice: () => void;
};

/** A one-off message waiting on the item list, e.g. "Chicken archived." */
export const useInventoryNotice = create<InventoryNoticeStore>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
}));
