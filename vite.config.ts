import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			alias: {
				$lib: './src/lib',
				$components: './src/lib/components',
				$types: './src/lib/types',
				$utils: './src/lib/utils',
				$stores: './src/lib/stores',
				$schemas: './src/lib/schemas'
			}
		})
	]
});
