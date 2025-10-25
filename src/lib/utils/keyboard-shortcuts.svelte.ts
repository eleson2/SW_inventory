/**
 * Keyboard shortcuts handler
 * Provides global keyboard shortcut functionality
 */

import { goto } from '$app/navigation';

export function useKeyboardShortcuts(showHelpDialog: () => void) {
	let lastKey = $state<string | null>(null);
	let lastKeyTime = $state<number>(0);

	function handleKeydown(event: KeyboardEvent) {
		// Don't trigger shortcuts when typing in inputs/textareas
		const target = event.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable
		) {
			// Exception: '/' can still trigger search focus
			if (event.key !== '/') {
				return;
			}
		}

		const now = Date.now();
		const timeSinceLastKey = now - lastKeyTime;

		// Single key shortcuts
		switch (event.key) {
			case '?':
				event.preventDefault();
				showHelpDialog();
				return;

			case 'Escape':
				// Handle escape (dialogs should listen to this themselves)
				return;

			case '/':
				event.preventDefault();
				focusSearch();
				return;

			case 'n':
			case 'N':
				// Create new - only on list pages
				if (window.location.pathname.match(/^\/(vendors|software|packages|lpars|customers)$/)) {
					event.preventDefault();
					goto(`${window.location.pathname}/new`);
				}
				return;
		}

		// Two-key combinations (g + x)
		if (lastKey === 'g' && timeSinceLastKey < 1000) {
			event.preventDefault();
			switch (event.key) {
				case 'h':
					goto('/');
					break;
				case 'v':
					goto('/vendors');
					break;
				case 's':
					goto('/software');
					break;
				case 'p':
					goto('/packages');
					break;
				case 'l':
					goto('/lpars');
					break;
				case 'c':
					goto('/customers');
					break;
			}
			lastKey = null;
			return;
		}

		// Track the last key for combinations
		lastKey = event.key;
		lastKeyTime = now;

		// Reset after 1 second
		setTimeout(() => {
			if (Date.now() - lastKeyTime >= 1000) {
				lastKey = null;
			}
		}, 1000);
	}

	function focusSearch() {
		// Try to find and focus the search input
		const searchInput = document.querySelector<HTMLInputElement>(
			'input[type="search"], input[placeholder*="Search" i]'
		);
		if (searchInput) {
			searchInput.focus();
			searchInput.select();
		}
	}

	return {
		handleKeydown
	};
}
