export type PlatformKind = 'web' | 'tauri' | 'capacitor';
export type OsName = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web';
export interface PlatformInfo { kind: PlatformKind; os: OsName; osVersion?: string; arch?: string; appVersion?: string; locale: string; formFactor: 'phone' | 'tablet' | 'desktop' | 'unknown'; channel: 'web' | 'store' | 'direct' }
export interface DownloadProgress { loaded: number; total: number | null }
export interface FileEstimate { usage: number | null; quota: number | null }
export interface Platform {
  kind: PlatformKind;
  info: PlatformInfo;
  capabilities: { files: boolean; share: boolean; notifications: boolean; deepLinks: boolean; updates: boolean; persistentStorage: boolean };
  storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
  files: {
    /** Stores a relative destination; abort rejects with AbortError and leaves no partial file. */
    download(url: string, dest: string, onProgress?: (p: DownloadProgress) => void, signal?: AbortSignal): Promise<{ bytes: number }>;
    exists(dest: string): Promise<boolean>;
    remove(dest: string): Promise<void>;
    /** File names directly under dir. */
    list(dir: string): Promise<string[]>;
    bytesUsed(): Promise<number>;
    estimate(): Promise<FileEstimate>;
    /** Null for web/service-worker URLs, or when the native file is not indexed. */
    url(dest: string): string | null;
    /** Optional readback for integrity verification of the bytes actually stored. */
    read?(dest: string): Promise<ArrayBuffer>;
  };
  share(p: { title: string; text?: string; url?: string }): Promise<'shared' | 'copied' | 'cancelled'>;
  openExternal(url: string): Promise<void>;
  deepLinks: { onOpen(cb: (url: string) => void): () => void; current(): Promise<string | null> };
  updates: { check(): Promise<UpdateInfo | null>; apply(info: UpdateInfo): Promise<void> };
  notifications?: { permission(): Promise<'granted' | 'denied' | 'default'>; request(): Promise<'granted' | 'denied' | 'default'> };
}
export interface UpdateInfo { version: string; url: string }
