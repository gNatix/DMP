import { useEffect } from 'react';
import { useTextInput } from '../contexts/TextInputContext';

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
  const { isUserTyping } = useTextInput();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if user is typing in a text field
      if (isUserTyping) return;

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
  }, [key, callback, isUserTyping, options]);
};
