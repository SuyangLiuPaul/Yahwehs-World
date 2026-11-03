// STUB: wording needs the Opus medium review (reader-visible).
import { openSheet } from '../../gallery/sheet.ts';
import { t } from '../../locale.ts';
import { getPlatform } from '../../platform/index.ts';
import { createPackManager, formatBytes, parseManifest } from '../../core/packs.ts';
import type { PackId, PackStatus } from '../../core/packs.ts';
import type { FeatureContext } from '../types.ts';

export function openPacksSheet(ctx: FeatureContext): HTMLDialogElement {
  const controllers = new Set<AbortController>();
  let closed = false;
  const title = () => t('Offline pictures', '离线图片', 'Офлайн-картины');
  const button = (label: string, action: () => void) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gx-btn'; b.textContent = label; b.onclick = action; return b;
  };
  return openSheet({
    title: title(), onClose() { closed = true; for (const c of controllers) c.abort(); },
    render(body) {
      async function load() {
        body.textContent = t('Loading offline packs…', '正在加载离线包…', 'Загрузка офлайн-пакетов…');
        try {
          const response = await fetch('/data/packs.json');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const platform = await getPlatform();
          const manager = createPackManager({ platform, manifest: parseManifest(await response.json()) });
          if (closed) return;
          body.replaceChildren();
          const usage = document.createElement('p'); usage.className = 'gx-packs-usage';
          async function updateUsage() {
            const u = await manager.usage();
            usage.textContent = `${formatBytes(u.usedBytes, ctx.locale())} / ${u.quotaBytes === null ? t('Unknown quota', '容量未知', 'Лимит неизвестен') : formatBytes(u.quotaBytes, ctx.locale())}`;
          }
          const titles: Record<PackId, string> = {
            thumbs: t('Thumbnails', '缩略图', 'Миниатюры'), full: t('Full-size pictures', '全幅图片', 'Полноразмерные картины'), editions: t('Bible texts', '经文数据', 'Тексты Библии'),
          };
          const stateText = (s: PackStatus) => ({
            bundled: t('Included', '已内置', 'Включено'), absent: t('Not downloaded', '未下载', 'Не загружено'), partial: t('Partly downloaded', '部分已下载', 'Загружено частично'), complete: t('Downloaded', '已下载', 'Загружено'), downloading: t('Downloading…', '正在下载…', 'Загрузка…'), error: t('Download failed. Please retry.', '下载失败，请重试。', 'Не удалось загрузить. Повторите попытку.'),
          })[s.state];
          for (const pack of manager.info()) {
            const row = document.createElement('section'); row.className = 'gx-packs-row';
            const heading = document.createElement('h3'); heading.textContent = titles[pack.id];
            const size = document.createElement('p'); size.textContent = formatBytes(pack.bytes, ctx.locale());
            const state = document.createElement('p'); state.setAttribute('aria-live', 'polite');
            const controls = document.createElement('div'); controls.className = 'gx-packs-controls';
            const progress = document.createElement('progress'); progress.max = pack.bytes || 1; progress.setAttribute('aria-label', titles[pack.id]);
            row.append(heading, size, state, controls); body.append(row);
            const canDownload = pack.id === 'full' && platform.kind !== 'web';
            function paint(s: PackStatus) {
              state.textContent = stateText(s); controls.replaceChildren();
              if (!canDownload || closed) return;
              if (s.state === 'downloading') { progress.value = s.doneBytes; controls.append(progress); return; }
              if (s.state === 'complete') controls.append(button(t('Remove', '移除', 'Удалить'), () => { void remove(); }));
              else controls.append(button(s.state === 'error' ? t('Retry', '重试', 'Повторить') : t('Download all', '全部下载', 'Скачать всё'), () => { void download(); }));
            }
            function failed(action: () => void) {
              state.textContent = t('Could not load offline packs. Please retry.', '无法加载离线包，请重试。', 'Не удалось загрузить офлайн-пакеты. Повторите попытку.');
              controls.replaceChildren(button(t('Retry', '重试', 'Повторить'), action));
            }
            async function remove() { try { await manager.remove(pack.id); paint(await manager.status(pack.id)); await updateUsage(); } catch { failed(() => { void remove(); }); } }
            async function download() {
              const controller = new AbortController(); controllers.add(controller);
              const cancel = button(t('Cancel', '取消', 'Отмена'), () => controller.abort());
              try {
                const s = await manager.download(pack.id, { signal: controller.signal, onProgress(s) { paint(s); if (s.state === 'downloading') controls.append(cancel); } });
                paint(s); await manager.refresh(); await updateUsage();
              } catch { failed(() => { void download(); }); }
              finally { controllers.delete(controller); }
            }
            paint(await manager.status(pack.id));
          }
          body.append(usage); await updateUsage();
        } catch {
          if (closed) return;
          body.textContent = t('Could not load offline packs. Please retry.', '无法加载离线包，请重试。', 'Не удалось загрузить офлайн-пакеты. Повторите попытку.');
          body.append(button(t('Retry', '重试', 'Повторить'), () => { void load(); }));
        }
      }
      void load();
    },
  });
}
