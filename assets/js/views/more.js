// More: appearance, data, syllabus source status, about.

import { icon } from '../icons.js?v=202610071239';
import { esc } from '../components.js?v=202610071239';
import { themePref } from '../theme.js?v=202610071239';
import { a11y } from '../a11y.js?v=202610071239';
import { getProfile } from '../profile.js?v=202610071239';

export function moreView(model) {
  const pref = themePref();
  const seg = [['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'], ['system', 'System', 'spark']]
    .map(([v, l, ic]) => `<button class="seg-btn ${pref === v ? 'on' : ''}" data-theme-set="${v}" aria-pressed="${pref === v}">${icon(ic)}<span>${l}</span></button>`)
    .join('');

  const rows = model.papers
    .map((p) => {
      const unverified = p.chapters.filter((c) => c.verification !== 'verified').length;
      return `<tr><td>${esc(p.subject.name)}</td><td>${esc(p.name)}</td><td>${p.chapters.length}</td>
        <td>${unverified ? `<span class="flag">${unverified} to verify</span>` : '<span class="ok-tag">Verified</span>'}</td></tr>`;
    })
    .join('');

  const me = getProfile();
  const a11yRow = `<a class="card pf-link rise" href="#/a11y" style="--i:0">
      <span class="pf-mini pf-blank a11y-ico">${icon('a11y')}</span>
      <span class="pf-link-text"><b>Accessibility · সহজে ব্যবহার</b><small class="muted">বড় লেখা, dyslexia, high contrast, ভয়েস, ক্যাপশন</small></span>
      ${icon('chevron')}
    </a>`;
  const profileRow = `<a class="card pf-link rise" href="#/profile" style="--i:0">
      ${me.photo ? `<img class="pf-mini" src="${esc(me.photo)}" alt="">` : `<span class="pf-mini pf-blank">${icon('user')}</span>`}
      <span class="pf-link-text"><b>${esc(me.name || 'প্রোফাইল বানাও')}</b><small class="muted">নাম, ছবি · লিডারবোর্ড · ব্যবহারের সময়</small></span>
      ${icon('chevron')}
    </a>`;

  return {
    nav: 'more',
    title: 'More',
    html: `<header class="page-title rise"><h1>More</h1></header>
      ${profileRow}
      ${a11yRow}
      <a class="card pf-link rise" href="#/backup" style="--i:0"><span class="pf-mini pf-blank a11y-ico">${icon('key')}</span><span class="pf-link-text"><b>Backup · ব্যাকআপ ও রিস্টোর</b><small class="muted">পাসওয়ার্ড দিয়ে এনক্রিপ্ট করা ফাইল, ফোন হারালেও তথ্য থাকবে</small></span>${icon('chevron')}</a>
      <section class="card rise" style="--i:1"><h2 class="card-title">${icon('sun')} Appearance</h2><div class="seg">${seg}</div>
        <div class="bright">
          <label class="pf-label" for="brightRange">উজ্জ্বলতা (Brightness) <b id="brightVal">${a11y().bright}%</b></label>
          <div class="bright-row">${icon('moon')}<input id="brightRange" type="range" min="50" max="130" step="5" value="${a11y().bright}" data-bright aria-label="উজ্জ্বলতা">${icon('sun')}</div>
          <div class="chip-row">${[[60, 'রাতে পড়া'], [80, 'চোখের আরাম'], [100, 'স্বাভাবিক'], [120, 'বেশি উজ্জ্বল']].map(([v, l]) => `<button class="chip ${a11y().bright === v ? 'on' : ''}" data-bright-set="${v}">${l}</button>`).join('')}</div>
          <p class="muted small">অ্যাপের ভেতরের উজ্জ্বলতা বদলায়, ফোনের নিজের brightness নয়।</p>
        </div></section>
      <section class="card rise" style="--i:2"><h2 class="card-title">${icon('map')} Syllabus source</h2>
        <p class="muted small">Chapter names come from the syllabus photos. Items still marked <span class="flag">verify</span> need a check.</p>
        <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Paper</th><th>Ch.</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
      <section class="card rise" style="--i:3"><h2 class="card-title">${icon('trash')} Data on this device</h2>
        <p class="muted small">Progress, study history and recent searches are stored only in this browser.</p>
        <button class="btn btn-danger tap" data-action="reset">Reset progress & history</button></section>
      <section class="card about rise" style="--i:4"><img class="avatar lg" src="assets/img/avatar.jpg" alt="" width="56" height="56">
        <div><h2>Provacor</h2><p class="muted small">Website, UI &amp; design by Provacor</p><p class="muted small">© ${new Date().getFullYear()} Provacor · All rights reserved</p></div></section>`,
  };
}
