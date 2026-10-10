// Accessibility settings page.

import { icon } from '../icons.js?v=202610100150';
import { a11y, FONT_STEPS, canSpeak, canListen } from '../a11y.js?v=202610100150';
import { hfPrefs, hfSupport } from '../handsfree.js?v=202610100150';

const hfToggle = (key, on, title, text) => `<label class="a11y-row">
    <span><b>${title}</b><small class="muted">${text}</small></span>
    <input type="checkbox" class="switch" data-hf-pref="${key}" ${on ? 'checked' : ''}>
  </label>`;

function handsfreeCard(i) {
  const p = hfPrefs();
  const sup = hfSupport();
  const gapSeg = [[2, '২ সে.'], [4, '৪ সে.'], [8, '৮ সে.'], [15, '১৫ সে.']]
    .map(([v, l]) => `<button class="seg-btn ${p.gap === v ? 'on' : ''}" data-hf-gap="${v}" aria-pressed="${p.gap === v}">${l}</button>`).join('');
  return `<section class="card rise a11y-list hf-card" style="--i:${i}" id="handsfree">
      <h2 class="card-title">${icon('speaker')} ইয়ারবাড / হেডফোন দিয়ে পড়া (হ্যান্ডস-ফ্রি)</h2>
      <p class="small">QCY MeloBuds Pro বা যেকোনো ব্লুটুথ ইয়ারবাড, হেডফোনের বোতাম, লক-স্ক্রিনের মিডিয়া কন্ট্রোল বা ব্লুটুথ রিমোট দিয়ে অ্যাপ চালাও। যেকোনো সেকশনে (MCQ, CQ, ক, খ, Concepts…) <b>"ইয়ারবাডে শুনে শুনে পড়ো"</b> বোতাম চাপো।</p>
      <div class="hf-map">
        <div><b>⏯ এক ট্যাপ (প্লে/পজ)</b><span>প্রশ্ন পড়ার পর → উত্তর শোনাবে; উত্তরের পর → পরের প্রশ্ন; পড়ার মাঝে → থামাবে</span></div>
        <div><b>⏭ পরের ট্র্যাক</b><span>পরের প্রশ্ন</span></div>
        <div><b>⏮ আগের ট্র্যাক</b><span>এই প্রশ্ন আবার শোনো (প্রশ্ন শুরুর ৪ সেকেন্ডের মধ্যে চাপলে আগের প্রশ্ন)</span></div>
        <div><b>🎙 মুখে বলো</b><span>MCQ-র পর "ক", "খ", "গ", "ঘ" বলো — সঠিক/ভুল জানাবে, ভুল হলে ভুলের খাতায় জমা হবে। আরও বলা যায়: "উত্তর", "পরের", "আগের", "আবার", "হয়েছে", "থামো"</span></div>
      </div>
      ${hfToggle('voiceAnswer', p.voiceAnswer, 'MCQ-র উত্তর মুখে বলো', sup.listen ? 'প্রশ্ন পড়া শেষে ইয়ারবাডের মাইকে উত্তর শুনবে' : 'এই ব্রাউজারে ভয়েস সাপোর্ট নেই — Android-এ Chrome ব্যবহার করো')}
      ${hfToggle('readOptions', p.readOptions, 'MCQ-র অপশনগুলোও পড়ো', 'বন্ধ করলে শুধু প্রশ্ন পড়বে')}
      ${hfToggle('autoAnswer', p.autoAnswer, 'নিজে থেকে উত্তর শোনাও', 'প্রশ্নের পর একটু থেমে উত্তর বলবে, ট্যাপ লাগবে না')}
      ${hfToggle('autoNext', p.autoNext, 'নিজে থেকে পরের প্রশ্নে যাও', 'দুটো একসাথে চালু করলে পুরো সেকশন পডকাস্টের মতো শুনে যেতে পারবে')}
      ${hfToggle('markDone', p.markDone, 'উত্তর শোনার পর "Done" করে দাও', 'প্রগ্রেস নিজে থেকে বাড়বে')}
      <p class="small hf-gap-title">প্রশ্ন আর উত্তরের মাঝে বিরতি</p>
      <div class="seg seg-4" role="group" aria-label="বিরতি">${gapSeg}</div>
      <button class="btn tap a11y-test" data-hf-test>${icon('play')}<span>ইয়ারবাডের বোতাম পরীক্ষা করো</span></button>
      <p class="muted small a11y-note">পরীক্ষা চালু করে ইয়ারবাডে এক/দুই/তিন ট্যাপ বা লম্বা চাপ দাও — কোন চাপে কী পৌঁছায় অ্যাপ বলে দেবে। কোন ট্যাপে কী হবে তা ইয়ারবাড ঠিক করে; দরকার হলে QCY অ্যাপে গিয়ে ট্যাপগুলো "Play/Pause", "Next", "Previous" এ সেট করো। ইয়ারবাডের লম্বা চাপে সাধারণত ফোনের Google Assistant খোলে, অ্যাপ নয়।</p>
      <p class="muted small a11y-note">${sup.media ? '' : '⚠️ এই ব্রাউজার ইয়ারবাডের বোতাম পাঠায় না; স্ক্রিনের নিচের বারের বোতাম ব্যবহার করো। '}অ্যাপটা খোলা রাখো — ফোন অ্যাপের বাইরে পড়ে শোনাতে দেয় না, তাই স্ক্রিন বন্ধ বা অন্য অ্যাপে গেলে পড়া থেমে যাবে। অ্যাপে ফিরলে যে প্রশ্নে ছিলে সেখান থেকে নিজে আবার চলবে। কিবোর্ড/রিমোট: Space = চালাও/উত্তর, → = পরের, ← = আগের, M = মুখে বলো, Esc = বন্ধ।</p>
    </section>`;
}

