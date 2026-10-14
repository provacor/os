// 6. Skill Tree & Character — XP levels give skill points; points unlock looks (outfits,
// backgrounds, effects) and a little daily help (50:50, skip). Help never raises mastery, and each
// node is unlocked once. XP, looks and real mastery are kept apart.

import { esc, bn, bar, refresh } from './core.js?v=202610141859';
import { gameState, playerLevel, xp, levelFloor, saveA } from '../learnstore.js?v=202610141859';
import { achCount } from './achievements.js?v=202610141859';

export const meta = { id: 'skills', emoji: '🌳', name: 'দক্ষতা গাছ ও চরিত্র', desc: 'XP দিয়ে দক্ষতা পয়েন্ট — নতুন পোশাক, ব্যাকগ্রাউন্ড, ইফেক্ট আর ৫০:৫০ / পাস সাহায্য খোলো।', need: 0 };
export const NODES = [
  { id: 'o_wiz', b: 'outfit', e: '🧙', name: 'জাদুকর', cost: 1 },
  { id: 'o_ninja', b: 'outfit', e: '🥷', name: 'নিনজা', cost: 1, req: 'o_wiz' },
  { id: 'o_sci', b: 'outfit', e: '🧑‍🔬', name: 'বিজ্ঞানী', cost: 2, req: 'o_ninja' },
  { id: 'o_astro', b: 'outfit', e: '🧑‍🚀', name: 'নভোচারী', cost: 2, req: 'o_sci' },
  { id: 'o_hero', b: 'outfit', e: '🦸', name: 'সুপারহিরো', cost: 3, req: 'o_astro' },
  { id: 'b_sun', b: 'bg', e: '🌅', name: 'সূর্যাস্ত', cost: 1, css: 'linear-gradient(135deg,#f97316,#ec4899)' },
  { id: 'b_forest', b: 'bg', e: '🌲', name: 'বন', cost: 1, req: 'b_sun', css: 'linear-gradient(135deg,#22c55e,#065f46)' },
  { id: 'b_ocean', b: 'bg', e: '🌊', name: 'সমুদ্র', cost: 2, req: 'b_forest', css: 'linear-gradient(135deg,#0ea5e9,#1e3a8a)' },
  { id: 'b_galaxy', b: 'bg', e: '🌌', name: 'ছায়াপথ', cost: 2, req: 'b_ocean', css: 'linear-gradient(135deg,#7c3aed,#0f172a)' },
  { id: 'e_spark', b: 'fx', e: '✨', name: 'ঝিলিক', cost: 1 },
  { id: 'e_fire', b: 'fx', e: '🔥', name: 'আগুনের আভা', cost: 2, req: 'e_spark' },
  { id: 'e_rainbow', b: 'fx', e: '🌈', name: 'রংধনু', cost: 2, req: 'e_fire' },
  { id: 'half1', b: 'help', e: '✂️', name: '৫০:৫০ — দিনে ১ বার', cost: 2 },
  { id: 'half2', b: 'help', e: '✂️', name: '৫০:৫০ — দিনে ২ বার', cost: 2, req: 'half1' },
  { id: 'half3', b: 'help', e: '✂️', name: '৫০:৫০ — দিনে ৩ বার', cost: 3, req: 'half2' },
  { id: 'skip1', b: 'help', e: '⏭', name: 'পাস — দিনে ১ বার', cost: 2 },
  { id: 'skip2', b: 'help', e: '⏭', name: 'পাস — দিনে ২ বার', cost: 3, req: 'skip1' },
];
const BRANCHES = [['outfit', '👕 পোশাক'], ['bg', '🖼️ ব্যাকগ্রাউন্ড'], ['fx', '💫 ইফেক্ট'], ['help', '🛟 সাহায্য']];
const st = () => gameState('skills', { nodes: {}, equip: {}, used: {} });

export const pointsTotal = () => playerLevel() + Math.floor(achCount() / 2); // level 1 already gives 1 point
export const pointsSpent = () => NODES.filter((n) => st().nodes[n.id]).reduce((s, n) => s + n.cost, 0);
export const pointsLeft = () => Math.max(0, pointsTotal() - pointsSpent());
export function progress() { return Math.round((NODES.filter((n) => st().nodes[n.id]).length / NODES.length) * 100); }

