// Achievements: unlocked once by real progress (answers, mastery, streak, finished games), each
// with a one-time coin reward the player claims. Nothing here changes mastery.

import { A, S, gameState, bestStreak, claim, claimed, saveA, today, FARM_DEFAULTS } from '../learnstore.js?v=202610141910';

const mastered = () => Object.values(S.m).filter((v) => v >= 2).length;
const anyKey = (o, test) => Object.entries(o).some(([key, v]) => test(key, v));
export const ACH = [
  { id: 'first', e: '👣', name: 'প্রথম পদক্ষেপ', desc: 'প্রথম প্রশ্নের উত্তর দাও', coins: 10, test: () => A.stats.n >= 1 },
  { id: 'n50', e: '📘', name: '৫০ প্রশ্ন', desc: 'মোট ৫০টি প্রশ্নের উত্তর দাও', coins: 30, test: () => A.stats.n >= 50 },
  { id: 'n200', e: '📚', name: '২০০ প্রশ্ন', desc: 'মোট ২০০টি প্রশ্নের উত্তর দাও', coins: 80, test: () => A.stats.n >= 200 },
  { id: 'n1000', e: '🏛️', name: '১০০০ প্রশ্ন', desc: 'মোট ১০০০টি প্রশ্নের উত্তর দাও', coins: 300, test: () => A.stats.n >= 1000 },
  { id: 'm1', e: '🎓', name: 'প্রথম আয়ত্ত', desc: 'একটি প্রশ্ন পরপর ২ বার সঠিক করে আয়ত্তে আনো', coins: 10, test: () => mastered() >= 1 },
  { id: 'm50', e: '🧠', name: '৫০টি আয়ত্তে', desc: '৫০টি প্রশ্ন আয়ত্তে আনো', coins: 60, test: () => mastered() >= 50 },
  { id: 'm200', e: '🌟', name: '২০০টি আয়ত্তে', desc: '২০০টি প্রশ্ন আয়ত্তে আনো', coins: 200, test: () => mastered() >= 200 },
  { id: 's3', e: '🔥', name: '৩ দিনের ধারা', desc: 'টানা ৩ দিন অন্তত ৫টি প্রশ্নের উত্তর দাও', coins: 30, test: () => bestStreak() >= 3 },
  { id: 's7', e: '🔥', name: '৭ দিনের ধারা', desc: 'টানা ৭ দিন পড়ো', coins: 80, test: () => bestStreak() >= 7 },
  { id: 's30', e: '☄️', name: '৩০ দিনের ধারা', desc: 'টানা ৩০ দিন পড়ো', coins: 400, test: () => bestStreak() >= 30 },
  { id: 'rec20', e: '🩹', name: 'ভুল শোধরানো', desc: 'আগে ভুল হওয়া ২০টি প্রশ্ন সঠিক করো', coins: 50, test: () => A.stats.rec >= 20 },
  { id: 'king', e: '👑', name: 'রাজ্য জয়', desc: 'অধ্যায় রাজ্যের একটি দুর্গ জয় করো', coins: 100, test: () => anyKey(gameState('kingdom', { stars: {} }).stars, (k, v) => k.endsWith('/castle') && v > 0) },
  { id: 'dragon', e: '🐉', name: 'ড্রাগন শিকারি', desc: 'একটি অধ্যায়ের ড্রাগনকে হারাও', coins: 100, test: () => anyKey(gameState('dragon', { defeated: {} }).defeated, (k) => k.endsWith('/boss')) },
  { id: 'chest', e: '🧰', name: 'গুপ্তধন শিকারি', desc: 'প্রথম গুপ্তধনের সিন্দুক খোলো', coins: 50, test: () => anyKey(A.claimed, (k) => k.startsWith('treasure:chest:')) },
  { id: 'case', e: '🕵️', name: 'গোয়েন্দা', desc: 'একটি রহস্যের সমাধান করো', coins: 100, test: () => anyKey(A.claimed, (k) => k.startsWith('detective:solved:')) },
  { id: 'planet5', e: '🪐', name: 'মহাকাশচারী', desc: '৫টি গ্রহ ঘুরে দেখো', coins: 60, test: () => Object.keys(gameState('space', { explored: {} }).explored).length >= 5 },
  { id: 'missions', e: '🎯', name: 'মিশন মাস্টার', desc: 'এক দিনের সব মিশন শেষ করো', coins: 40, test: () => anyKey(A.claimed, (k) => k.startsWith('mission:bonus:')) },
  { id: 'perfect', e: '💯', name: 'নিখুঁত', desc: 'নির্ভুলতা চ্যালেঞ্জে সব উত্তর সঠিক', coins: 60, test: () => !!gameState('arcade', { perfect: 0 }).perfect },
  { id: 'farm10', e: '🌾', name: 'দক্ষ চাষি', desc: 'খামারে ১০ বার ফসল তোলো', coins: 40, test: () => gameState('farm', FARM_DEFAULTS).harvests >= 10 },
  { id: 'tour', e: '🏆', name: 'টুর্নামেন্ট খেলোয়াড়', desc: 'একটি টুর্নামেন্ট শেষ করো', coins: 30, test: () => gameState('tournament', { results: [] }).results.length > 0 },
];

// Marks newly reached achievements; returns them (for the results screen).
export function checkAchievements() {
  const fresh = [];
  for (const a of ACH) {
    let ok = false;
    try { ok = a.test(); } catch { ok = false; }
    if (ok && !A.ach[a.id]) { A.ach[a.id] = today(); fresh.push(a); }
  }
  if (fresh.length) saveA();
  return fresh;
}
export const achCount = () => Object.keys(A.ach).length;
export const achClaimed = (id) => claimed(`ach:${id}`);
export function claimAch(id) {
  const a = ACH.find((x) => x.id === id);
  if (!a || !A.ach[id]) return false;
  return claim(`ach:${id}`, { coins: a.coins });
}
