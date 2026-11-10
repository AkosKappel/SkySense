/** True for a bare `/` pressed outside a text field: the shortcut to search for a place. */
export function isSearchShortcut(event: KeyboardEvent): boolean {
	if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false;
	const target = event.target as HTMLElement | null;
	return !(
		target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
	);
}