const toggle = (key, on, title, text) => `<label class="a11y-row">
    <span><b>${title}</b><small class="muted">${text}</small></span>
    <input type="checkbox" class="switch" data-a11y-toggle="${key}" ${on ? 'checked' : ''}>
  </label>`;

export function a11yView() {
  const p = a11y();
  const fontSeg = FONT_STEPS.map(([v, l]) => `<button class="seg-btn ${p.font === v ? 'on' : ''}" data-a11y-font="${v}" aria-pressed="${p.font === v}" style="font-size:${0.78 * v}rem">${l}</button>`).join('');
  const motionSeg = [['system', 'ফোন অনুযায়ী'], ['full', 'সব চালু'], ['reduce', 'কম'], ['off', 'বন্ধ']]
    .map(([v, l]) => `<button class="seg-btn ${p.motion === v ? 'on' : ''}" data-a11y-motion="${v}" aria-pressed="${p.motion === v}">${l}</button>`).join('');
  const rateSeg = [[0.8, 'ধীরে'], [1, 'সাধারণ'], [1.25, 'দ্রুত']]
    .map(([v, l]) => `<button class="seg-btn ${p.rate === v ? 'on' : ''}" data-a11y-rate="${v}" aria-pressed="${p.rate === v}">${l}</button>`).join('');

  return {
    nav: 'more',
    title: 'Accessibility',
    back: '#/more',
    html: `<header class="page-title rise"><p class="eyebrow">Accessibility</p><h1>সহজে ব্যবহার</h1>
        <p class="muted">সবার জন্য পড়া সহজ করার সেটিংস। শুধু এই ফোনে সেভ থাকে।</p></header>

      <section class="card rise" style="--i:1">
        <h2 class="card-title">${icon('notes')} লেখার আকার</h2>
        <div class="seg seg-5" role="group" aria-label="লেখার আকার">${fontSeg}</div>
        <p class="a11y-sample">নমুনা: আলোর প্রতিসরণ — Refraction of light</p>
      </section>

      <section class="card rise a11y-list" style="--i:2">
        <h2 class="card-title">${icon('a11y')} পড়া ও দেখা</h2>
        ${toggle('dyslexia', p.dyslexia, 'Dyslexia-বান্ধব লেখা', 'সহজে পড়া যায় এমন ফন্ট, অক্ষর ও লাইনের মাঝে বেশি ফাঁক')}
        ${toggle('contrast', p.contrast, 'High contrast', 'গাঢ় রং, স্পষ্ট বর্ডার আর আন্ডারলাইন করা লিংক')}
        ${toggle('captions', p.captions, 'ভিডিওতে ক্যাপশন', 'YouTube ভিডিও চালালে সাবটাইটেল চালু থাকবে (থাকলে বাংলা)')}
      </section>

      <section class="card rise" style="--i:3">
        <h2 class="card-title">${icon('spark')} অ্যানিমেশন</h2>
        <div class="seg seg-4" role="group" aria-label="অ্যানিমেশন">${motionSeg}</div>
        <p class="muted small a11y-note">মাথা ঘোরা বা মনোযোগে সমস্যা হলে "কম" বা "বন্ধ" করো।</p>
      </section>

      <section class="card rise" style="--i:4">
        <h2 class="card-title">${icon('speaker')} পড়ে শোনানো</h2>
        ${canSpeak() ? `<div class="seg" role="group" aria-label="কথার গতি">${rateSeg}</div>
          <button class="btn tap a11y-test" data-a11y-speak="Provacor-এ স্বাগতম। AI-এর উত্তরের পাশে স্পিকার চিহ্ন চাপলে উত্তর পড়ে শোনাবে।">${icon('speaker')}<span>শুনে দেখো</span></button>
          <p class="muted small a11y-note">AI-এর প্রতিটা উত্তরে ${icon('speaker')} চাপলে পড়ে শোনাবে। বাংলা না শোনালে ফোনের Settings → Text-to-speech-এ বাংলা ভয়েস নামাও।</p>`
          : '<p class="muted small">এই ব্রাউজারে পড়ে শোনানো সাপোর্ট করে না।</p>'}
      </section>

      ${handsfreeCard(5)}

      <section class="card rise" style="--i:5">
        <h2 class="card-title">${icon('mic')} ভয়েস দিয়ে চালানো</h2>
        ${canListen() ? `<p class="small">উপরের ${icon('mic')} চাপো, তারপর বলো:</p>
          <ul class="a11y-cmds">
            <li><b>"হোম"</b>, <b>"মিশন"</b>, <b>"প্রগ্রেস"</b>, <b>"স্টাডি"</b>, <b>"আরো"</b>, <b>"এআই"</b></li>
            <li><b>"পদার্থ"</b>, <b>"রসায়ন"</b>, <b>"জীববিজ্ঞান"</b>, <b>"গণিত"</b>, <b>"ইংরেজি"</b></li>
            <li><b>"লেন্স খোঁজো"</b> — খোঁজা</li>
            <li><b>"পিছনে"</b>, <b>"ডার্ক"</b>, <b>"লাইট"</b></li>
            <li><b>"শোনাও"</b> — খোলা সেকশনটা ইয়ারবাডে পড়ে শোনানো শুরু (হ্যান্ডস-ফ্রি)</li>
          </ul>
          <p class="muted small">AI পেজে ${icon('mic')} চেপে মুখে প্রশ্নও বলা যায়।</p>`
          : '<p class="muted small">এই ব্রাউজারে ভয়েস কমান্ড সাপোর্ট করে না। Android-এ Chrome ব্যবহার করো।</p>'}
      </section>

      <section class="card rise" style="--i:6">
        <h2 class="card-title">${icon('info')} Screen reader</h2>
        <p class="small">Android-এর <b>TalkBack</b> বা iPhone-এর <b>VoiceOver</b> চালু করলে অ্যাপের সব বোতাম, পেজের নাম আর অগ্রগতি পড়ে শোনাবে। পেজ বদলালে নতুন পেজের নাম জানিয়ে দেয়।</p>
      </section>`,
  };
}
