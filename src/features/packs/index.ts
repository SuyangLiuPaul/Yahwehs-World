import type { FeatureModule } from '../types.ts';

export const packsFeature: FeatureModule = {
  id: 'packs', routes: [],
  nav: { slot: 'menu', order: 90, label: { en: 'Offline pictures', zhHans: '离线图片', ru: 'Офлайн-картины' }, icon: 'download' },
  surfaces: ['gallery'], packs: ['thumbs', 'full', 'editions'], budgets: { firstViewKB: 0, jsKB: 6 },
  async load() {
    const { openPacksSheet } = await import('./sheet.ts');
    return { mount(_el, ctx) { openPacksSheet(ctx); return () => {}; } };
  },
};
