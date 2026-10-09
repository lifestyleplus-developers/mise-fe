import { create } from 'zustand';

type HomeNoticeStore = {
  notice: string | null;
  setNotice: (notice: string) => void;
  clearNotice: () => void;
};

/** A one-off message waiting on Home, e.g. "Kitchen Opening has closed." */
export const useHomeNotice = create<HomeNoticeStore>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
}));
