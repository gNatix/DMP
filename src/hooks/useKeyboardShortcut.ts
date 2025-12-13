import { useEffect } from 'react';

/**
 * Check if user is focused on a text input field
 */
const isTextInputFocused = (): boolean => {
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  
  const tagName = activeEl.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    activeEl.hasAttribute('contenteditable') ||
    activeEl.getAttribute('contenteditable') === 'true' ||
    activeEl.getAttribute('role') === 'textbox' ||
    activeEl.classList.contains('ProseMirror')
  );
};

/**
 * Hook for registering keyboard shortcuts that automatically respects text input state
 * @param key - The keyboard key to listen for (case-insensitive)
 * @param callback - Function to call when shortcut is pressed
 * @param options - Additional options
 */
export const useKeyboardShortcut = (
  key: string,
  callback: () => void,
  options?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    preventDefault?: boolean;
  }
) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if user is typing in a text field
      if (isTextInputFocused()) return;

      // Check if key matches
      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      // Check modifier keys
      const ctrlMatch = options?.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
      const shiftMatch = options?.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = options?.alt ? e.altKey : !e.altKey;

      if (ctrlMatch && shiftMatch && altMatch) {
        if (options?.preventDefault !== false) {
          e.preventDefault();
        }
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [key, callback, options]);
};
