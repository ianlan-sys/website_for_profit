import { qians } from './qian.js';

// 签画: every qian gets its own small ink-and-wash scene, composed from its name and poem.
// Sky, terrain and up to two motifs are picked by keyword, so 「舟行缓水」 shows a boat on water
// and 「梅开雪后」 a plum branch in snow. Pure SVG strings, no external assets.
const C = { ink: '#7f8f74', deep: '#5d6d55', pale: '#b5bda1', mist: '#dcdcc8', sun: '#c97b5a', gold: '#c5a875', water: '#98b0a6', red: '#b3473a', blossom: '#d98f86', paper: '#fbf8f0', moon: '#ecdcae' };

const star = (x, y, s = 3.5) => `<path d="M${x} ${y - s}L${x + s * .28} ${y - s * .28}L${x + s} ${y}L${x + s * .28} ${y + s * .28}L${x} ${y + s}L${x - s * .28} ${y + s * .28}L${x - s} ${y}L${x - s * .28} ${y - s * .28}Z" fill="${C.gold}" opacity=".8"/>`;
const cloud = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-22 6q2-10 12-7q4-10 15-5q9-6 14 4q9 0 8 8Z" fill="${C.mist}" opacity=".9"/><path d="M-14 4q5-5 10 0q5-5 10 0" fill="none" stroke="${C.ink}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/></g>`;
const lucky = (x, y) => `<g fill="none" stroke="${C.gold}" stroke-width="1.4" stroke-linecap="round" opacity=".85"><path d="M${x} ${y}q6-8 12-2q6 6 0 9q-5 2-6-3M${x + 12} ${y - 2}q8-7 15 0"/></g>`;

const SKY = {
  sun: (x = 158) => `<circle cx="${x}" cy="44" r="22" fill="${C.sun}" opacity=".75"/>`,
  dusk: () => `<circle cx="150" cy="96" r="30" fill="${C.sun}" opacity=".55"/><g stroke="${C.gold}" stroke-width="1.2" stroke-linecap="round" opacity=".7"><path d="M24 70h56M36 80h40M150 56h48M162 48h30"/></g>`,
  moon: (x = 160) => `<circle cx="${x}" cy="44" r="30" fill="${C.moon}" opacity=".35"/><circle cx="${x}" cy="44" r="20" fill="${C.moon}"/>${star(40, 30)}${star(86, 18, 2.6)}${star(120, 60, 2.2)}`,
  crescent: (x = 162) => `<path d="M${x} 22A22 22 0 1 0 ${x} 66A17 22 0 1 1 ${x} 22Z" fill="${C.moon}"/>${star(52, 34)}${star(100, 22, 2.6)}${star(130, 70, 2.2)}`,
  cloud: () => `${cloud(60, 40, 1.1)}${cloud(160, 58, .9)}`,
  rain: () => `${cloud(70, 30, 1.2)}${cloud(156, 38, 1)}<g stroke="${C.water}" stroke-width="1.3" stroke-linecap="round" opacity=".8">${[30, 52, 74, 96, 118, 140, 162, 184].map((x, i) => `<path d="M${x} ${52 + (i % 3) * 14}l-4 10"/>`).join('')}</g>`,
  snow: () => `<circle cx="160" cy="40" r="16" fill="${C.mist}"/><g fill="${C.pale}">${[[30, 30], [62, 54], [96, 26], [128, 62], [190, 72], [46, 84], [112, 92], [176, 104], [80, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join('')}</g>`,
  rainbow: () => `<g fill="none" stroke-width="5" opacity=".55"><path d="M40 120a70 70 0 0 1 140 0" stroke="${C.sun}"/><path d="M47 120a63 63 0 0 1 126 0" stroke="${C.gold}"/><path d="M54 120a56 56 0 0 1 112 0" stroke="${C.water}"/></g>${cloud(48, 96, .9)}`,
  thunder: () => `${cloud(80, 34, 1.3)}${cloud(150, 46, 1)}<path d="M112 46l-8 16h8l-6 16 16-22h-9l6-10Z" fill="${C.gold}"/>`
};

const TERRAIN = {
  hills: () => `<path d="M0 132c22-29 38-38 58-26 14 9 29 19 43 14 30-12 40-7 72 11l47 12V150H0Z" fill="${C.pale}" opacity=".55"/><path d="M0 147c22-3 40-25 59-29 22-5 28 30 53 25 16-3 23-14 38-9 20 7 30 20 70 17v24H0Z" fill="${C.ink}" opacity=".4"/>`,
  mountains: () => `<path d="M0 132L34 80l22 24 34-48 30 46 24-18 40 36 36-12V150H0Z" fill="${C.pale}" opacity=".55"/><path d="M0 150l40-34 26 18 30-30 34 30 26-14 64 30v20H0Z" fill="${C.ink}" opacity=".45"/><path d="M90 56l-6 10m6-10 7 12" stroke="${C.paper}" stroke-width="2" opacity=".8"/>`,
  water: () => `<path d="M0 118c30-16 52-18 74-8 18 8 28 6 40 0" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity=".5"/><path d="M118 122l22-26 18 14 18-18 44 30H118Z" fill="${C.pale}" opacity=".5"/><path d="M0 128q55-7 110 0t110 0v44q-55 8-110 0t-110 0Z" fill="${C.water}" opacity=".24"/><g fill="none" stroke="${C.water}" stroke-width="1.3" stroke-linecap="round"><path d="M14 142q8-5 16 0t16 0M120 150q8-5 16 0t16 0t16 0M40 164q8-5 16 0t16 0M150 174q8-5 16 0t16 0"/></g>`
};
const BANK = `<path d="M0 124q34-6 58 2q16 6 22 22q2 10-6 24H0Z" fill="${C.ink}" opacity=".38"/>`;
const GROUND = `<g fill="none" stroke="${C.ink}" stroke-linecap="round" stroke-width="1.2" opacity=".7"><path d="M18 172c40-10 66-6 96-4m-78 13c26-5 58-6 88-2m10-17 50 3"/></g>`;

const MOTIF = {
  boat: { slot: 'c', svg: () => `<g transform="translate(104 138)"><path d="M-30 0q30 12 60 0l-7 7h-46Z" fill="${C.deep}"/><path d="M0 0V-38" stroke="${C.deep}" stroke-width="1.6"/><path d="M1-36L22-6H1Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M-30 13q8-3 16 0t16 0" stroke="${C.water}" fill="none" stroke-width="1.2"/></g>` },
  bamboo: { slot: 'l', svg: () => `<g stroke="${C.deep}" stroke-linecap="round">${[[26, 26], [42, 14], [56, 40]].map(([x, top]) => `<path d="M${x} 160V${top}" stroke-width="3.2"/>${[0, 1, 2, 3].map(i => `<path d="M${x - 2} ${top + 22 + i * 30}h4" stroke-width="1.4" stroke="${C.paper}"/>`).join('')}`).join('')}</g><g fill="${C.ink}">${[[30, 40, -50], [46, 30, 40], [60, 60, 50], [22, 70, -60], [50, 86, 30], [36, 104, -40]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="11" transform="rotate(${r} ${x} ${y})"/>`).join('')}</g>` },
  plum: { slot: 'l', svg: () => `<path d="M0 30q28 6 40 24t36 20q14 2 22 14M40 54q6-18 22-24" fill="none" stroke="${C.deep}" stroke-width="2.4" stroke-linecap="round"/><g fill="${C.blossom}">${[[30, 38], [48, 58], [60, 30], [72, 72], [90, 80], [98, 88], [20, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6"/><circle cx="${x}" cy="${y}" r="1" fill="${C.gold}"/>`).join('')}</g>` },
  willow: { slot: 'l', svg: () => `<path d="M30 160q-4-60 10-120" fill="none" stroke="${C.deep}" stroke-width="3" stroke-linecap="round"/><g fill="none" stroke="${C.ink}" stroke-width="1.1" stroke-linecap="round" opacity=".85">${[44, 52, 60, 68, 76, 36, 28].map((y, i) => `<path d="M38 ${y}q${10 + i * 3} 20 ${4 + i * 5} ${48 + i * 4}"/>`).join('')}</g>` },
  pine: { slot: 'l', svg: () => `<path d="M40 162q-4-50 4-110" fill="none" stroke="${C.deep}" stroke-width="3.4" stroke-linecap="round"/><g fill="${C.deep}" opacity=".85"><ellipse cx="44" cy="58" rx="26" ry="8"/><ellipse cx="38" cy="84" rx="30" ry="9"/><ellipse cx="46" cy="110" rx="24" ry="8"/></g><g stroke="${C.paper}" stroke-width=".8" opacity=".6"><path d="M26 58h36M18 84h40M30 110h32"/></g>` },
  bridge: { slot: 'c', svg: () => `<path d="M60 138q50-40 100 0" fill="none" stroke="${C.deep}" stroke-width="3.2"/><path d="M60 138q50 30 100 0" fill="none" stroke="${C.deep}" stroke-width="1" opacity=".35"/><g stroke="${C.deep}" stroke-width="1.2">${[72, 86, 100, 114, 128, 142].map(x => `<path d="M${x} ${138 - Math.round(40 * (1 - Math.pow((x - 110) / 50, 2)) * .6)}v-8"/>`).join('')}</g>` },
  birds: { slot: 's', svg: () => `<g fill="none" stroke="${C.deep}" stroke-width="1.4" stroke-linecap="round">${[[120, 30], [140, 44], [104, 50], [156, 26]].map(([x, y]) => `<path d="M${x} ${y}q4-5 8 0q4-5 8 0"/>`).join('')}</g>` },
  crane: { slot: 'r', svg: () => `<g transform="translate(160 116)"><ellipse cx="0" cy="0" rx="16" ry="9" fill="${C.paper}" stroke="${C.ink}"/><path d="M12-4q8-14 2-34" fill="none" stroke="${C.ink}" stroke-width="1.6"/><circle cx="14" cy="-38" r="2.4" fill="${C.red}"/><path d="M15-38l8 2" stroke="${C.deep}" stroke-width="1.4"/><path d="M-14 0q-8 6-12 2" stroke="${C.deep}" stroke-width="3" stroke-linecap="round"/><path d="M-2 8v26M4 8v26" stroke="${C.deep}" stroke-width="1.2"/></g>` },
  lantern: { slot: 'r', svg: () => `<g transform="translate(176 0)"><path d="M0 0v22" stroke="${C.deep}"/><rect x="-12" y="22" width="24" height="30" rx="11" fill="${C.red}"/><rect x="-8" y="20" width="16" height="4" fill="${C.gold}"/><rect x="-8" y="50" width="16" height="4" fill="${C.gold}"/><path d="M0 54v14M-3 58v8M3 58v8" stroke="${C.gold}"/><path d="M-6 30v14M0 28v18M6 30v14" stroke="#d9715f" stroke-width=".8"/></g>` },
  flowers: { slot: 'r', svg: () => `<g stroke="${C.ink}" stroke-width="1.2" fill="none">${[[150, 170, 132], [166, 172, 124], [182, 170, 138]].map(([x, b, t]) => `<path d="M${x} ${b}q-4-20 0-${b - t}"/>`).join('')}</g>${[[150, 132, C.blossom], [166, 124, C.gold], [182, 138, C.blossom]].map(([x, y, c]) => `<g fill="${c}">${[0, 72, 144, 216, 288].map(a => `<circle cx="${x + 5 * Math.cos(a * Math.PI / 180)}" cy="${y + 5 * Math.sin(a * Math.PI / 180)}" r="3.2"/>`).join('')}<circle cx="${x}" cy="${y}" r="2" fill="${C.paper}"/></g>`).join('')}` },
  tea: { slot: 'c', svg: () => `<g transform="translate(110 150)"><path d="M-22-14h44q-2 20-22 20t-22-20Z" fill="${C.paper}" stroke="${C.deep}" stroke-width="1.4"/><path d="M-26 8h52" stroke="${C.deep}" stroke-width="1.4" stroke-linecap="round"/><path d="M-6-22q-6-8 0-14t0-14M6-22q-6-8 0-14" fill="none" stroke="${C.pale}" stroke-width="1.4" stroke-linecap="round"/><path d="M-10-4h20" stroke="${C.sun}" stroke-width="1.2" opacity=".6"/></g>` },
  fish: { slot: 'c', svg: () => `<g transform="translate(112 120) rotate(-28)"><path d="M-22 0q22-16 40 0q-18 16-40 0Z" fill="${C.red}"/><path d="M-22 0l-12-9v18Z" fill="${C.red}"/><circle cx="10" cy="-2" r="1.6" fill="${C.paper}"/></g><g fill="none" stroke="${C.water}" stroke-width="1.3"><path d="M70 146q10-10 20 0t20 0t20 0t20 0"/></g><g fill="${C.water}"><circle cx="86" cy="132" r="1.6"/><circle cx="140" cy="128" r="1.4"/></g>` },
  kite: { slot: 's', svg: () => `<g transform="translate(160 40) rotate(12)"><path d="M0-18L14 0 0 18-14 0Z" fill="${C.red}"/><path d="M0-18V18M-14 0H14" stroke="${C.gold}" stroke-width="1"/></g><path d="M162 58q-30 40-80 70" fill="none" stroke="${C.ink}" stroke-width=".9"/><path d="M164 58q4 10-2 18q6 6 0 12" fill="none" stroke="${C.red}" stroke-width="1"/>` },
  sprout: { slot: 'c', svg: () => `<path d="M90 160q20-10 40 0Z" fill="${C.ink}" opacity=".5"/><path d="M110 156q-2-22 2-34" fill="none" stroke="${C.deep}" stroke-width="2"/><path d="M111 132q-18-2-20-16q16-2 20 16Z" fill="${C.ink}"/><path d="M112 126q12-14 26-10q-6 14-26 10Z" fill="${C.ink}" opacity=".8"/>` },
  maple: { slot: 'r', svg: () => [[150, 150, 0, C.red], [172, 136, 30, C.sun], [130, 166, -20, C.sun], [190, 162, 10, C.red]].map(([x, y, r, c]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0-10l3 6 6-3-2 7 6 2-6 3 2 5-6-2-3 6-3-6-6 2 2-5-6-3 6-2-2-7 6 3Z" fill="${c}" opacity=".85"/>`).join('') },
  book: { slot: 'c', svg: () => `<g transform="translate(110 148)"><path d="M0-16q-16-8-34-4v24q18-4 34 4Z" fill="${C.paper}" stroke="${C.deep}" stroke-width="1.2"/><path d="M0-16q16-8 34-4v24q-18-4-34 4Z" fill="${C.paper}" stroke="${C.deep}" stroke-width="1.2"/><path d="M-28-12q12-2 22 2M-28-6q12-2 22 2M8-10q12-4 22-2M8-4q12-4 22-2" stroke="${C.pale}" stroke-width="1"/></g>` },
  pavilion: { slot: 'r', svg: () => `<g transform="translate(166 112)"><path d="M-28-8q28-20 56 0q-8-2-12 2h-32q-4-4-12-2Z" fill="${C.deep}"/><path d="M0-22v-6" stroke="${C.deep}" stroke-width="1.6"/><path d="M-16-6v26M16-6v26" stroke="${C.deep}" stroke-width="2"/><path d="M-22 20h44" stroke="${C.deep}" stroke-width="2"/></g>` },
  rock: { slot: 'l', svg: () => `<path d="M14 160q-4-30 22-40q22-6 34 12q10 18 0 28Z" fill="${C.pale}" stroke="${C.ink}" stroke-width="1.2"/><path d="M34 128q6 10 2 20M50 126q-4 12 6 22" fill="none" stroke="${C.ink}" stroke-width="1" opacity=".7"/>` },
  dandelion: { slot: 'l', svg: () => `<path d="M50 162q-6-40 0-80" fill="none" stroke="${C.deep}" stroke-width="1.6"/><g stroke="${C.ink}" stroke-width=".8">${Array.from({ length: 14 }, (_, i) => { const a = i * Math.PI * 2 / 14; return `<path d="M50 80l${(14 * Math.cos(a)).toFixed(1)} ${(14 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g><circle cx="50" cy="80" r="3" fill="${C.deep}"/><g fill="${C.ink}">${[[90, 60], [120, 46], [150, 70]].map(([x, y]) => `<path d="M${x} ${y}l6-6M${x + 6} ${y - 6}l2-3m-2 3 3 1" stroke="${C.ink}" stroke-width=".8"/>`).join('')}</g>` },
  fireworks: { slot: 's', svg: () => [[70, 40, C.red], [150, 30, C.gold], [120, 64, C.sun]].map(([x, y, c]) => `<g stroke="${c}" stroke-width="1.4" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return `<path d="M${(x + 6 * Math.cos(a)).toFixed(1)} ${(y + 6 * Math.sin(a)).toFixed(1)}l${(8 * Math.cos(a)).toFixed(1)} ${(8 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g>`).join('') },
  eaves: { slot: 'r', svg: () => `<path d="M120 20q50 10 100 0v12q-50 12-100-2Z" fill="${C.deep}" opacity=".85"/><g fill="none" stroke="${C.deep}" stroke-width="1.4" stroke-linecap="round"><path d="M150 50q4-5 8 0q4-5 8 0M176 62q4-5 8 0q4-5 8 0"/></g>` },
  lotus: { slot: 'c', svg: () => `<g transform="translate(112 142) scale(1.35)"><ellipse cx="-30" cy="10" rx="20" ry="5" fill="${C.ink}" opacity=".6"/><path d="M0 4q-14-10-6-28q6 12 6 28Zm0 0q14-10 6-28q-6 12-6 28Zm0 0q-4-20 0-34q4 14 0 34Z" fill="${C.blossom}"/></g>` }
};

const SKY_RULES = [[/虹/, 'rainbow'], [/雷/, 'thunder'], [/雪|霜|寒/, 'snow'], [/雨|霖/, 'rain'], [/月|夜|星|宵/, 'moon'], [/灯花|晓|残/, 'crescent'], [/霞|夕|晚|斜晖/, 'dusk'], [/云|雾|烟/, 'cloud']];
const TERRAIN_RULES = [[/江|水|泉|溪|海|潮|渡|舟|帆|船|塘|湖|池|川|河|流|浪|涓|鸭|鱼/, 'water'], [/山|峰|登|岭|岳|楼/, 'mountains']];
const MOTIF_RULES = [[/爆竹|万象/, 'fireworks'], [/舟|帆|船|渡|航/, 'boat'], [/鲤|鱼|龙门/, 'fish'], [/竹/, 'bamboo'], [/梅/, 'plum'], [/松/, 'pine'], [/柳|杨/, 'willow'], [/桥/, 'bridge'], [/鹤/, 'crane'], [/檐|巢|燕/, 'eaves'], [/雁|鸿|鹊|莺|凤|鸟/, 'birds'], [/灯|炉|火/, 'lantern'], [/茶|酌|杯|觞/, 'tea'], [/书|读|卷|简/, 'book'], [/鸢|风筝/, 'kite'], [/枫|霜叶/, 'maple'], [/蒲公英/, 'dandelion'], [/亭|庐/, 'pavilion'], [/石|磐/, 'rock'], [/莲|荷/, 'lotus'], [/花|桃|李|杏|梨|菊|稻|锦|芳|蝶|蜂/, 'flowers'], [/芽|苗|种|草|根|叶|蚕|春/, 'sprout']];
const DEFAULT_MOTIFS = ['sprout', 'birds', 'flowers', 'pine', 'pavilion', 'bamboo'];
const pick = (rules, text) => rules.find(([re]) => re.test(text))?.[1];

export function sceneParts(n) {
  const q = qians[n - 1];
  const text = q.name + q.poem.join('');
  const motifs = [];
  for (const [re, key] of MOTIF_RULES) if (re.test(text) && !motifs.some(m => MOTIF[m].slot === MOTIF[key].slot)) motifs.push(key);
  const watery = TERRAIN_RULES[0][0].test(text);
  if (!motifs.length) motifs.push(watery ? 'lotus' : DEFAULT_MOTIFS[n % DEFAULT_MOTIFS.length]);
  const terrain = pick(TERRAIN_RULES, text) || (motifs.some(m => ['boat', 'fish', 'bridge'].includes(m)) ? 'water' : 'hills');
  // Nothing grows out of open water: sprouts and flower beds become a lotus there.
  const placed = terrain === 'water' ? [...new Set(motifs.map(m => m === 'sprout' || m === 'flowers' ? 'lotus' : m))] : motifs;
  return { sky: pick(SKY_RULES, text) || 'sun', terrain, motifs: placed.filter((m, i, all) => all.findIndex(x => MOTIF[x].slot === MOTIF[m].slot) === i).slice(0, 2), lucky: q.level === '上上签' };
}

export function scene(n) {
  if (!Number.isInteger(n) || n < 1 || n > qians.length) return landscape();
  const p = sceneParts(n);
  // On water, anything rooted on the left (trees, bamboo, rocks) stands on a small bank.
  const ground = p.terrain === 'water' ? (p.motifs.some(m => MOTIF[m].slot === 'l') ? BANK : '') : GROUND;
  return `<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${SKY[p.sky](p.motifs.some(m => ['lantern', 'eaves', 'kite', 'fireworks'].includes(m)) ? 64 : undefined)}${TERRAIN[p.terrain]()}${ground}${p.motifs.map(m => MOTIF[m].svg()).join('')}${p.lucky ? lucky(18, 24) : ''}</svg>`;
}

// The original single illustration, still used for readings saved before the hundred-qian library.
export function landscape(kind = 'light') {
  const dark = kind === 'dark', ink = dark ? '#d0bd88' : '#829177', pale = dark ? '#b6b17e' : '#b5bda1', sun = dark ? '#ddc68d' : '#bd7756';
  return `<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="94" cy="46" r="27" fill="${sun}" opacity=".75"/><path d="M15 132c22-29 35-39 55-26 14 9 29 19 43 14 30-12 37-7 69 11l24 12H15Z" fill="${pale}" opacity=".58"/><path d="M6 147c22-3 38-25 57-29 22-5 28 30 53 25 16-3 23-14 38-9 20 7 26 20 55 17v12H6Z" fill="${ink}" opacity=".42"/><g fill="none" stroke="${ink}" stroke-linecap="round" stroke-width="1.25"><path d="M19 171c39-10 66-6 95-4m-78 13c26-5 57-6 86-2m9-17 50 3m-41 9h57M34 137C53 99 53 61 38 31M46 84c-6-13-18-13-28-16m28 11c14-17 24-21 34-20M44 57c-8-8-15-9-24-9M48 101c15-10 23-10 30-9"/><path d="M135 43q8-6 16 0 8-6 16 0m-34 14q5-4 10 0 5-4 10 0" opacity=".6"/></g><g fill="${ink}" opacity=".85"><ellipse cx="23" cy="65" rx="4" ry="10" transform="rotate(-55 23 65)"/><ellipse cx="35" cy="73" rx="4" ry="11" transform="rotate(-36 35 73)"/><ellipse cx="62" cy="67" rx="4" ry="11" transform="rotate(40 62 67)"/><ellipse cx="75" cy="57" rx="4" ry="9" transform="rotate(60 75 57)"/><ellipse cx="25" cy="47" rx="4" ry="10" transform="rotate(-65 25 47)"/><ellipse cx="40" cy="38" rx="3" ry="10" transform="rotate(-22 40 38)"/><ellipse cx="65" cy="92" rx="4" ry="10" transform="rotate(65 65 92)"/></g><path d="m153 117 10-4 8 4-9 3Z" fill="${sun}" opacity=".7"/></svg>`;
}
