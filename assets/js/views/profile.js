// Profile: your name, photo and leaderboard privacy, plus your real app-usage time.

import { icon } from '../icons.js?v=202610100121';
import { esc } from '../components.js?v=202610100121';
import { getProfile, usageStats, durationBn, weekSeconds } from '../profile.js?v=202610100121';
import { leaderboardReady, topUsers, syncLeaderboard } from '../leaderboard.js?v=202610100121';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

export function profileView() {
  const p = getProfile();
  const u = usageStats();
  const shownName = p.anonymous ? 'Anonymous' : p.name || 'নাম দেওয়া হয়নি';
  const mode = p.leaderboard === false ? 'off' : p.anonymous ? 'anon' : 'named';
  const photo = (cls) =>
    p.photo
      ? `<img class="${cls}" src="${esc(p.photo)}" alt="">`
      : `<span class="${cls} pf-blank">${icon('user')}</span>`;

  return {
    nav: 'more',
    title: 'প্রোফাইল',
    back: '#/more',
    html: `<header class="page-title rise"><p class="eyebrow">Profile</p><h1>আমার প্রোফাইল</h1></header>

      <section class="card pf-card rise" style="--i:1">
        <div class="pf-photo-wrap">
          ${photo('pf-photo')}
          <label class="pf-cam" aria-label="ছবি বদলাও">${icon('user')}<input type="file" accept="image/*" data-profile-photo hidden></label>
        </div>
        <form class="pf-form" data-profile-form>
          <label for="pfName" class="pf-label">তোমার নাম</label>
          <div class="task-add">
            <input id="pfName" type="text" maxlength="40" autocomplete="name" value="${esc(p.name)}" placeholder="নাম লেখো">
            <button class="btn btn-primary tap" type="submit">${icon('check')}<span>সেভ</span></button>
          </div>
          ${p.photo ? '<button type="button" class="link pf-remove" data-profile-photo-remove>ছবি সরাও</button>' : '<p class="muted small">ছবির উপরের বোতাম চেপে নিজের ছবি দাও।</p>'}
        </form>
      </section>

      <section class="card rise" style="--i:2">
        <h2 class="card-title">${icon('eyeoff')} লিডারবোর্ডে কীভাবে দেখাবে</h2>
        <div class="seg">
          <button class="seg-btn ${mode === 'anon' ? 'on' : ''}" data-profile-mode="anon" aria-pressed="${mode === 'anon'}">${icon('eyeoff')}<span>Anonymous</span></button>
          <button class="seg-btn ${mode === 'named' ? 'on' : ''}" data-profile-mode="named" aria-pressed="${mode === 'named'}">${icon('user')}<span>নাম দেখাও</span></button>
          <button class="seg-btn ${mode === 'off' ? 'on' : ''}" data-profile-mode="off" aria-pressed="${mode === 'off'}">${icon('x')}<span>যোগ দেব না</span></button>
        </div>
        <p class="muted small pf-note">${{
          anon: 'লিডারবোর্ডে তোমার নাম বা ছবি দেখাবে না, শুধু সময় দেখাবে।',
          named: 'লিডারবোর্ডে তোমার নাম সবাই দেখতে পাবে। ছবি শুধু তোমার ফোনেই থাকে, অনলাইনে যায় না।',
          off: 'তুমি লিডারবোর্ডে থাকবে না। তোমার সময় কোথাও পাঠানো হবে না।',
        }[mode]}</p>
        ${mode === 'off' ? '' : `<div class="lb-preview">
          <span class="lb-rank">#</span>
          <span class="lb-ph pf-blank">${icon(p.anonymous ? 'eyeoff' : 'user')}</span>
          <span class="lb-name">${esc(shownName)}</span>
          <span class="lb-time">${durationBn(weekSeconds())}</span>
        </div>
        <p class="muted small">অন্যরা তোমাকে ঠিক এভাবে দেখবে।</p>`}
      </section>

      <section class="card rise" style="--i:3">
        <h2 class="card-title">${icon('clock')} অ্যাপ ব্যবহারের সময়</h2>
        <div class="pf-stats">
          <div><b>${durationBn(u.today)}</b><span>আজ</span></div>
          <div><b>${durationBn(u.week)}</b><span>গত ৭ দিন</span></div>
          <div><b>${durationBn(u.total)}</b><span>মোট · ${bn(u.days)} দিন</span></div>
        </div>
        <p class="muted small pf-note">শুধু অ্যাপ খোলা ও স্ক্রিনে থাকার সময় গোনা হয়।</p>
      </section>

      <section class="card lb-card rise" style="--i:4">
        <h2 class="card-title">${icon('trophy')} এই সপ্তাহের লিডারবোর্ড</h2>
        ${leaderboardReady()
          ? '<ol class="lb-list" id="lbList"><li class="muted small">লোড হচ্ছে…</li></ol><p class="muted small pf-note">শনিবার থেকে শুক্রবার পর্যন্ত অ্যাপ ব্যবহারের সময়। প্রতি মিনিটে আপডেট হয়।</p>'
          : '<p class="muted small">লিডারবোর্ড এখনো চালু হয়নি। চালু হলে এখানে সবচেয়ে বেশি সময় ব্যবহারকারীদের তালিকা দেখাবে।</p>'}
      </section>`,
    after: () => {
      if (!leaderboardReady()) return;
      syncLeaderboard()
        .catch(() => {})
        .then(() => topUsers(20))
        .then((rows) => {
          const box = document.getElementById('lbList');
          if (!box || !rows) return;
          box.innerHTML = rows.length
            ? rows.map((r, i) => `<li class="lb-preview ${r.me ? 'me' : ''}">
                <span class="lb-rank">${bn(i + 1)}</span>
                <span class="lb-ph pf-blank">${icon(r.name ? 'user' : 'eyeoff')}</span>
                <span class="lb-name">${esc(r.name || 'Anonymous')}${r.me ? ' <small>(তুমি)</small>' : ''}</span>
                <span class="lb-time">${durationBn(r.seconds)}</span>
              </li>`).join('')
            : '<li class="muted small">এই সপ্তাহে এখনো কেউ নেই।</li>';
        })
        .catch(() => {
          const box = document.getElementById('lbList');
          if (box) box.innerHTML = '<li class="muted small">লিডারবোর্ড লোড করা গেল না। ইন্টারনেট চেক করো।</li>';
        });
    },
  };
}
