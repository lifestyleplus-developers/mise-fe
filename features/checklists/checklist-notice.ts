import { format, useT } from '@/shared/i18n';
import { create } from 'zustand';

type ChecklistNotice = { kind: 'archived' | 'restored'; name: string };

type ChecklistNoticeStore = {
  notice: ChecklistNotice | null;
  setNotice: (notice: ChecklistNotice) => void;
  clearNotice: () => void;
};

/**
 * What the admin list shows once after a change made on another screen: the
 * editor archives or restores a checklist and goes back, and the list says so.
 */
export const useChecklistNotice = create<ChecklistNoticeStore>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
}));

const NOTICE_KEY = {
  archived: 'checklists.archived-done',
  restored: 'checklists.restored',
} as const;

/** The notice as text in the current language, or null. */
export function useChecklistNoticeText(): string | null {
  const notice = useChecklistNotice((state) => state.notice);
  const t = useT();
  return notice
    ? format(t(NOTICE_KEY[notice.kind]), { name: notice.name })
    : null;
}
