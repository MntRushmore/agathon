// Keyboard shortcuts configuration for feature cards
export const keyboardShortcuts: Record<string, { key: string; display: string }> = {
  whiteboard: { key: 'a', display: 'A' },
  math: { key: 'm', display: 'M' },
  journal: { key: 'j', display: 'J' },
  admin: { key: 'shift+a', display: 'A' },
  classes: { key: 'c', display: 'C' },
  join: { key: 'c', display: 'C' },
};

export function getShortcutDisplay(id: string, isMac: boolean = true): string | null {
  const shortcut = keyboardShortcuts[id];
  if (!shortcut) return null;

  const modifier = isMac ? '\u2318' : 'Ctrl+';
  return `${modifier}${shortcut.display}`;
}
