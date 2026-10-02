// Accessibility settings page.

import { icon } from '../icons.js?v=202610021514';
import { a11y, FONT_STEPS, canSpeak, canListen } from '../a11y.js?v=202610021514';

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

      <section class="card rise" style="--i:5">
        <h2 class="card-title">${icon('mic')} ভয়েস দিয়ে চালানো</h2>
        ${canListen() ? `<p class="small">উপরের ${icon('mic')} চাপো, তারপর বলো:</p>
          <ul class="a11y-cmds">
            <li><b>"হোম"</b>, <b>"মিশন"</b>, <b>"প্রগ্রেস"</b>, <b>"স্টাডি"</b>, <b>"আরো"</b>, <b>"এআই"</b></li>
            <li><b>"পদার্থ"</b>, <b>"রসায়ন"</b>, <b>"জীববিজ্ঞান"</b>, <b>"গণিত"</b>, <b>"ইংরেজি"</b></li>
            <li><b>"লেন্স খোঁজো"</b> — খোঁজা</li>
            <li><b>"পিছনে"</b>, <b>"ডার্ক"</b>, <b>"লাইট"</b></li>
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
