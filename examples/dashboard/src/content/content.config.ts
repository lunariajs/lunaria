import { defineCollection } from "astro:content";
import lunariaLoader from "@lunariajs/dashboard/loader";

export const collections = {
  lunaria: defineCollection({ loader: lunariaLoader() }),
};
