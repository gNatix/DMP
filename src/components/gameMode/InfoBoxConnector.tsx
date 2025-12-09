import { useEffect, useState } from 'react';
import { MapElement } from '../../types';

interface InfoBoxConnectorProps {
  element: MapElement;
  infoBoxPosition: { x: number; y: number };
  elementScreenPosition: { x: number; y: number };
  elementSize: number;
  viewport: { x: number; y: number; zoom: number };
}

const InfoBoxConnector = ({ element, infoBoxPosition, elementScreenPosition, elementSize, viewport }: InfoBoxConnectorProps) => {
  const [line, setLine] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });

  useEffect(() => {
    // Calculate token center in screen coordinates
    const tokenCenterX = elementScreenPosition.x;
    const tokenCenterY = elementScreenPosition.y;

    // Calculate InfoBox center
    const infoBoxCenterX = infoBoxPosition.x + 192; // Center of w-96 (384px)
    const infoBoxCenterY = infoBoxPosition.y + 150; // Approximate vertical center

    // Calculate token radius in screen space (accounting for zoom)
    const tokenRadius = (elementSize / 2) * viewport.zoom;

    // Calculate direction vector from token center to InfoBox
    const dx = infoBoxCenterX - tokenCenterX;
    const dy = infoBoxCenterY - tokenCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize direction vector
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    // Calculate point on token outline (edge of circle/token)
    // Add a small margin (4px) to pull the line start point away from token
    const marginOffset = 4;
    const outlineX = tokenCenterX + normalizedDx * (tokenRadius + marginOffset);
    const outlineY = tokenCenterY + normalizedDy * (tokenRadius + marginOffset);

    setLine({
      x1: outlineX,
      y1: outlineY,
      x2: infoBoxCenterX,
      y2: infoBoxCenterY
    });
  }, [elementScreenPosition, infoBoxPosition, elementSize, viewport]);

  // Get line color and width based on element
  const getLineStyle = () => {
    if (element.type === 'token' && element.color) {
      const colorMap: Record<string, string> = {
        red: '#ef4444',
        blue: '#3b82f6',
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
        teal: '#14b8a6',
        green: '#22c55e'
      };
      return {
        stroke: colorMap[element.color] || '#3b82f6',
        strokeWidth: 3 // Match token outline thickness
      };
    }
    return {
      stroke: '#3b82f6',
      strokeWidth: 3
    };
  };

  const lineStyle = getLineStyle();

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
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={lineStyle.stroke}
        strokeWidth={lineStyle.strokeWidth}
        opacity={0.8}
        strokeLinecap="round"
      />
    </svg>
  );
};

export default InfoBoxConnector;
