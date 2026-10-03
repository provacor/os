// Study alarms block, shown at the bottom of the Study tab.

import { icon } from '../icons.js?v=202610030752';
import { esc } from '../components.js?v=202610030752';
import { listAlarms, keepAwake, leftText, leftPct, clockText, durationText, MAX_ALARMS } from '../alarms.js?v=202610030752';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const QUICK = [[30, '৩০ মিনিট'], [60, '১ ঘণ্টা'], [90, '১.৫ ঘণ্টা'], [120, '২ ঘণ্টা'], [180, '৩ ঘণ্টা']];

export function alarmsBlock() {
  const list = listAlarms();
  const full = list.length >= MAX_ALARMS;
  const now = Date.now();

  const cards = list
    .map((a, i) => `<li class="alarm ${a.fired ? 'fired' : ''}" style="--p:${leftPct(a, now)}%">
        <span class="al-no">${bn(i + 1)}</span>
        <span class="al-body">
          <span class="al-note">${a.note ? esc(a.note) : '<span class="muted">কোনো নোট নেই</span>'}</span>
          <span class="al-meta">${durationText(a.minutes)} · ${a.fired ? 'শেষ হয়েছে' : 'শেষ হবে'} ${clockText(a.end)}</span>
        </span>
        <span class="al-left" data-alarm-left="${a.id}">${a.fired ? 'সময় শেষ' : leftText(a, now)}</span>
        ${a.fired ? `<button class="task-del" data-alarm-restart="${a.id}" aria-label="আবার শুরু">${icon('revision')}</button>` : ''}
        <button class="task-del" data-alarm-del="${a.id}" aria-label="অ্যালার্ম মুছো">${icon('x')}</button>
        <span class="al-bar"></span>
      </li>`)
    .join('');

  const hours = [0, 1, 2, 3].map((h) => `<option value="${h}" ${h === 1 ? 'selected' : ''}>${bn(h)} ঘণ্টা</option>`).join('');
  const mins = Array.from({ length: 12 }, (_, i) => i * 5).map((m) => `<option value="${m}">${bn(m)} মিনিট</option>`).join('');

  return `<section class="card alarms-card rise" id="alarms" style="--i:6">
      <div class="block-head"><h2 class="card-title">${icon('bell')} স্টাডি অ্যালার্ম</h2><span class="muted small">${bn(list.length)}/${bn(MAX_ALARMS)}</span></div>
      ${list.length ? `<ul class="alarm-list">${cards}</ul>` : '<p class="muted small">একসাথে ৫টা পর্যন্ত অ্যালার্ম দেওয়া যাবে, প্রতিটা সর্বোচ্চ ৩ ঘণ্টা। প্রতিটার সাথে নোট লিখে রাখো কোনটা কীসের জন্য।</p>'}
      ${full
        ? '<p class="muted small al-full">৫টা অ্যালার্ম চলছে। নতুন দিতে আগে একটা মুছে ফেলো।</p>'
        : `<form class="alarm-form" data-alarm-form>
          <input id="alarmNote" type="text" maxlength="200" autocomplete="off" placeholder="এই অ্যালার্মের কাজ… যেমন: রসায়ন ১ম পত্র MCQ" aria-label="Alarm note">
          <div class="chip-row al-quick">${QUICK.map(([m, l]) => `<button type="button" class="chip" data-alarm-quick="${m}">${l}</button>`).join('')}</div>
          <div class="al-pick">
            <select id="alarmH" aria-label="ঘণ্টা">${hours}</select>
            <select id="alarmM" aria-label="মিনিট">${mins}</select>
            <button class="btn btn-primary tap" type="submit">${icon('bell')}<span>শুরু</span></button>
          </div>
        </form>`}
      <label class="al-awake"><input type="checkbox" data-alarm-awake ${keepAwake() ? 'checked' : ''}> অ্যালার্ম চলার সময় স্ক্রিন জাগিয়ে রাখো</label>
      <p class="muted small al-hint">${icon('info')} অ্যালার্ম বাজবে যখন অ্যাপটা খোলা থাকে। অ্যাপ বন্ধ থাকলেও সময় গোনা চলে, পরে খুললেই জানিয়ে দেবে।</p>
    </section>`;
}
