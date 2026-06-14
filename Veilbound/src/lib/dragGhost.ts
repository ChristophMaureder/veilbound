import { writable } from 'svelte/store';

export interface GhostState { label: string; x: number; y: number; }
export const dragGhost = writable<GhostState | null>(null);

// 1×1 transparent GIF used to suppress the browser's built-in drag image.
const BLANK = new Image(1, 1);
BLANK.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function ghostDragStart(e: DragEvent, label: string): void {
  e.dataTransfer?.setDragImage(BLANK, 0, 0);
  dragGhost.set({ label, x: e.clientX, y: e.clientY });
}

export function ghostDragMove(e: DragEvent): void {
  if (e.clientX || e.clientY) {
    dragGhost.update((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
  }
}

export function ghostDragEnd(): void {
  dragGhost.set(null);
}
