// AI tutor page: ask in text or with photos (camera / gallery), answers stream in.

import { icon } from '../icons.js?v=202610101347';
import { esc } from '../components.js?v=202610101347';
import { aiSettings, hasKey, chatHistory, CLAUDE_MODELS } from '../ai.js?v=202610101347';
import { renderMarkdown, typesetMath } from '../markdown.js?v=202610101347';
import { canSpeak, canListen } from '../a11y.js?v=202610101347';

export const speakBtn = () => (canSpeak() ? `<button class="ai-speak" data-ai-speak aria-label="উত্তর পড়ে শোনাও">${icon('speaker')}</button>` : '');

export const aiState = { images: [], busy: false, context: '' };

export function messageHtml(m) {
  const thumbs = m.thumbs?.length ? `<div class="ai-thumbs">${m.thumbs.filter(Boolean).map((t) => `<img src="${esc(t)}" alt="">`).join('')}</div>` : '';
  return m.role === 'ai'
    ? `<div class="ai-msg ai-bot"><span class="ai-av">${icon('sparkle')}</span><div class="ai-bubble md">${renderMarkdown(m.text)}</div>${speakBtn()}</div>`
    : `<div class="ai-msg ai-me"><div class="ai-bubble">${thumbs}${m.text ? `<p>${esc(m.text)}</p>` : ''}</div></div>`;
}

export function pendingHtml() {
  return aiState.images.map((d, i) => `<span class="ai-pend"><img src="${esc(d)}" alt=""><button type="button" data-ai-unpick="${i}" aria-label="ছবি সরাও">${icon('x')}</button></span>`).join('');
}

export function aiView(model, chapterId) {
  const ch = chapterId ? model.byId.get(chapterId) : null;
  aiState.context = ch?.level === 'chapter' ? `${ch.subject.name} · ${ch.paper.name} · ${ch.name}` : '';
  const s = aiSettings();
  const list = chatHistory();
  const setup = !hasKey();

  const claudeForm = `${setup ? `<ol class="ai-steps">
          <li><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> খুলে অ্যাকাউন্ট বানাও।</li>
          <li><b>Billing</b>-এ গিয়ে কিছু credit কেনো (Claude ফ্রি না, প্রতি প্রশ্নে অল্প খরচ হয়)।</li>
          <li><b>API keys → Create key</b> চাপো, key কপি করে নিচে বসাও।</li>
        </ol>` : ''}
      <form class="ai-key-form" data-ai-settings>
        <label class="pf-label" for="aiClaudeKey">Claude API key</label>
        <input id="aiClaudeKey" name="claudeKey" type="password" autocomplete="new-password" spellcheck="false" value="${esc(s.claudeKey)}" placeholder="sk-ant-…">
        <label class="pf-label" for="aiClaudeModel">মডেল</label>
        <select id="aiClaudeModel" name="claudeModel">${CLAUDE_MODELS.map(([id, label]) => `<option value="${id}" ${id === s.claudeModel ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>
        <button class="btn btn-primary tap" type="submit">${icon('check')}<span>সেভ</span></button>
      </form>
      <p class="muted small">key শুধু এই ফোনেই থাকে, সরাসরি Anthropic-এর কাছে যায়। কাউকে key দেখাবে না।</p>`;

  const settingsCard = `<details class="card ai-settings" ${setup ? 'open' : ''}>
      <summary>${icon('key')} <span>AI সেটিংস · Claude</span>${setup ? '<span class="flag">দরকার</span>' : '<span class="ok-tag">চালু</span>'}</summary>
      ${claudeForm}
    </details>`;

  const empty = `<div class="ai-empty">
      <span class="ai-logo">${icon('sparkle')}</span>
      <h2>কী জানতে চাও?</h2>
      <p class="muted small">প্রশ্ন লেখো, অথবা বই/খাতার প্রশ্নের ছবি তুলে পাঠাও। অঙ্ক ধাপে ধাপে বুঝিয়ে দেবে।</p>
      <div class="chip-row ai-sugg">
        ${['লেন্সের ক্ষমতা কী? একক কী?', 'জারণ-বিজারণ সহজ করে বোঝাও', 'Article a/an এর ব্যবহার উদাহরণসহ'].map((q) => `<button class="chip" type="button" data-ai-suggest="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
    </div>`;

  return {
    nav: 'home',
    title: 'Provacor AI',
    back: ch ? `#/c/${ch.id}` : '#/',
    html: `<header class="page-title rise ai-head"><p class="eyebrow">AI শিক্ষক</p><h1>Provacor AI</h1>
        ${aiState.context ? `<p class="muted small">${icon('notes')} ${esc(aiState.context)}</p>` : ''}
        ${list.length ? '<button class="link ai-clear" data-ai-clear>নতুন চ্যাট</button>' : ''}</header>
      ${settingsCard}
      <div class="ai-chat" id="aiChat" aria-live="polite">${list.length ? list.map(messageHtml).join('') : empty}</div>
      <form class="ai-compose" data-ai-form>
        <div class="ai-pends" id="aiPends">${pendingHtml()}</div>
        <div class="ai-row">
          <label class="icon-btn" aria-label="ছবি তোলো">${icon('camera')}<input type="file" accept="image/*" capture="environment" data-ai-pick hidden></label>
          <label class="icon-btn" aria-label="গ্যালারি থেকে ছবি">${icon('image')}<input type="file" accept="image/*" multiple data-ai-pick hidden></label>
          ${canListen() ? `<button type="button" class="icon-btn" data-ai-mic aria-label="মুখে প্রশ্ন বলো">${icon('mic')}</button>` : ''}
          <textarea id="aiInput" rows="1" maxlength="4000" placeholder="প্রশ্ন লেখো…" aria-label="প্রশ্ন"></textarea>
          <button class="icon-btn ai-send" type="submit" aria-label="পাঠাও" ${aiState.busy ? 'disabled' : ''}>${icon('send')}</button>
        </div>
        <p class="ai-foot muted">AI ভুল করতে পারে, গুরুত্বপূর্ণ উত্তর বই দিয়ে মিলিয়ে নিও।</p>
      </form>`,
    after: () => {
      const pre = sessionStorage.getItem('hscos:ai-prefill');
      if (pre) {
        sessionStorage.removeItem('hscos:ai-prefill');
        const input = document.getElementById('aiInput');
        input.value = pre;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.querySelectorAll('#aiChat .md').forEach(typesetMath);
      if (list.length) document.getElementById('aiChat')?.lastElementChild?.scrollIntoView({ block: 'end' });
    },
  };
}
