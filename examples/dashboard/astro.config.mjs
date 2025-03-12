// @ts-check
import { defineConfig } from "astro/config";
import lunaria from "@lunariajs/dashboard/astro";

// https://astro.build/config
export default defineConfig({
  integrations: [lunaria()],
});
