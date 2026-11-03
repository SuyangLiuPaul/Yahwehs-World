// Which install route a browser has, from what it says about itself. Pure (no window), so tests/gallery/pwa-core.test.ts can feed it
// real user-agent strings. The install entry on the home page (src/gallery/install.ts) asks it only when the browser did not offer
// the install prompt itself (Chromium does; Safari does not).

export type Family = 'ios' | 'mac-safari' | 'other';
export interface Platform {
  family: Family;
  /** iPhone / iPad / iPod, including an iPad that says it is a Mac */ ios: boolean;
  /** an in-app browser (WeChat, Facebook, Line, ...) that cannot add to the home screen: the page must be opened in Safari first */ inApp: boolean;
}

export function platformOf(ua: string, platform: string, touchPoints: number): Platform {
  // iPadOS 13+ reports "MacIntel" and a desktop user agent; what gives it away is the touch screen
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  const inApp = /MicroMessenger|FBAN|FBAV|Instagram|Line\/|MQQBrowser|QQ\/|Weibo|Twitter|TikTok|musical_ly|Snapchat/i.test(ua);
  if (ios) return { family: 'ios', ios: true, inApp };
  // desktop Safari 17+ has File > Add to Dock; Chrome, Edge, Firefox and Opera say "Safari" too
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS|FxiOS|Edg\/|EdgA|OPR\/|Firefox\//.test(ua);
  if (/Macintosh/.test(ua) && safari && touchPoints < 2) return { family: 'mac-safari', ios: false, inApp };
  return { family: 'other', ios: false, inApp };
}
