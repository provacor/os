// Video links block for a chapter: add YouTube (or any) links per topic, watch them inline.

import { icon } from '../icons.js?v=202610100204';
import { esc } from '../components.js?v=202610100204';
import { videosOf, startTime } from '../videos.js?v=202610100204';

const bn = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const NO_TOPIC = 'সাধারণ (পুরো অধ্যায়)';

function card(ch, v) {
  const label = v.title || (v.vid ? 'YouTube ভিডিও' : new URL(v.url).hostname.replace(/^www\./, ''));
  const media = v.vid
    ? `<button class="vd-thumb" data-video-play="${esc(v.vid)}" data-start="${startTime(v.url)}" aria-label="ভিডিও চালাও: ${esc(label)}">
        <img src="https://i.ytimg.com/vi/${esc(v.vid)}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180" onerror="this.remove()">
        <span class="vd-play">${icon('play')}</span>
      </button>`
    : `<a class="vd-thumb vd-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${icon('link')}</a>`;
  return `<li class="vd">
      ${media}
      <div class="vd-info">
        <span class="vd-title">${esc(label)}</span>
        <span class="vd-actions">
          <a class="link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${v.vid ? 'YouTube-এ খুলো' : 'লিংক খুলো'}</a>
          <button class="task-del" data-video-del="${esc(v.id)}" data-chapter="${esc(ch.id)}" aria-label="লিংক মুছো">${icon('trash')}</button>
        </span>
      </div>
    </li>`;
}

export function videosBlock(ch) {
  const list = videosOf(ch.id);
  const topics = (ch.topics ?? []).map((t) => (typeof t === 'string' ? t : t.name));
  const used = [...new Set(list.map((v) => v.topic).filter(Boolean))];
  const suggest = [...new Set([...topics, ...used])];

  // group by topic, chapter topics first in syllabus order, then the user's own, then "general"
  const order = [...suggest, ''];
  const groups = order
    .map((t) => [t, list.filter((v) => (v.topic || '') === t)])
    // the chapter's own syllabus topics always show, so each one has its own add button
    .filter(([t, vs]) => vs.length || (t && topics.includes(t)))
    .map(([t, vs]) => `<div class="vd-group">
        <h3 class="vd-topic"><span>${esc(t || NO_TOPIC)} <span class="muted small">${bn(vs.length)}টি</span></span>
          <button type="button" class="chip vd-add" data-video-topic="${esc(t)}">+ লিংক</button></h3>
        ${vs.length ? `<ul class="vd-list">${vs.map((v) => card(ch, v)).join('')}</ul>` : ''}
      </div>`)
    .join('');

  return `<section class="block" id="videos">
      <div class="block-head"><h2>${icon('video')} ভিডিও লিংক</h2>${list.length ? `<span class="muted small">${bn(list.length)}টি</span>` : ''}</div>
      <div class="card vd-card">
        ${groups || '<p class="muted small">এই অধ্যায়ের কোনো টপিকের YouTube ভিডিওর লিংক এখানে সেভ করে রাখো। যতগুলো খুশি যোগ করা যাবে, পরে এখান থেকেই দেখতে পারবে।</p>'}
        <form class="vd-form" data-video-form data-chapter="${esc(ch.id)}">
          <input name="url" type="text" inputmode="url" required autocomplete="off" placeholder="YouTube লিংক পেস্ট করো" aria-label="ভিডিও লিংক">
          <input name="topic" type="text" list="vdTopics" maxlength="120" autocomplete="off" placeholder="টপিক (না দিলে সাধারণ)" aria-label="টপিক">
          <datalist id="vdTopics">${suggest.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          <input name="title" type="text" maxlength="120" autocomplete="off" placeholder="শিরোনাম (ঐচ্ছিক) যেমন: লেন্সের সূত্র — ক্লাস ১" aria-label="শিরোনাম">
          <button class="btn btn-primary tap" type="submit">${icon('check')}<span>লিংক যোগ করো</span></button>
        </form>
        <p class="muted small vd-note">${icon('info')} লিংকগুলো শুধু তোমার ফোনেই সেভ থাকে।</p>
      </div>
    </section>`;
}
