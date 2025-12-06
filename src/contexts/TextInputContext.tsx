import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TextInputContextType {
  isUserTyping: boolean;
}

const TextInputContext = createContext<TextInputContextType | undefined>(undefined);

export const useTextInput = () => {
  const context = useContext(TextInputContext);
  if (!context) {
    throw new Error('useTextInput must be used within TextInputProvider');
  }
  return context;
};

interface TextInputProviderProps {
  children: ReactNode;
}

export const TextInputProvider: React.FC<TextInputProviderProps> = ({ children }) => {
  const [isUserTyping, setIsUserTyping] = useState(false);

  useEffect(() => {
    const checkTextInputFocus = () => {
      const activeEl = document.activeElement;
      if (!activeEl) {
        setIsUserTyping(false);
        return;
      }

      const tagName = activeEl.tagName.toLowerCase();
      const isTextInput = 
        tagName === 'input' ||
        tagName === 'textarea' ||
        activeEl.hasAttribute('contenteditable') ||
        activeEl.getAttribute('role') === 'textbox' ||
        activeEl.classList.contains('ProseMirror') || // Rich text editor
        // Check if it's an input with type text, search, etc (not checkbox, radio, etc)
        (tagName === 'input' && !['checkbox', 'radio', 'submit', 'button', 'image', 'file'].includes(
          (activeEl as HTMLInputElement).type
        ));

      setIsUserTyping(isTextInput);
    };

    // Check on focus/blur events
    const handleFocusChange = () => {
      checkTextInputFocus();
    };

    // Also check periodically as a fallback (some inputs might not fire focus events)
    const interval = setInterval(checkTextInputFocus, 100);

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    
    // Initial check
    checkTextInputFocus();

    return () => {
      clearInterval(interval);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  return (
    <TextInputContext.Provider value={{ isUserTyping }}>
      {children}
    </TextInputContext.Provider>
  );
};
