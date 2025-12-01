import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, Type } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ content, onChange, placeholder }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [fontSize, setFontSize] = useState('3');
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [currentHighlight, setCurrentHighlight] = useState('transparent');

  // Handle color picker hover - close highlight picker when opening color picker
  const handleColorPickerEnter = () => {
    setShowColorPicker(true);
    setShowHighlightPicker(false);
  };

  // Handle highlight picker hover - close color picker when opening highlight picker
  const handleHighlightPickerEnter = () => {
    setShowHighlightPicker(true);
    setShowColorPicker(false);
  };

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  // Save selection whenever it changes
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0);
      updateToolbarState();
    }
  };

  // Update toolbar state based on current selection
  const updateToolbarState = () => {
    try {
      // Get font size at cursor/selection
      const fontSizeValue = document.queryCommandValue('fontSize');
      console.log('Font size from queryCommandValue:', fontSizeValue);
      
      // fontSize can be returned as '3' or sometimes as pixel values
      // We need to map it to the 1-7 scale
      if (fontSizeValue) {
        // If it's already 1-7, use it directly
        const sizeNum = parseInt(fontSizeValue);
        if (sizeNum >= 1 && sizeNum <= 7) {
          setFontSize(fontSizeValue);
        } else {
          // Otherwise try to get it from the selection's parent element
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            let node: Node | null = selection.getRangeAt(0).startContainer;
            
            // Walk up the DOM to find a font element
            while (node && node !== editorRef.current) {
              if (node instanceof HTMLElement) {
                const size = node.getAttribute('size');
                if (size) {
                  setFontSize(size);
                  return;
                }
                // Check for font tag
                if (node.tagName === 'FONT') {
                  const fontEl = node as HTMLFontElement;
                  if (fontEl.size) {
                    setFontSize(fontEl.size);
                    return;
                  }
                }
              }
              node = node.parentNode;
            }
          }
        }
      }
      
      // Get text color at cursor/selection
      const colorValue = document.queryCommandValue('foreColor');
      console.log('Color from queryCommandValue:', colorValue);
      if (colorValue) {
        // Convert rgb() to hex if needed
        const hexColor = rgbToHex(colorValue);
        setCurrentColor(hexColor);
      }
      
      // Get background color at cursor/selection
      const backColorValue = document.queryCommandValue('backColor');
      console.log('BackColor from queryCommandValue:', backColorValue);
      if (backColorValue) {
        const hexBackColor = rgbToHex(backColorValue);
        setCurrentHighlight(hexBackColor);
      }
    } catch (e) {
      console.error('Error updating toolbar state:', e);
    }
  };

  // Helper function to convert rgb to hex
  const rgbToHex = (rgb: string): string => {
    // If already hex, return it
    if (rgb.startsWith('#')) {
      return rgb;
    }
    
    // Parse rgb(r, g, b) format
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
    }
    
    return rgb;
  };

  // Restore saved selection
  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    // Restore selection before executing command
    restoreSelection();
    
    // Execute command
    document.execCommand(command, false, value);
    
    // Update state if it's fontSize
    if (command === 'fontSize' && value) {
      setFontSize(value);
    }
    
    // Update state if it's foreColor
    if (command === 'foreColor' && value) {
      setCurrentColor(value);
    }
    
    // Update state if it's backColor
    if (command === 'backColor' && value) {
      setCurrentHighlight(value);
    }
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    
    // Save the new selection after command
    saveSelection();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    saveSelection();
  };

  const isCommandActive = (command: string): boolean => {
    return document.queryCommandState(command);
  };

  // Prevent blur when clicking toolbar - save selection before losing focus
  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    // Don't prevent default on input elements - they need to be editable
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT') {
      saveSelection();
      return;
    }
    
    // For buttons, prevent default to avoid losing focus
    e.preventDefault();
    saveSelection();
  };

  // Handle blur - only close if not clicking within toolbar or editor
  const handleEditorBlur = (_e: React.FocusEvent) => {
    // Use setTimeout to allow relatedTarget to be set
    setTimeout(() => {
      const activeElement = document.activeElement;
      const clickedInToolbar = toolbarRef.current?.contains(activeElement);
      const clickedInEditor = editorRef.current?.contains(activeElement);
      
      if (!clickedInToolbar && !clickedInEditor) {
        setIsFocused(false);
        setShowColorPicker(false);
      }
    }, 0);
  };

  // Handle toolbar blur
  const handleToolbarBlur = (_e: React.FocusEvent) => {
    setTimeout(() => {
      const activeElement = document.activeElement;
      const clickedInToolbar = toolbarRef.current?.contains(activeElement);
      const clickedInEditor = editorRef.current?.contains(activeElement);
      
      if (!clickedInToolbar && !clickedInEditor) {
        setIsFocused(false);
        setShowColorPicker(false);
      }
    }, 0);
  };

  return (
    <>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={handleEditorBlur}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        className="p-3 min-h-[200px] max-h-[400px] overflow-y-auto outline-none text-sm text-gray-300"
        style={{
          lineHeight: '1.6',
        }}
        data-placeholder={placeholder}
      />

      {/* Toolbar - only visible when focused, at bottom */}
      {isFocused && (
        <div 
          ref={toolbarRef} 
          className="flex items-center gap-1 p-2 border-t border-dm-border"
          onMouseDown={handleToolbarMouseDown}
          onBlur={handleToolbarBlur}
        >
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={`p-1.5 rounded hover:bg-dm-hover transition-colors ${
            isCommandActive('bold') ? 'bg-dm-hover text-blue-400' : 'text-gray-400'
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={`p-1.5 rounded hover:bg-dm-hover transition-colors ${
            isCommandActive('italic') ? 'bg-dm-hover text-blue-400' : 'text-gray-400'
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={`p-1.5 rounded hover:bg-dm-hover transition-colors ${
            isCommandActive('underline') ? 'bg-dm-hover text-blue-400' : 'text-gray-400'
          }`}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-dm-border mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={`p-1.5 rounded hover:bg-dm-hover transition-colors ${
            isCommandActive('insertUnorderedList') ? 'bg-dm-hover text-blue-400' : 'text-gray-400'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-dm-border mx-1" />
        
        {/* Font Size Input */}
        <div className="flex items-center gap-1">
          <Type className="w-4 h-4 text-gray-400" />
          <input
            type="number"
            min="1"
            max="7"
            value={fontSize}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const value = e.target.value;
              setFontSize(value);
              if (value && parseInt(value) >= 1 && parseInt(value) <= 7) {
                execCommand('fontSize', value);
              }
            }}
            className="w-12 px-1.5 py-1 bg-dm-dark border border-dm-border rounded text-xs text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Text Color */}
        <div 
          className="relative"
          onMouseEnter={handleColorPickerEnter}
          onMouseLeave={() => setShowColorPicker(false)}
        >
          <button
            type="button"
            className="p-1.5 rounded hover:bg-dm-hover transition-colors"
            title="Text Color"
          >
            <span 
              className="font-bold text-base leading-none"
              style={{ color: currentColor }}
            >
              A
            </span>
          </button>
          {showColorPicker && (
            <div 
              className="absolute bottom-full mb-1 right-0 bg-dm-panel border border-dm-border rounded shadow-lg p-2 z-20"
            >
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                width: 'fit-content'
              }}>
                {[
                  { name: 'Black', color: '#000000' },
                  { name: 'Red', color: '#ef4444' },
                  { name: 'Green', color: '#22c55e' },
                  { name: 'Blue', color: '#3b82f6' },
                  { name: 'White', color: '#ffffff' },
                  { name: 'Yellow', color: '#eab308' },
                  { name: 'Orange', color: '#f97316' },
                  { name: 'Purple', color: '#a855f7' },
                ].map(({ name, color }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      console.log('Color clicked:', name, color);
                      execCommand('foreColor', color);
                    }}
                    style={{ 
                      backgroundColor: color,
                      width: '24px',
                      height: '24px',
                      border: '1px solid #3a3b40',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    className="hover:scale-110 transition-transform"
                    title={name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Highlight */}
        <div 
          className="relative"
          onMouseEnter={handleHighlightPickerEnter}
          onMouseLeave={() => setShowHighlightPicker(false)}
        >
          <button
            type="button"
            className="p-1.5 rounded hover:bg-dm-hover transition-colors"
            title="Highlight Color"
          >
            <div 
              className="w-4 h-4 rounded flex items-center justify-center border border-gray-600"
              style={{ backgroundColor: currentHighlight === 'transparent' ? 'transparent' : currentHighlight }}
            >
              <span 
                className="font-bold text-xs leading-none text-gray-300"
              >
                A
              </span>
            </div>
          </button>
          {showHighlightPicker && (
            <div 
              className="absolute bottom-full mb-1 right-0 bg-dm-panel border border-dm-border rounded shadow-lg p-2 z-20"
            >
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                width: 'fit-content'
              }}>
                {[
                  { name: 'None', color: 'transparent' },
                  { name: 'Red', color: '#ef4444' },
                  { name: 'Green', color: '#22c55e' },
                  { name: 'Blue', color: '#3b82f6' },
                  { name: 'Yellow', color: '#eab308' },
                  { name: 'Orange', color: '#f97316' },
                  { name: 'Purple', color: '#a855f7' },
                  { name: 'Pink', color: '#ec4899' },
                ].map(({ name, color }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      execCommand('backColor', color);
                    }}
                    style={{ 
                      backgroundColor: color,
                      width: '24px',
                      height: '24px',
                      border: '1px solid #3a3b40',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    className="hover:scale-110 transition-transform"
                    title={name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          font-style: italic;
        }
        [contenteditable] ul {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          list-style-type: disc;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
          display: list-item;
        }
        [contenteditable] li::marker {
          color: inherit;
        }
        [contenteditable] b, [contenteditable] strong {
          font-weight: 600;
        }
        [contenteditable] i, [contenteditable] em {
          font-style: italic;
        }
        [contenteditable] u {
          text-decoration: underline;
        }
      `}</style>
    </>
  );
};

export default RichTextEditor;