export function avatarHtml(size = '') {
  const eq = st().equip;
  const outfit = NODES.find((n) => n.id === eq.outfit)?.e ?? '🧑‍🎓';
  const bg = NODES.find((n) => n.id === eq.bg)?.css ?? 'linear-gradient(135deg,var(--violet),var(--blue))';
  const fx = eq.fx ? `fx-${eq.fx}` : '';
  return `<span class="ar-avatar ${size} ${fx}" style="background:${bg}" aria-hidden="true">${outfit}</span>`;
}

export function view() {
  const s = st();
  const lv = playerLevel(), next = levelFloor(lv + 1), cur = levelFloor(lv);
  const pct = Math.min(100, Math.round(((xp() - cur) / (next - cur)) * 100));
  const branch = ([b, label]) => `<section class="block"><div class="block-head"><h2>${label}</h2></div><div class="ar-tree">${NODES.filter((n) => n.b === b).map((n) => {
    const have = !!s.nodes[n.id];
    const can = !have && (!n.req || s.nodes[n.req]) && pointsLeft() >= n.cost;
    const blocked = !have && n.req && !s.nodes[n.req];
    const equipped = s.equip[b] === n.id;
    const cls = have ? 'have' : can ? 'can' : 'lock';
    const action = have
      ? (b === 'help' ? '<small>✓ চালু</small>' : `<button class="chip-btn tap" data-ar-equip="${n.id}">${equipped ? '✓ পরা আছে' : 'পরো'}</button>`)
      : can ? `<button class="btn btn-primary tap" data-ar-unlock="${n.id}">খোলো · ${bn(n.cost)} পয়েন্ট</button>`
        : `<small>${blocked ? '🔒 আগেরটা খোলো' : `🔒 ${bn(n.cost)} পয়েন্ট লাগবে`}</small>`;
    return `<div class="ar-skill ${cls}"><span class="ar-skill-e">${n.e}</span><b>${esc(n.name)}</b>${action}</div>`;
  }).join('<span class="ar-tree-link" aria-hidden="true"></span>')}</div></section>`;
  return {
    title: meta.name,
    html: `<div id="arSkills"><header class="ar-char rise">${avatarHtml('xl')}<div>
        <h1>আমার চরিত্র</h1><p class="muted small">লেভেল ${bn(lv)} · ${bn(xp())} XP · পরের লেভেলে ${bn(Math.max(0, next - xp()))} XP বাকি</p>
        ${bar(Math.max(0, pct), 'bar-thin')}
        <p class="ar-points">🌟 দক্ষতা পয়েন্ট: <b>${bn(pointsLeft())}</b> <small class="muted">(প্রতি লেভেলে ১টি, প্রতি ২টি অর্জনে ১টি)</small></p></div></header>
      <p class="muted small">সাহায্য (৫০:৫০, পাস) নিয়ে দেওয়া উত্তর আয়ত্ত বাড়ায় না — শুধু আটকে গেলে কাজে লাগে। প্রতিদিন নতুন করে ভরে যায়।</p>
      ${BRANCHES.map(branch).join('')}</div>`,
    after: () => {
      document.getElementById('arSkills')?.addEventListener('click', onClick);
    },
  };
}
function onClick(e) {
  const u = e.target.closest('[data-ar-unlock]');
  const q = e.target.closest('[data-ar-equip]');
  if (!u && !q) return;
  const s = st();
  if (u) {
    const n = NODES.find((x) => x.id === u.dataset.arUnlock);
    if (!n || s.nodes[n.id] || (n.req && !s.nodes[n.req]) || pointsLeft() < n.cost) return;
    s.nodes[n.id] = 1;
    if (n.b !== 'help') s.equip[n.b] = n.id;
  } else {
    const n = NODES.find((x) => x.id === q.dataset.arEquip);
    if (!n || !s.nodes[n.id]) return;
    s.equip[n.b] = s.equip[n.b] === n.id ? null : n.id;
  }
  saveA();
  refresh();
}
