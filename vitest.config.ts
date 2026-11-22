import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
		pool: 'forks',
		fileParallelism: false, // Run test files sequentially to avoid integration-test DB deadlocks
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/routes/**/*.server.ts', // Exclude server files from coverage (tested separately)
				'**/*.d.ts',
				'**/*.config.*',
				'**/mockData/*'
			]
		},
		setupFiles: ['./vitest.setup.ts']
	}
});
