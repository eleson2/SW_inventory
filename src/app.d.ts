import type { PrismaClient } from '@prisma/client';
import type { SessionUser } from '#lib/server/users.ts';

declare global {
	namespace App {
		interface Locals {
			// Prisma client instance attached in hooks.server.ts
			prisma: PrismaClient;
			// Logged-in user, set in hooks.server.ts (null when not logged in)
			user: SessionUser | null;
		}
	}
}

export {};
