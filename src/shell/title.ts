// Observe the page's localised title, including asynchronous data and language changes.
// A rejected native call must not stop the rest of shell startup.
export function followDocumentTitle(doc: Document, setTitle: (title: string) => Promise<void>, Observer = MutationObserver): () => void {
  const sync = () => { void setTitle(doc.title).catch((e) => console.warn('[shell] window title unavailable', e)); };
  const observer = new Observer(sync);
  observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  sync();
  return () => observer.disconnect();
}
