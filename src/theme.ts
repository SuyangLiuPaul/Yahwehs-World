// The palette is deliberately not satellite imagery. Every competing Bible
// atlas renders the ancient world in modern aerial photography, which shows a
// landscape that did not exist when the text was written. This one is painted
// like a manuscript map — parchment land, ink sea, gilded coast — and every
// pixel of it is generated in code, so there is no imagery licence, no tile
// bill, and no CDN in the loading path.
export const palette = {
  sea: '#11345a',
  seaDeep: '#0a213c',
  land: '#ebe0c7',
  landShade: '#d8c5a0',
  coast: '#e6ac32',
  lake: '#1c4d7a',
  river: '#3574a6',
  // A band hugging every coast, lighter than the open sea. Real charts shade
  // shallow water this way because it is where a ship actually runs aground;
  // here it does the same job a satellite photo's turquoise shelf would, with
  // no photograph in the loading path.
  shallowWater: '#255c8c',
  graticule: '#ffffff18',

  ink: '#1a1410',
  gold: '#e6ac32',
  goldBright: '#f8d66d',
  parchment: '#f2e9d8',
  navy: '#0e2b4b',
} as const;

// Marker colour runs with how firmly the place is actually pinned down, not
// with anything decorative. A gilded dot is a site we can stand on; a faint
// one is a guess the map should not oversell.
export const precisionStyle: Record<string, { color: string; label: string; labelZh: string }> = {
  settlement: { color: '#f8d66d', label: 'Known settlement', labelZh: '已知聚落' },
  tel:        { color: '#e6ac32', label: 'Excavated tell',   labelZh: '已发掘土丘' },
  visible:    { color: '#c89838', label: 'Visible landmark', labelZh: '可见地标' },
  water:      { color: '#5bb8f5', label: 'Water feature',    labelZh: '水体' },
  terrain:    { color: '#7ab356', label: 'Terrain feature',  labelZh: '地形特征' },
  region:     { color: '#9a8ec2', label: 'Region',           labelZh: '地区' },
  path:       { color: '#b88c62', label: 'Route',            labelZh: '路线' },
  distance:   { color: '#8a7e70', label: 'Inferred by distance', labelZh: '由距离推定' },
  unknown:    { color: '#6b6359', label: 'Unclassified',     labelZh: '未分类' },
};

export const precisionOf = (t: string) => precisionStyle[t] ?? precisionStyle.unknown!;
