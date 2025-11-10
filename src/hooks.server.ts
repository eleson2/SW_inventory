import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	// make prisma available on event.locals.prisma for all server routes
	event.locals.prisma = db;

	// ...existing code may add auth/session handling here...

	return await resolve(event);
};
