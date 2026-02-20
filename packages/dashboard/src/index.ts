import type { LunariaIntegration } from '@lunariajs/core';

export default function LunariaDashboardIntegration(): LunariaIntegration {
	return {
		name: '@lunariajs/dashboard',
		hooks: {
			setup: ({ config }) => {},
		},
	};
}
