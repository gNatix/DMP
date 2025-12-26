# Common Re-occurring Bugs & Solutions

This document contains common bugs that tend to re-appear and their proven solutions.

---

## 1. Browser Native Image Drag Interferes with Custom Drag/Scale/Rotate

### Symptom
When trying to scale or rotate elements (especially those with images), the browser's native "forbidden" cursor (🚫) appears, and the operation gets stuck. This happens because the browser tries to initiate a native image drag operation.

### Cause
Browsers have built-in drag-and-drop functionality for images. When mousedown happens near an image element, the browser may intercept the event and start a native drag operation, showing the "not-allowed" cursor.

### Solution
Apply ALL of the following to any element that could trigger this issue:

#### For `<img>` elements:
```tsx
<img
  src={imageUrl}
  alt={name}
  style={{
    // ... other styles
    userSelect: 'none',
    WebkitUserDrag: 'none',
  } as React.CSSProperties}
  draggable={false}
  onDragStart={(e) => e.preventDefault()}
/>
```

#### For container `<div>` elements:
```tsx
<div
  style={{
    // ... other styles
    userSelect: 'none',
  }}
>
```

#### For handle elements (resize/rotate):
```tsx
<div
  style={{
    // ... other styles
    pointerEvents: 'auto',
  }}
  draggable={false}
  onDragStart={(e) => e.preventDefault()}
/>
```

### Key Properties Explained:
- `draggable={false}` - Disables HTML5 native drag
- `onDragStart={(e) => e.preventDefault()}` - Prevents any remaining drag behavior
- `userSelect: 'none'` - Prevents text/element selection
- `WebkitUserDrag: 'none'` - Safari/Chrome specific: prevents native drag ghost image
- `pointerEvents: 'auto'` - Ensures the element receives mouse events

### Files Affected (as of Dec 2025):
- `src/components/Canvas.tsx` - Asset rendering, resize handles, rotation handles

---

## 2. [Template for future bugs]

### Symptom
[Describe what the user sees]

### Cause
[Explain the root cause]

### Solution
```tsx
// Code solution here
```

### Files Affected:
- [List of files]

---
