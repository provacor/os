// Backup & restore page.

import { icon } from '../icons.js?v=202610100204';
import { lastBackupAt, snapshot } from '../backup.js?v=202610100204';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);

export function backupView() {
  const last = lastBackupAt();
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  const size = Math.round(JSON.stringify(snapshot()).length / 1024);
  return {
    nav: 'more', title: 'Backup', back: '#/more',
    html: `<header class="page-title rise"><p class="eyebrow">Secure backup</p><h1>ব্যাকআপ ও রিস্টোর</h1>
        <p class="muted">তোমার সব তথ্য (প্রগ্রেস, মিশন, ভুলের খাতা, অ্যালার্ম, ভিডিও লিংক, প্রোফাইল, AI চ্যাট) একটা ফাইলে রাখো। ফাইলটা তোমার পাসওয়ার্ড দিয়ে ফোনেই এনক্রিপ্ট হয়, পাসওয়ার্ড ছাড়া কেউ খুলতে পারবে না।</p></header>

      <section class="card rise" style="--i:1">
        <h2 class="card-title">${icon('key')} ব্যাকআপ বানাও</h2>
        <p class="small ${days == null || days > 7 ? 'bk-warn' : 'muted'}">${days == null ? 'এখনো কোনো ব্যাকআপ নেই।' : days === 0 ? 'আজ ব্যাকআপ নেওয়া হয়েছে।' : `শেষ ব্যাকআপ ${bn(days)} দিন আগে।`} তথ্যের আকার প্রায় ${bn(size)} KB।</p>
        <form class="bk-form" data-bk-make>
          <input name="pw" type="password" minlength="6" required autocomplete="new-password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)">
          <input name="pw2" type="password" minlength="6" required autocomplete="new-password" placeholder="আবার পাসওয়ার্ড">
          <label class="bk-check"><input type="checkbox" name="ai"> AI key-ও ব্যাকআপে রাখো</label>
          <button class="btn btn-primary tap" type="submit">${icon('check')}<span>ব্যাকআপ ফাইল বানাও</span></button>
        </form>
        <p class="muted small">ফাইলটা Google Drive, Telegram বা ইমেইলে রেখে দাও। <b>পাসওয়ার্ড ভুলে গেলে ব্যাকআপ আর খোলা যাবে না</b>, তাই মনে রাখো।</p>
      </section>

      <section class="card rise" style="--i:2">
        <h2 class="card-title">${icon('revision')} রিস্টোর করো</h2>
        <form class="bk-form" data-bk-restore>
          <input name="file" type="file" accept=".provacor,application/octet-stream,application/json" required>
          <input name="pw" type="password" required autocomplete="current-password" placeholder="ব্যাকআপের পাসওয়ার্ড">
          <button class="btn tap" type="submit">${icon('revision')}<span>রিস্টোর করো</span></button>
        </form>
        <p class="muted small">রিস্টোর করলে এই ফোনের এখনকার তথ্যের জায়গায় ব্যাকআপের তথ্য বসবে।</p>
      </section>

      <section class="card rise" style="--i:3">
        <h2 class="card-title">${icon('info')} কীভাবে নিরাপদ</h2>
        <ul class="a11y-cmds">
          <li>এনক্রিপশন ফোনের ভেতরেই হয় (AES-256-GCM, PBKDF2 ৩,১০,০০০ বার)। পাসওয়ার্ড কোথাও পাঠানো হয় না।</li>
          <li>আমাদের কোনো সার্ভারে কিছু যায় না, ফাইলটা থাকে শুধু তুমি যেখানে রাখো সেখানে।</li>
          <li>AI key চাইলে বাদ রাখতে পারো।</li>
        </ul>
      </section>`,
  };
}
