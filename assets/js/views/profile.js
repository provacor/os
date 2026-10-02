// Profile: your name, photo and leaderboard privacy, plus your real app-usage time.

import { icon } from '../icons.js?v=202610021310';
import { esc } from '../components.js?v=202610021310';
import { getProfile, usageStats, durationBn } from '../profile.js?v=202610021310';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

export function profileView() {
  const p = getProfile();
  const u = usageStats();
  const shownName = p.anonymous ? 'Anonymous' : p.name || 'নাম দেওয়া হয়নি';
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
        <div class="seg seg-2">
          <button class="seg-btn ${p.anonymous ? 'on' : ''}" data-profile-anon="1" aria-pressed="${p.anonymous}">${icon('eyeoff')}<span>Anonymous</span></button>
          <button class="seg-btn ${p.anonymous ? '' : 'on'}" data-profile-anon="0" aria-pressed="${!p.anonymous}">${icon('user')}<span>নাম ও ছবি</span></button>
        </div>
        <p class="muted small pf-note">${p.anonymous
          ? 'Anonymous থাকলে লিডারবোর্ডে তোমার নাম বা ছবি দেখাবে না, শুধু সময় দেখাবে।'
          : 'লিডারবোর্ডে তোমার নাম ও ছবি সবাই দেখতে পাবে।'}</p>
        <div class="lb-preview">
          <span class="lb-rank">#</span>
          ${p.anonymous ? `<span class="lb-ph pf-blank">${icon('eyeoff')}</span>` : photo('lb-ph')}
          <span class="lb-name">${esc(shownName)}</span>
          <span class="lb-time">${durationBn(u.week)}</span>
        </div>
        <p class="muted small">অন্যরা তোমাকে ঠিক এভাবে দেখবে।</p>
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
        <h2 class="card-title">${icon('trophy')} লিডারবোর্ড</h2>
        <p class="muted small">সবার সময় একসাথে মিলিয়ে র‍্যাংক দেখাতে একটা অনলাইন ডাটাবেস লাগবে। সেটা যুক্ত হলে এখানে সবচেয়ে বেশি সময় ব্যবহারকারীদের তালিকা দেখাবে। তোমার নাম, ছবি আর Anonymous সেটিং এখনই সেভ থাকছে, তখন সেগুলোই ব্যবহার হবে।</p>
      </section>`,
  };
}
