import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/prisma';

export const handle: Handle = async ({ event, resolve }) => {
	// make prisma available on event.locals.prisma for all server routes
	event.locals.prisma = prisma;

	// ...existing code may add auth/session handling here...

	return await resolve(event);
};
