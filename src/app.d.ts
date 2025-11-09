import type { PrismaClient } from '@prisma/client';

declare global {
	namespace App {
		interface Locals {
			// Prisma client instance attached in hooks.server.ts
			prisma: PrismaClient;
			// ...other locals like user/session can be declared here...
		}
	}
}

export {};
