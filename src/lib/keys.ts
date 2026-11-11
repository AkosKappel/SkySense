/**
 * The shortcut to search for a place: a bare `/` outside a text field, or Ctrl+K (⌘K on a Mac),
 * which people know from other apps and which works from inside a field too.
 */
export function isSearchShortcut(event: KeyboardEvent): boolean {
	if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey) {
		return true;
	}
	if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false;
	const target = event.target as HTMLElement | null;
	return !(
		target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
	);
}
