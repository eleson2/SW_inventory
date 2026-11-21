import { defineEnvVars } from '@sveltejs/kit/env';

function required(name: string, minLength = 1) {
	return (value: string | undefined) => {
		if (!value || value.length < minLength) {
			throw new Error(`${name} must be set${minLength > 1 ? ` (at least ${minLength} characters)` : ''}`);
		}
		return value;
	};
}

export const variables = defineEnvVars({
	AUTH_USERNAME: {
		description: 'Login name of the single demo user',
		schema: required('AUTH_USERNAME')
	},
	AUTH_PASSWORD: {
		description: 'Password of the single demo user',
		schema: required('AUTH_PASSWORD', 8)
	},
	AUTH_SECRET: {
		description: 'Random secret used to sign session cookies (e.g. `openssl rand -hex 32`)',
		schema: required('AUTH_SECRET', 32)
	},
	AUTH_SESSION_HOURS: {
		description: 'How long a login stays valid, in hours (default 12)',
		schema: (value) => {
			if (value === undefined || value === '') return 12;
			const hours = Number(value);
			if (!Number.isFinite(hours) || hours <= 0) throw new Error('AUTH_SESSION_HOURS must be a positive number');
			return hours;
		}
	}
});
