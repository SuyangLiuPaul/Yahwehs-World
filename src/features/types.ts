import type { Platform } from '../platform/types.ts';
export type Unmount = () => void;
export interface FeatureContext { platform: Platform; locale: () => string }
export interface FeatureModule {
  id: string;
  routes: { path: string; hash?: RegExp }[];
  nav?: { slot: 'tab' | 'menu'; order: number; label: { en: string; zhHans: string; ru: string }; icon: string };
  surfaces: string[];
  packs?: string[];
  budgets: { firstViewKB: number; jsKB: number };
  preload?: () => Promise<void>;
  load: () => Promise<{ mount(el: HTMLElement | null, ctx: FeatureContext): Unmount }>;
}
