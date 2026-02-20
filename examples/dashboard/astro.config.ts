import lunaria from '@lunariajs/dashboard/astro';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	integrations: [lunaria()],
});
