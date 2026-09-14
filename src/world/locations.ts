export const locations = [
  { id: 'library', name: '藏经阁', glyph: '卷', subtitle: '万卷藏于云上', kind: 'library', position: [-44, 15, 0], radius: 16, height: 42, href: '/blog', detail: '拾一卷玉简，读山中所思。术法、代码与日常，皆是问道的来处。', action: '翻阅全部玉简', coordinate: '西 · 文曲峰' },
  { id: 'practice', name: '修行台', glyph: '道', subtitle: '循序渐入佳境', kind: 'pagoda', position: [7, 31, -58], radius: 12, height: 57, href: '/series', detail: '千里之行，始于一念。沿着连载留下的足迹，把一门术法慢慢读透。', action: '展开修行录', coordinate: '北 · 太虚峰' },
  { id: 'stars', name: '星罗台', glyph: '星', subtitle: '万象皆有回响', kind: 'orrery', position: [54, 18, -17], radius: 13, height: 43, href: '/tags', detail: '以符印为星，以文字为轨。在交错的灵感之间，寻一条自己的路。', action: '寻找万象符印', coordinate: '东 · 天枢峰' },
  { id: 'chronicle', name: '岁月碑', glyph: '时', subtitle: '来路留有微光', kind: 'gate', position: [44, 4, 49], radius: 11, height: 35, href: '/archive', detail: '山中不知年，落笔自有时。沿岁月回望，那些曾经照亮长夜的念头。', action: '回溯山中岁月', coordinate: '东南 · 流年屿' },
  { id: 'hermit', name: '问道亭', glyph: '隐', subtitle: '一盏茶待故人', kind: 'pavilion', position: [-13, 8, 51], radius: 12, height: 35, href: '/about', detail: '白日写代码，夜来听松风。此处住着青野散人，也收着道友珍藏的玉简。', action: '拜访山房主人', coordinate: '南 · 松风屿' },
  { id: 'ferry', name: '飞鹤渡', glyph: '缘', subtitle: '相逢便是有缘', kind: 'bridge', position: [-67, 16, 51], radius: 10, height: 32, href: '/guestbook', detail: '渡口常有清风，山前静候来音。留下一句话，或循鹤影探访远方仙山。', action: '前往山前留音', coordinate: '西南 · 云来渡' },
] as const;
