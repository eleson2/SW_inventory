/**
 * Toast notification store
 * Provides a simple toast notification system for success/error/info messages
 */
import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	return {
		subscribe,
		show(message: string, type: Toast['type'] = 'info', duration = 5000) {
			const id = Math.random().toString(36).substring(7);
			const toast: Toast = { id, message, type, duration };

			update((toasts) => [...toasts, toast]);

			if (duration > 0) {
				setTimeout(() => {
					this.dismiss(id);
				}, duration);
			}

			return id;
		},
		success(message: string, duration = 5000) {
			return this.show(message, 'success', duration);
		},
		error(message: string, duration = 7000) {
			return this.show(message, 'error', duration);
		},
		info(message: string, duration = 5000) {
			return this.show(message, 'info', duration);
		},
		dismiss(id: string) {
			update((toasts) => toasts.filter((t) => t.id !== id));
		},
		dismissAll() {
			update(() => []);
		}
	};
}

export const toast = createToastStore();
