// src/utils/canvas.ts - Complete utility file for canvas operations

// Main thumbnail generation function - direct canvas capture
export function generatePlayThumbnail(canvasRef: React.RefObject<any>): Promise<string> {
  return new Promise((resolve) => {
    if (!canvasRef.current) {
      console.log('No canvas ref');
      resolve('');
      return;
    }

    // Find the actual canvas element
    const canvas = document.querySelector('#play-canvas') as HTMLCanvasElement;
    if (!canvas) {
      console.log('No canvas element found');
      resolve('');
      return;
    }

    try {
      // Wait a moment to ensure any pending renders are complete
      setTimeout(() => {
        // Create thumbnail canvas
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        
        if (!thumbnailCtx) {
          resolve('');
          return;
        }

        // Set thumbnail dimensions (same aspect ratio as original)
        const thumbnailWidth = 300;
        const thumbnailHeight = 200;
        thumbnailCanvas.width = thumbnailWidth;
        thumbnailCanvas.height = thumbnailHeight;

        // Directly copy the current canvas content (which is already rendered correctly)
        thumbnailCtx.drawImage(
          canvas,
          0, 0, canvas.width, canvas.height,  // Source dimensions
          0, 0, thumbnailWidth, thumbnailHeight  // Destination dimensions
        );

        // Convert to base64
        const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/png', 0.9);
        console.log('Generated thumbnail size:', thumbnailDataUrl.length);
        resolve(thumbnailDataUrl);
        
      }, 500); // Increased delay to ensure canvas is fully rendered
      
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      resolve('');
    }
  });
}

// Alternative function if the main one doesn't work - force a render first
export function generatePlayThumbnailWithRender(canvasRef: React.RefObject<any>): Promise<string> {
  return new Promise((resolve) => {
    if (!canvasRef.current) {
      resolve('');
      return;
    }

    const canvas = document.querySelector('#play-canvas') as HTMLCanvasElement;
    if (!canvas) {
      resolve('');
      return;
    }

    try {
      // Force the canvas to redraw with current data
      const paths = canvasRef.current.getPaths();
      const icons = canvasRef.current.getIcons();
      
      console.log('Thumbnail generation - Paths:', paths.length, 'Icons:', icons.length);
      
      // Trigger a manual redraw by calling the canvas's internal draw method
      // This ensures the canvas is showing the latest state
      const ctx = canvas.getContext('2d');
      if (ctx && canvasRef.current.drawScene) {
        canvasRef.current.drawScene(ctx, paths, icons);
      }
      
      // Wait for the redraw to complete
      setTimeout(() => {
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        
        if (!thumbnailCtx) {
          resolve('');
          return;
        }

        const thumbnailWidth = 300;
        const thumbnailHeight = 200;
        thumbnailCanvas.width = thumbnailWidth;
        thumbnailCanvas.height = thumbnailHeight;

        // Copy the rendered canvas
        thumbnailCtx.drawImage(
          canvas,
          0, 0, canvas.width, canvas.height,
          0, 0, thumbnailWidth, thumbnailHeight
        );

        const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/png', 0.9);
        resolve(thumbnailDataUrl);
        
      }, 200);
      
    } catch (error) {
      console.error('Error generating thumbnail with render:', error);
      resolve('');
    }
  });
}

// Helper function to convert SVG path data to stroke data for perfect-freehand
export function getSvgPathFromStroke(stroke: number[][], closed = true): string {
  if (!stroke.length) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  if (closed) {
    d.push('Z');
  }

  return d.join(' ');
}

// Utility function to calculate distance between two points
export function calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}

// Utility function to normalize a vector
export function normalizeVector(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

// Utility function to get perpendicular vector
export function getPerpendicularVector(vector: { x: number; y: number }): { x: number; y: number } {
  return { x: -vector.y, y: vector.x };
}

// Utility function to filter points for smoother drawing
export function filterPoints(points: Array<{ x: number; y: number; pressure: number }>, threshold: number = 3): Array<{ x: number; y: number; pressure: number }> {
  if (points.length <= 2) return points;
  
  const filtered = [points[0]]; // Always keep the first point
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1];
    const current = points[i];
    const distance = calculateDistance(prev, current);
    
    // Only add point if it's far enough from the previous point
    if (distance >= threshold) {
      filtered.push(current);
    }
  }
  
  // Always keep the last point
  if (points.length > 1) {
    filtered.push(points[points.length - 1]);
  }
  
  return filtered;
}

// Utility function to smooth a path by averaging nearby points
export function smoothPath(points: Array<{ x: number; y: number; pressure: number }>, smoothingFactor: number = 0.5): Array<{ x: number; y: number; pressure: number }> {
  if (points.length < 3) return points;
  
  const smoothed = [points[0]]; // Keep first point unchanged
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    
    // Calculate smoothed position
    const smoothedX = current.x + smoothingFactor * ((prev.x + next.x) / 2 - current.x);
    const smoothedY = current.y + smoothingFactor * ((prev.y + next.y) / 2 - current.y);
    
    smoothed.push({
      x: smoothedX,
      y: smoothedY,
      pressure: current.pressure
    });
  }
  
  smoothed.push(points[points.length - 1]); // Keep last point unchanged
  return smoothed;
}

// Utility function to calculate arrow points for drawing arrows
export function calculateArrowPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  arrowSize: number = 20
): {
  tip: { x: number; y: number };
  baseLeft: { x: number; y: number };
  baseRight: { x: number; y: number };
} | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length < 2) return null;
  
  const unitX = dx / length;
  const unitY = dy / length;
  const perpX = -unitY;
  const perpY = unitX;
  
  const arrowLength = arrowSize * 0.6;
  const arrowWidth = arrowSize * 0.35;
  
  const baseCenterX = to.x - unitX * arrowLength;
  const baseCenterY = to.y - unitY * arrowLength;
  
  return {
    tip: { x: to.x, y: to.y },
    baseLeft: {
      x: baseCenterX + perpX * arrowWidth,
      y: baseCenterY + perpY * arrowWidth
    },
    baseRight: {
      x: baseCenterX - perpX * arrowWidth,
      y: baseCenterY - perpY * arrowWidth
    }
  };
}

// Utility function to check if a point is within a bounding box
export function isPointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

// Utility function to clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Utility function to convert canvas coordinates to field coordinates
export function canvasToFieldCoordinates(
  canvasPoint: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; yardLine: number } {
  // Assuming field goes from 0-100 yards
  const fieldX = (canvasPoint.x / canvasWidth) * 100;
  const fieldY = (canvasPoint.y / canvasHeight) * 100;
  
  // Calculate yard line (50 yard line is at center)
  const yardLine = Math.round(50 - (fieldY - 50));
  
  return {
    x: fieldX,
    y: fieldY,
    yardLine: Math.max(0, Math.min(100, yardLine))
  };
}

// Utility function to debounce function calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Utility function to throttle function calls
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Export default functions for backward compatibility
export default {
  generatePlayThumbnail,
  generatePlayThumbnailWithRender,
  getSvgPathFromStroke,
  calculateDistance,
  normalizeVector,
  getPerpendicularVector,
  filterPoints,
  smoothPath,
  calculateArrowPoints,
  isPointInBounds,
  clamp,
  canvasToFieldCoordinates,
  debounce,
  throttle
};