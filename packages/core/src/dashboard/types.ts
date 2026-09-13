import type { z } from 'zod';
import type { LunariaConfig } from '../config/types.ts';
import type { LunariaStatus } from '../status/types.ts';
import type { DashboardSchema } from './schema.ts';

export type Dashboard = z.output<typeof DashboardSchema>;
export type DashboardUserConfig = z.input<typeof DashboardSchema>;
export type DashboardUi = Dashboard['ui'];

/** A dashboard component that receives the Lunaria configuration and returns a string of HTML. */
export type BaseComponent = (config: LunariaConfig) => string;

/** A dashboard component that receives both the Lunaria configuration and status and returns a string of HTML. */
export type StatusComponent = (config: LunariaConfig, status: LunariaStatus) => string;

export type Slots = {
	head?: BaseComponent;
	beforeTitle?: BaseComponent;
	afterTitle?: BaseComponent;
	afterStatusByLocale?: BaseComponent;
	afterStatusByFile?: BaseComponent;
};

export type Overrides = {
	meta?: BaseComponent;
	body?: StatusComponent;
	statusByLocale?: StatusComponent;
	statusByFile?: StatusComponent;
};

export interface RendererConfig {
	slots: Slots;
	overrides: Overrides;
}

export interface RendererUserConfig {
	slots?: Slots;
	overrides?: Overrides;
}

/** The status of a localization as displayed by the dashboard. */
export type DashboardStatus = 'done' | 'outdated' | 'missing';
