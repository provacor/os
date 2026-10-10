// Focus mode page: set up → running (full screen) → review.

import { icon } from '../icons.js?v=202610100130';
import { esc } from '../components.js?v=202610100130';
import { focusRun, focusStats, focusLog, elapsedMs, totalMs, isPaused, SOUNDS } from '../focus.js?v=202610100130';
import { tasksOf, todayKey } from '../mission.js?v=202610100130';

export const focusState = { review: null, minutes: 25, sound: 'none' };
const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const pad = (n) => String(n).padStart(2, '0');
export const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return bn(`${pad(Math.floor(s / 60))}:${pad(s % 60)}`); };

export function focusView() {
  const run = focusRun();
  if (run) {
    const left = totalMs() - elapsedMs();
    const pct = Math.min(100, (elapsedMs() / totalMs()) * 100);
    return {
      nav: 'study', title: 'Focus', focus: true,
      html: `<section class="fx" aria-live="off">
          <p class="fx-label">এখনকার লক্ষ্য</p>
          <h1 class="fx-target">${esc(run.target || 'মনোযোগ দিয়ে পড়া')}</h1>
          <div class="fx-clock" id="fxClock" role="timer" aria-label="বাকি সময়">${clock(left)}</div>
          <div class="fx-bar"><span id="fxBar" style="width:${pct}%"></span></div>
          <p class="fx-sub" id="fxSub">${isPaused() ? 'থামানো আছে' : `${bn(run.minutes)} মিনিটের সেশন`}${run.leaves ? ` · ${bn(run.leaves)} বার অ্যাপ ছেড়েছ` : ''}</p>
          <div class="fx-btns">
            <button class="btn tap" data-fx-pause>${icon(isPaused() ? 'play' : 'stop')}<span>${isPaused() ? 'আবার শুরু' : 'বিরতি'}</span></button>
            <button class="btn tap" data-fx-stop>${icon('check')}<span>শেষ করো</span></button>
          </div>
          <p class="fx-tip">${icon('info')}<span>ফোনের <b>Do Not Disturb</b> চালু রাখো, নোটিফিকেশন আসবে না। অ্যাপ ছেড়ে গেলে গুনে রাখা হবে।</span></p>
        </section>`,
    };
  }

  const r = focusState.review;
  if (r) {
    return {
      nav: 'study', title: 'Focus', back: '#/focus',
      html: `<header class="page-title rise"><p class="eyebrow">Session শেষ</p><h1>দারুণ! ${bn(r.minutes)} মিনিট পড়েছ</h1>
          <p class="muted">${r.target ? `লক্ষ্য: ${esc(r.target)} · ` : ''}${r.leaves ? `${bn(r.leaves)} বার অ্যাপ ছেড়েছিলে` : 'একবারও অ্যাপ ছাড়োনি 👏'}</p></header>
        <form class="card fx-review rise" data-fx-review="${esc(r.id)}">
          <p class="pf-label">লক্ষ্য কি শেষ হয়েছে?</p>
          <div class="seg seg-2"><label class="seg-btn"><input type="radio" name="done" value="1" required> হ্যাঁ</label><label class="seg-btn"><input type="radio" name="done" value="0"> পুরোটা না</label></div>
          <p class="pf-label">কেমন মনোযোগ ছিল?</p>
          <div class="fx-stars">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}" ${n === 4 ? 'checked' : ''}><span>★</span></label>`).join('')}</div>
          <label class="pf-label" for="fxNote">কী শিখলে / কোথায় আটকে গেলে? (ঐচ্ছিক)</label>
          <textarea id="fxNote" name="note" rows="3" maxlength="1000"></textarea>
          <button class="btn btn-primary tap" type="submit">${icon('check')}<span>সেভ করো</span></button>
        </form>`,
    };
  }

  const st = focusStats();
  const todayTasks = tasksOf(todayKey()).filter((t) => !t.done);
  const recent = focusLog().slice(0, 5);
  return {
    nav: 'study', title: 'Focus mode', back: '#/study',
    html: `<header class="page-title rise"><p class="eyebrow">Focus mode</p><h1>মনোযোগ দিয়ে পড়ো</h1>
        <p class="muted">আজ ${bn(st.todayMin)} মিনিট (${bn(st.todayCount)}টি সেশন) · এই সপ্তাহে ${bn(st.weekMin)} মিনিট</p></header>
      <form class="card fx-setup rise" style="--i:1" data-fx-form>
        <label class="pf-label" for="fxGoal">এই সেশনের লক্ষ্য</label>
        <input id="fxGoal" name="goal" maxlength="200" placeholder="যেমন: ভেক্টর — ডট ও ক্রস গুণন অনুশীলন" value="">
        ${todayTasks.length ? `<div class="chip-row fx-tasks">${todayTasks.slice(0, 5).map((t) => `<button type="button" class="chip" data-fx-task="${esc(t.id)}" data-text="${esc(t.text)}">${icon('target')} ${esc(t.text.slice(0, 40))}</button>`).join('')}</div>` : ''}
        <input type="hidden" name="taskId" value="">
        <p class="pf-label">সময়</p>
        <div class="chip-row fx-mins">${[25, 45, 60, 90].map((m) => `<button type="button" class="chip ${focusState.minutes === m ? 'on' : ''}" data-fx-min="${m}">${bn(m)} মিনিট</button>`).join('')}</div>
        <p class="pf-label">পেছনে শব্দ (ঐচ্ছিক)</p>
        <div class="chip-row fx-sounds">${SOUNDS.map(([id, l]) => `<button type="button" class="chip ${focusState.sound === id ? 'on' : ''}" data-fx-sound="${id}">${l}</button>`).join('')}</div>
        <button class="btn btn-primary tap fx-start" type="submit">${icon('play')}<span>Focus শুরু করো</span></button>
        <p class="muted small">শুরু করলে পুরো স্ক্রিন হবে, স্ক্রিন বন্ধ হবে না, আর নিচের বার লুকিয়ে যাবে।</p>
      </form>
      ${recent.length ? `<section class="card rise" style="--i:2"><h2 class="card-title">${icon('clock')} আগের সেশন</h2>
        <ul class="fx-log">${recent.map((s) => `<li><b>${bn(s.minutes)} মি</b> <span>${esc(s.target || 'লক্ষ্য দেওয়া নেই')}</span> <small class="muted">${s.rating ? '★'.repeat(s.rating) : ''}${s.done === true ? ' · শেষ' : s.done === false ? ' · অর্ধেক' : ''}</small></li>`).join('')}</ul></section>` : ''}`,
  };
}
