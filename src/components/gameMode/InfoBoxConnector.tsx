import { useEffect, useState } from 'react';
import { MapElement, AssetElement } from '../../types';

interface InfoBoxConnectorProps {
  element: MapElement;
  infoBoxPosition: { x: number; y: number };
  elementScreenPosition: { x: number; y: number };
  elementSize: number;
  elementHeight?: number; // For assets with different width/height
  elementRotation?: number; // Rotation in degrees for assets
  viewport: { x: number; y: number; zoom: number };
}

const colorMap: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
  brown: '#92400e',
  gray: '#6b7280',
  black: '#000000',
  white: '#ffffff',
  cyan: '#06b6d4',
  magenta: '#d946ef',
  lime: '#84cc16',
  indigo: '#6366f1',
  teal: '#14b8a6'
};

const InfoBoxConnector = ({ element, infoBoxPosition, elementScreenPosition, elementSize, elementHeight, elementRotation = 0, viewport }: InfoBoxConnectorProps) => {
  const [line, setLine] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });

  const isAsset = element.type === 'asset';
  const assetEl = isAsset ? element as AssetElement : null;
  
  console.log('[InfoBoxConnector] Rendering for element:', element.id, 'type:', element.type);
  if (isAsset) {
    console.log('[InfoBoxConnector] Asset highlightColor:', assetEl?.highlightColor);
  }
  
  // Rotation in radians for calculations
  const rotationRad = (elementRotation * Math.PI) / 180;
  
  // Get highlight color - for assets use highlightColor, for tokens use their color
  const highlightColor = (() => {
    if (isAsset && assetEl) {
      const color = assetEl.highlightColor;
      console.log('[InfoBoxConnector] Asset color from element:', color);
      if (color && colorMap[color]) {
        console.log('[InfoBoxConnector] Using color from colorMap:', colorMap[color]);
        return colorMap[color];
      }
      console.log('[InfoBoxConnector] Using default orange');
      return '#f59e0b'; // Default orange for assets
    }
    if (element.type === 'token' && element.color) {
      return colorMap[element.color] || '#3b82f6';
    }
    return '#3b82f6'; // Default blue
  })();

  // Calculate asset frame dimensions in screen space
  const assetWidth = isAsset ? elementSize * viewport.zoom : 0;
  const assetHeight = isAsset ? (elementHeight || elementSize) * viewport.zoom : 0;

  useEffect(() => {
    // Calculate element center in screen coordinates
    const elementCenterX = elementScreenPosition.x;
    const elementCenterY = elementScreenPosition.y;

    // Calculate InfoBox center
    const infoBoxCenterX = infoBoxPosition.x + 192; // Center of w-96 (384px)
    const infoBoxCenterY = infoBoxPosition.y + 150; // Approximate vertical center

    // Calculate direction vector from element center to InfoBox
    const dx = infoBoxCenterX - elementCenterX;
    const dy = infoBoxCenterY - elementCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      setLine({ x1: elementCenterX, y1: elementCenterY, x2: infoBoxCenterX, y2: infoBoxCenterY });
      return;
    }

    // Normalize direction vector
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    let outlineX: number;
    let outlineY: number;
    // Small overlap to ensure line connects cleanly with frame edge
    const overlapIntoFrame = 0;

    if (isAsset) {
      // For assets (rotated rectangles), we need to transform the direction into local space
      const halfW = assetWidth / 2;
      const halfH = assetHeight / 2;
      
      // Rotate direction vector into local (unrotated) space
      const cos = Math.cos(-rotationRad);
      const sin = Math.sin(-rotationRad);
      const localDx = normalizedDx * cos - normalizedDy * sin;
      const localDy = normalizedDx * sin + normalizedDy * cos;
      
      // Find intersection with rectangle edge in local space
      let t = Infinity;
      
      if (localDx !== 0) {
        const tRight = halfW / localDx;
        const tLeft = -halfW / localDx;
        if (tRight > 0) t = Math.min(t, tRight);
        if (tLeft > 0) t = Math.min(t, tLeft);
      }
      if (localDy !== 0) {
        const tBottom = halfH / localDy;
        const tTop = -halfH / localDy;
        if (tBottom > 0) t = Math.min(t, tBottom);
        if (tTop > 0) t = Math.min(t, tTop);
      }
      
      // Apply overlap (negative to go inside frame)
      outlineX = elementCenterX + normalizedDx * (t + overlapIntoFrame);
      outlineY = elementCenterY + normalizedDy * (t + overlapIntoFrame);
    } else {
      // For tokens (circles), calculate point on circle outline
      const tokenRadius = (elementSize / 2) * viewport.zoom;
      outlineX = elementCenterX + normalizedDx * (tokenRadius + overlapIntoFrame);
      outlineY = elementCenterY + normalizedDy * (tokenRadius + overlapIntoFrame);
    }

    setLine({
      x1: outlineX,
      y1: outlineY,
      x2: infoBoxCenterX,
      y2: infoBoxCenterY
    });
  }, [element, elementScreenPosition, infoBoxPosition, elementSize, elementHeight, viewport, isAsset, assetWidth, assetHeight, rotationRad]);

  const strokeWidth = isAsset ? 2 : 3;

  return (
    <svg
      className="fixed inset-0 pointer-events-none w-full h-full"
      style={{ 
        zIndex: 5,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    >
      {/* Asset highlight frame (rotated) */}
      {isAsset && (
        <rect
          x={-assetWidth / 2}
          y={-assetHeight / 2}
          width={assetWidth}
          height={assetHeight}
          fill="none"
          stroke={highlightColor}
          strokeWidth={3}
          opacity={0.9}
          rx={4}
          ry={4}
          transform={`translate(${elementScreenPosition.x}, ${elementScreenPosition.y}) rotate(${elementRotation})`}
        />
      )}
      
      {/* Connector line */}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={highlightColor}
        strokeWidth={strokeWidth}
        opacity={0.8}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default InfoBoxConnector;
