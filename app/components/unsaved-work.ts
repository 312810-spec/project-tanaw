"use client";
import { useEffect } from "react";

// Marker stays on the actual form, so unrelated tasks do not share draft fields.
export function confirmLeavingWork(root: HTMLElement | null = document.body) {
  if (!root?.querySelector('[data-unsaved="true"]')) return true;
  return window.confirm('There are unsent edits in this workspace. This change may replace their form. Cancel to copy or finish them; continue only if you are ready to leave these edits.');
}
export function clearFormDirty(form: HTMLFormElement) { delete form.dataset.unsaved; }
export function useUnsavedWork() {
  useEffect(() => {
    const mark = (event: Event) => {
      const element = event.target;
      if (element instanceof HTMLElement) {
        const form = element.closest('form, [data-work-draft]');
        if (form instanceof HTMLElement) form.dataset.unsaved = 'true';
      }
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (document.querySelector('[data-unsaved="true"]')) { event.preventDefault(); event.returnValue = ''; }
    };
    document.addEventListener('input', mark, true); document.addEventListener('change', mark, true);
    const link = (event: MouseEvent) => {
      const anchor = event.target instanceof HTMLElement ? event.target.closest('a[href]') : null;
      if (anchor && !anchor.getAttribute('href')?.startsWith('#') && !confirmLeavingWork()) event.preventDefault();
    };
    document.addEventListener('click', link, true);
    window.addEventListener('beforeunload', warn);
    return () => { document.removeEventListener('input', mark, true); document.removeEventListener('change', mark, true); window.removeEventListener('beforeunload', warn); document.removeEventListener('click', link, true); };
  }, []);
}
