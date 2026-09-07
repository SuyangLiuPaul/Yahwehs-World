// The palette is deliberately not satellite imagery. Every competing Bible
// atlas renders the ancient world in modern aerial photography, which shows a
// landscape that did not exist when the text was written. This one is painted
// like a manuscript map — parchment land, ink sea, gilded coast — and every
// pixel of it is generated in code, so there is no imagery licence, no tile
// bill, and no CDN in the loading path.
export const palette = {
  sea: '#0b1a2b',
  seaDeep: '#061120',
  land: '#e5d8bd',
  landShade: '#d6c39f',
  coast: '#c9a227',
  lake: '#16344d',
  river: '#2f5d7c',
  graticule: '#ffffff14',

  ink: '#1a1410',
  gold: '#c9a227',
  goldBright: '#e8c55a',
  parchment: '#ede4d3',
  navy: '#0d1b2a',
} as const;

// Marker colour runs with how firmly the place is actually pinned down, not
// with anything decorative. A gilded dot is a site we can stand on; a faint
// one is a guess the map should not oversell.
export const precisionStyle: Record<string, { color: string; label: string; labelZh: string }> = {
  settlement: { color: '#e8c55a', label: 'Known settlement', labelZh: '已知聚落' },
  tel:        { color: '#d9ab3a', label: 'Excavated tell',   labelZh: '已发掘土丘' },
  visible:    { color: '#b8923c', label: 'Visible landmark', labelZh: '可见地标' },
  water:      { color: '#5b9bc4', label: 'Water feature',    labelZh: '水体' },
  terrain:    { color: '#8f9c6b', label: 'Terrain feature',  labelZh: '地形特征' },
  region:     { color: '#8a7f9c', label: 'Region',           labelZh: '地区' },
  path:       { color: '#a8825f', label: 'Route',            labelZh: '路线' },
  distance:   { color: '#7a6f63', label: 'Inferred by distance', labelZh: '由距离推定' },
  unknown:    { color: '#5f574e', label: 'Unclassified',     labelZh: '未分类' },
};

export const precisionOf = (t: string) => precisionStyle[t] ?? precisionStyle.unknown!;
