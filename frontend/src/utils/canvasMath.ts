
export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandleType =
  | 'nw' | 'n' | 'ne'
  | 'e' | 'se' | 's'
  | 'sw' | 'w' | 'move';

export function normalizeRect(
  x1: number, y1: number, x2: number, y2: number
): RectBox {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x1 - x2),
    height: Math.abs(y1 - y2),
  };
}

export function clampRectToViewport(rect: RectBox): RectBox {
  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;

  if (x < 0) { width += x; x = 0; }
  if (y < 0) { height += y; y = 0; }
  if (x + width > window.innerWidth) width = window.innerWidth - x;
  if (y + height > window.innerHeight) height = window.innerHeight - y;

  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

export function calculateResizedRect(
  rect: RectBox,
  handle: ResizeHandleType,
  dx: number,
  dy: number,
  minimumSize: number
): RectBox {
  let { x, y, width, height } = rect;

  if (handle === 'move') {
    return { x: x + dx, y: y + dy, width, height };
  }

  if (handle.includes('w')) {
    const newWidth = width - dx;
    if (newWidth >= minimumSize) {
      x = x + dx;
      width = newWidth;
    }
  }
  if (handle.includes('e')) {
    const newWidth = width + dx;
    if (newWidth >= minimumSize) {
      width = newWidth;
    }
  }

  if (handle.includes('n')) {
    const newHeight = height - dy;
    if (newHeight >= minimumSize) {
      y = y + dy;
      height = newHeight;
    }
  }
  if (handle.includes('s')) {
    const newHeight = height + dy;
    if (newHeight >= minimumSize) {
      height = newHeight;
    }
  }

  return { x, y, width, height };
}
