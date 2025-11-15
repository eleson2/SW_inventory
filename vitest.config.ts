import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true // Run integration tests sequentially to avoid deadlocks
			}
		},
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
	},
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, './src/lib'),
			$components: path.resolve(__dirname, './src/lib/components'),
			$types: path.resolve(__dirname, './src/lib/types'),
			$utils: path.resolve(__dirname, './src/lib/utils'),
			$stores: path.resolve(__dirname, './src/lib/stores'),
			$schemas: path.resolve(__dirname, './src/lib/schemas')
		}
	}
});
