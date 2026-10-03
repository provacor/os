// Mission tab: plan today and the next six days. Each day has its own task list and note.

import { icon } from '../icons.js?v=202610030752';
import { esc } from '../components.js?v=202610030752';
import { week, todayKey, tasksOf, noteOf, leftovers } from '../mission.js?v=202610030752';

export const missionState = { day: null, week: 0 }; // selected day key (null = today) and week offset

const WEEKDAY = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
const MONTH = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

const bn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const dayName = (d) => WEEKDAY[d.date.getDay()];
const shortDate = (date) => `${bn(date.getDate())} ${MONTH[date.getMonth()]}`;
const fullDate = (date) => `${bn(date.getDate())} ${MONTH[date.getMonth()]}, ${WEEKDAY[date.getDay()]}`;

export function missionView() {
  const days = week(missionState.week);
  const sel = days.find((d) => d.key === missionState.day) ?? days.find((d) => d.isToday) ?? days[0];
  missionState.day = sel.key;
  const tasks = tasksOf(sel.key);
  const done = tasks.filter((t) => t.done).length;
  const weekTasks = days.flatMap((d) => tasksOf(d.key));
  const weekDone = weekTasks.filter((t) => t.done).length;

  const strip = days
    .map((d) => {
      const list = tasksOf(d.key);
      const n = list.length;
      const all = n && list.every((t) => t.done);
      return `<button class="day-chip ${d.key === sel.key ? 'on' : ''} ${all ? 'all-done' : ''} ${d.isToday ? 'today' : ''}" data-mission-day="${d.key}" aria-pressed="${d.key === sel.key}">
          <span class="dc-name">${SHORT[d.date.getDay()]}</span>
          <span class="dc-date">${bn(d.date.getDate())}</span>
          <span class="dc-count">${n ? `${bn(list.filter((t) => t.done).length)}/${bn(n)}` : '·'}</span>
        </button>`;
    })
    .join('');

  const rows = tasks.length
    ? tasks
        .map((t) => `<li class="task ${t.done ? 'done' : ''}">
            <button class="task-check" data-action="task-toggle" data-task="${esc(t.id)}" aria-pressed="${t.done}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
            <span class="task-text">${esc(t.text)}</span>
            <button class="task-del" data-action="task-del" data-task="${esc(t.id)}" aria-label="Delete task">${icon('x')}</button>
          </li>`)
        .join('')
    : `<li class="task-empty">${icon('target')}<span>${esc(dayName(sel))}-এর জন্য এখনো কোনো মিশন নেই। নিচে লিখে যোগ করো।</span></li>`;

  // Unfinished work from before this week; earlier days of this week are still in the strip.
  const old = sel.isToday ? leftovers(days[0].key) : [];
  const oldHtml = old.length
    ? `<section class="card mission-old rise" style="--i:3">
        <h2 class="card-title">${icon('clock')} আগের বাকি কাজ <span class="muted small">${bn(old.length)}টি</span></h2>
        <ul class="task-list">${old
          .slice(0, 20)
          .map((t) => `<li class="task">
              <span class="task-text">${esc(t.text)}<small>${esc(fullDate(new Date(t.key + 'T12:00:00')))}</small></span>
              <button class="btn tap task-move" data-action="task-move" data-from="${esc(t.key)}" data-task="${esc(t.id)}">আজকে আনো</button>
              <button class="task-del" data-action="task-del" data-from="${esc(t.key)}" data-task="${esc(t.id)}" aria-label="Delete task">${icon('x')}</button>
            </li>`)
          .join('')}</ul>
      </section>`
    : '';

  return {
    nav: 'mission',
    title: 'Mission',
    html: `<a class="card pf-link rise mi-plan" href="#/planner"><span class="pf-mini pf-blank a11y-ico">${icon('target')}</span><span class="pf-link-text"><b>পরীক্ষার প্ল্যান</b><small class="muted">পরীক্ষার তারিখ দিলে প্রতিদিনের পড়া নিজে থেকে বসিয়ে দেবে</small></span>${icon('chevron')}</a>
      <header class="page-title rise"><p class="eyebrow">Personal Study Mission</p><h1>পার্সোনাল স্টাডি মিশন</h1>
        <p class="muted">${missionState.week === 0 ? 'এই সপ্তাহে' : 'ওই সপ্তাহে'} ${bn(weekDone)}/${bn(weekTasks.length)} মিশন শেষ · শুধু তোমার ফোনেই সেভ থাকে</p></header>
      <div class="week-nav rise" style="--i:1">
        <button class="icon-btn" data-mission-week="-1" aria-label="Previous week">${icon('back')}</button>
        <span><b>${missionState.week === 0 ? 'এই সপ্তাহ' : missionState.week === 1 ? 'পরের সপ্তাহ' : missionState.week === -1 ? 'গত সপ্তাহ' : 'সপ্তাহ'}</b>
          <small>${esc(shortDate(days[0].date))} – ${esc(shortDate(days[6].date))}</small></span>
        <button class="icon-btn" data-mission-week="1" aria-label="Next week">${icon('chevron')}</button>
      </div>
      <div class="day-strip rise" style="--i:1" role="tablist" aria-label="Days">${strip}</div>
      <section class="card mission-day rise" style="--i:2">
        <div class="md-head">
          <div><h2>${esc(dayName(sel))}${sel.isToday ? ' <span class="today-tag">আজ</span>' : ''}</h2><p class="muted small">${esc(fullDate(sel.date))}</p></div>
          ${tasks.length ? `<span class="md-count">${bn(done)}/${bn(tasks.length)}</span>` : ''}
        </div>
        ${tasks.length ? `<div class="bar bar-thin" role="progressbar" aria-valuenow="${Math.round((done / tasks.length) * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="--p:${Math.round((done / tasks.length) * 100)}%"></span></div>` : ''}
        <ul class="task-list">${rows}</ul>
        <form class="task-add" data-task-form>
          <input id="taskInput" type="text" maxlength="300" autocomplete="off" placeholder="নতুন মিশন লেখো… যেমন: পদার্থ ২য় পত্র অধ্যায় ৬ MCQ" aria-label="New task">
          <button class="btn btn-primary tap" type="submit" aria-label="Add">${icon('check')}<span>যোগ</span></button>
        </form>
        <label class="note-label" for="dayNote">${icon('notes')} নোট</label>
        <textarea id="dayNote" class="day-note" data-mission-note="${sel.key}" rows="4" maxlength="5000" placeholder="এই দিনের জন্য প্ল্যান বা নোট লিখে রাখো…">${esc(noteOf(sel.key))}</textarea>
      </section>
      ${oldHtml}`,
  };
}
