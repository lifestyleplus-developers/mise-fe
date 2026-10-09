import { format, useT } from '@/shared/i18n';
import { create } from 'zustand';

type OutletNotice = { kind: 'added' | 'renamed' | 'archived'; name: string };

type OutletNoticeStore = {
  notice: OutletNotice | null;
  setNotice: (notice: OutletNotice) => void;
  clearNotice: () => void;
};

/** The confirmation shown on the list (and edit) screen after a change. */
export const useOutletNotice = create<OutletNoticeStore>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
}));

const NOTICE_KEY = {
  added: 'outlets.added',
  renamed: 'outlets.renamed',
  archived: 'outlets.archived-done',
} as const;

/** The notice as text in the current language, or null. */
export function useOutletNoticeText(): string | null {
  const notice = useOutletNotice((state) => state.notice);
  const t = useT();
  return notice
    ? format(t(NOTICE_KEY[notice.kind]), { name: notice.name })
    : null;
}
