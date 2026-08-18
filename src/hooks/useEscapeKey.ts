import { useEffect } from 'react';

/** Closes a modal/overlay on Escape while it's open. Shared by SavePlayModal,
 *  ExportModal and PostFormModal (B-43) — each previously had no Escape
 *  handling at all. */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
}
