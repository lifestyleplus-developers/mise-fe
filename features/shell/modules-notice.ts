import { create } from 'zustand';

type ModulesNoticeStore = {
  notice: string | null;
  setNotice: (notice: string) => void;
  clearNotice: () => void;
};

/**
 * A one-off message waiting on Modules, e.g. "Attendance isn't turned on for
 * ZamZam." A screen whose module has gone off (404) sets it and goes back.
 */
export const useModulesNotice = create<ModulesNoticeStore>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
}));
