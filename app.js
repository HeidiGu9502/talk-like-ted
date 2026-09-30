const STORAGE_KEY = 'qinian-mvp-v1';
const templates = {
  opinion: { name: '观点三问', parts: ['观点', '理由', '证据', '结论 / 期望'], questions: ['你为什么这么觉得？背后最主要的原因是什么？', '有没有具体的事实、例子或数据能支撑这个说法？', '如果对方认同你的想法，你希望接下来发生什么？'] },
  story: { name: '经历四步', parts: ['情境', '任务', '行动', '结果'], questions: ['当时具体是什么情况？背景是什么？', '你在其中要达成什么？你的角色是什么？', '你具体做了哪几件事？挑最关键的说。', '最后结果如何？有什么可以量化的结果？'] }
};
const badgeCatalog = [
  ['seed', '🌱', '第一个想法', '完成第 1 局'], ['light', '💡', '开窍', '完成第 10 局'], ['streak7', '🔥', '连续 7 天', '连续训练 7 天'],
  ['hundred', '📝', '百词选手', '单局成稿超过 100 字'], ['evidence', '🎯', '言之有物', '回答中包含具体例子或数据'], ['allTemplates', '🎨', '全能选手', '使用过全部 2 套模板']
];
const initialState = { xp: 0, sessions: [], streak: 0, lastActive: '', usedTemplates: [], badges: [] };
let state = loadState();
let view = 'home';
let session = null;
let toastTimer;

function loadState() { try { return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return { ...initialState }; } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function levelInfo() { const levels = [{ name: '表达学徒', min: 0, next: 50 }, { name: '能说会道', min: 50, next: 150 }, { name: '逻辑达人', min: 150, next: 350 }]; let i = 0; while (i < levels.length - 1 && state.xp >= levels[i + 1].min) i++; return { ...levels[i], level: i + 1, progress: Math.min(100, ((state.xp - levels[i].min) / (levels[i].next - levels[i].min)) * 100) }; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function formatDate(value) { return new Date(value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }); }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200); }
function render() {
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view || (view === 'card' && button.dataset.view === 'home')));
  const root = document.querySelector('#app');
  const renderers = { home: renderHome, input: renderInput, chat: renderChat, draft: renderDraft, card: renderCard, history: renderHistory, badges: renderBadges, settings: renderSettings, detail: renderDetail };
  root.innerHTML = (renderers[view] || renderHome)();
  root.focus({ preventScroll: true });
  bindViewEvents();
}
function renderHome() {
  const level = levelInfo(); const today = new Date().toDateString(); const todayCount = state.sessions.filter(item => new Date(item.createdAt).toDateString() === today).length;
  const recent = state.sessions.slice(0, 3);
  return `<div class="page"><section class="home-grid"><div class="hero-panel"><div class="eyebrow">THINK CLEARER, ONE IDEA AT A TIME</div><h1>把模糊的感觉，<br><em>说清楚。</em></h1><p class="hero-copy">给脑子里的那个想法三分钟。<br>不替你回答，只陪你把它想明白。</p><button class="primary-button" data-action="start">开始今日训练 <span aria-hidden="true">↗</span></button></div><div class="side-stack"><section class="stat-panel"><div class="stat-head"><span class="eyebrow">YOUR GROWTH</span><span class="level-count">LV.${level.level}</span></div><div class="level-name">${level.name}</div><div class="progress"><span style="width:${level.progress}%"></span></div><div class="level-count">${state.xp} XP · 距下一等级 ${Math.max(0, level.next - state.xp)} XP</div><div class="streak"><span class="flame">🔥</span>连续训练 ${state.streak} 天</div></section><section class="today-panel"><div><div class="eyebrow">TODAY'S PRACTICE</div><h2>今天的你，想清楚了吗？</h2><p>从一个真实的小想法开始，剩下的交给追问。</p></div><div class="today-row"><span>今日训练</span><span>${todayCount} 局完成</span></div></section></div></section><div class="section-heading"><h2>最近想清楚的事</h2><button class="text-button" data-view="history">查看全部 →</button></div><div class="recent-list">${recent.length ? recent.map(item => `<button class="recent-item" data-detail="${item.id}"><span class="eyebrow">${escapeHtml(item.templateName)} · ${formatDate(item.createdAt)}</span><p>${escapeHtml(item.thought)}</p><small>${item.finalText.length} 字 · +${item.xp} XP</small></button>`).join('') : '<div class="empty-state">你的第一条想法，正在等你开始。<br>完成训练后，会出现在这里。</div>'}</div></div>`;
}
function renderInput() {
  const current = session?.templateKey || 'opinion';
  return `<div class="page inner-page"><button class="back-link" data-view="home">← 回到首页</button><div class="eyebrow" style="margin-top:25px">01 / START WITH A THOUGHT</div><h1>此刻，你在想什么？</h1><p class="lead">不必完整，也不用正确。先把脑子里那个模糊的念头写下来。</p><div class="template-switch" role="group" aria-label="选择训练模板">${Object.entries(templates).map(([key, value]) => `<button class="template-option ${current === key ? 'selected' : ''}" data-template="${key}">${value.name}</button>`).join('')}</div><textarea id="thought" class="thought-input" maxlength="100" placeholder="${current === 'opinion' ? '比如：我觉得远程办公挺好的' : '比如：上个月我推动了一个重要项目'}">${escapeHtml(session?.thought || '')}</textarea><div class="field-meta"><span>写下 5 到 100 个字</span><span id="thought-count">${session?.thought?.length || 0} / 100</span></div><section class="inspiration"><div class="inspiration-title"><span>没灵感？从这里挑一个</span><span>✳</span></div><div class="prompt-chips"><button class="prompt-chip" data-prompt="最近让你不服的一件事">最近让你不服的一件事</button><button class="prompt-chip" data-prompt="你想说服别人的一个观点">你想说服别人的一个观点</button><button class="prompt-chip" data-prompt="你对某件事的真实看法">你对某件事的真实看法</button></div></section><button class="primary-button full-button" data-action="begin-chat">开始追问 <span>↗</span></button></div>`;
}
function renderChat() {
  const definition = templates[session.templateKey]; const total = definition.questions.length; const idx = session.index;
  const bubbles = session.answers.map((answer, i) => answer ? `<div class="bubble user">${escapeHtml(answer)}</div><div class="bubble coach"><span class="coach-tag">起念教练 · ${i + 2} / ${total}</span>${escapeHtml(definition.questions[Math.min(i + 1, total - 1)])}</div>` : '').join('');
  const skipped = session.skipped.includes(idx);
  return `<div class="page inner-page"><div class="chat-top"><button class="back-link" data-view="input">← 返回修改想法</button><span class="step-pill">${Math.min(idx + 1, total)} / ${total}</span></div><div class="eyebrow" style="margin-top:25px">${escapeHtml(definition.name)} · ${session.early ? '自由整理' : '逐层追问'}</div><div class="chat-thread"><div class="bubble user">${escapeHtml(session.thought)}</div><div class="bubble coach"><span class="coach-tag">起念教练 · 1 / ${total}</span>${escapeHtml(definition.questions[0])}</div>${bubbles}${skipped ? '<div class="bubble user">（跳过这一问）</div>' : ''}</div><label class="eyebrow" for="answer">你的回答</label><textarea id="answer" class="answer-input" maxlength="200" placeholder="用自己的话说就好，不用写得完美。">${escapeHtml(session.answers[idx] || '')}</textarea><div class="field-meta"><span id="answer-hint">${session.answers[idx] && session.answers[idx].length < 5 ? '多说一点点会更有说服力哦' : '不超过 200 字'}</span><span id="answer-count">${session.answers[idx]?.length || 0} / 200</span></div><div class="chat-actions"><button class="text-button" data-action="skip">跳过本问</button><div class="actions-right">${idx > 0 ? '<button class="text-button" data-action="revise">重答上一问</button>' : ''}<button class="primary-button" data-action="answer">${idx + 1 >= total ? '看看我的成稿' : '继续追问'} <span>→</span></button></div></div><button class="text-button" data-action="early-draft">看看现在的我</button></div>`;
}
function makeDraft() {
  const def = templates[session.templateKey];
  return def.parts.map((label, i) => ({ label, text: i === 0 ? session.thought : (session.answers[i - 1] || (session.skipped.includes(i - 1) ? '（未展开）' : '')) })).filter((block, i) => i === 0 || block.text || i <= session.index);
}
function renderDraft() {
  const blocks = session.draft || makeDraft();
  return `<div class="page inner-page"><button class="back-link" data-view="chat">← 返回追问</button><div class="eyebrow" style="margin-top:25px">03 / YOUR WORDS, YOUR STRUCTURE</div><h1>看看现在的你。</h1><p class="lead">这是你刚才说的话，整理成了更清楚的顺序。点击文字可以继续修改。</p><div id="draft-blocks">${blocks.map((block, i) => `<div class="draft-block"><label for="draft-${i}">【${escapeHtml(block.label)}】</label><textarea id="draft-${i}" data-draft-index="${i}">${escapeHtml(block.text)}</textarea></div>`).join('')}</div><div class="draft-actions"><button class="secondary-button" data-action="copy-draft">▢ 复制成稿</button><button class="primary-button" data-action="finish">完成，看进化卡 <span>↗</span></button></div></div>`;
}
function composeDraft() { return (session.draft || makeDraft()).map(block => `【${block.label}】${block.text}`).join('\n'); }
function renderCard() {
  const item = session.completed;
  return `<div class="page inner-page" style="max-width:680px"><div class="eyebrow">04 / LOOK HOW FAR YOU'VE COME</div><h1 style="text-align:center">这就是你的进化。</h1><p class="lead" style="text-align:center">每个字，都来自你自己。</p><article class="evolution-card" id="evolution-card"><h2>我最初的想法</h2><div class="card-before">“${escapeHtml(item.thought)}”</div><div class="card-arrow">↓ <span style="font:10px var(--mono);color:#cbd5c3">A CLEARER THOUGHT</span></div><div class="card-after">${escapeHtml(item.finalText)}</div><div class="card-metrics"><span>用时 ${item.duration}</span><span>${item.thought.length} 字 → ${item.finalText.replace(/\s/g, '').length} 字</span><span>+${item.xp} XP</span></div></article><div class="card-actions"><button class="secondary-button" data-action="save-image">↓ 保存图片</button><button class="secondary-button" data-action="copy-final">▢ 复制成稿</button><button class="primary-button" data-action="again">再来一局 ↗</button></div></div>`;
}
function renderHistory() {
  return `<div class="page inner-page"><div class="eyebrow">YOUR THOUGHT ARCHIVE</div><h1>想法库</h1><p class="lead">${state.sessions.length} 条想法，都是你认真想过的痕迹。</p><div class="list-toolbar"><span class="eyebrow">最近训练</span><span class="level-count">最多保存 20 局</span></div>${state.sessions.length ? state.sessions.map(item => `<div class="history-row"><div><h3>${escapeHtml(item.thought)}</h3><p>${formatDate(item.createdAt)} · ${escapeHtml(item.templateName)} · ${item.finalText.length} 字</p></div><button data-detail="${item.id}">查看</button></div>`).join('') : '<div class="empty-state">还没有训练记录。<br>从一个小想法开始吧。</div>'}</div>`;
}
function renderBadges() {
  const unlocked = state.badges;
  return `<div class="page inner-page"><div class="eyebrow">SMALL WINS, REAL GROWTH</div><h1>成就墙</h1><p class="lead">已收集 ${unlocked.length} / ${badgeCatalog.length} 枚徽章</p><div class="badge-grid">${badgeCatalog.map(([id, icon, name, condition]) => `<article class="badge-item ${unlocked.includes(id) ? '' : 'locked'}"><div class="badge-icon">${icon}</div><h3>${name}</h3><p>${unlocked.includes(id) ? '已解锁' : condition}</p></article>`).join('')}</div></div>`;
}
function renderSettings() {
  return `<div class="page inner-page"><div class="eyebrow">A LITTLE ABOUT QINIAN</div><h1>设置</h1><p class="lead">轻一点，才能练得久一点。</p><div class="settings-row"><span>产品版本<small>起念 · Web H5 MVP</small></span><span>v1.0</span></div><div class="settings-row"><span>数据存储<small>仅保存在此浏览器，不会上传</small></span><span>本地</span></div><div class="settings-row"><span>AI 教练<small>未接入服务时使用内置追问</small></span><span>离线可用</span></div><button class="text-button" style="margin-top:24px" data-action="clear-data">清除本地训练数据</button><p class="lead" style="margin-top:28px">起念不是替你说，而是陪你把自己的话想清楚。</p></div>`;
}
function renderDetail() {
  const item = state.sessions.find(entry => entry.id === session?.detailId); if (!item) { view = 'history'; return renderHistory(); }
  return `<div class="page inner-page"><button class="back-link" data-view="history">← 返回想法库</button><div class="eyebrow" style="margin-top:25px">${formatDate(item.createdAt)} · ${escapeHtml(item.templateName)}</div><h1>${escapeHtml(item.thought)}</h1><p class="lead">完整表达</p><div class="plain-panel" style="white-space:pre-wrap;line-height:1.9;font-size:14px">${escapeHtml(item.finalText)}</div><button class="secondary-button" style="margin-top:18px" data-action="copy-history" data-id="${item.id}">▢ 复制成稿</button></div>`;
}

function beginSession() { session = { id: crypto.randomUUID?.() || String(Date.now()), templateKey: 'opinion', thought: '', answers: [], index: 0, skipped: [], startedAt: Date.now(), early: false }; view = 'input'; render(); }
function startChat() {
  const thought = document.querySelector('#thought').value.trim();
  if (thought.length < 5) { toast('再多说一点，至少写 5 个字哦'); return; }
  session.thought = thought; session.answers = []; session.index = 0; session.skipped = []; session.startedAt = Date.now(); view = 'chat'; render();
}
function updateDraftFromInputs() { session.draft = [...document.querySelectorAll('[data-draft-index]')].map((element, i) => ({ label: templates[session.templateKey].parts[i], text: element.value.trim() })); }
async function copyText(text) { try { await navigator.clipboard.writeText(text); toast('已复制到剪贴板'); } catch { const field = document.createElement('textarea'); field.value = text; document.body.append(field); field.select(); document.execCommand('copy'); field.remove(); toast('已复制到剪贴板'); } }
function checkBadges(item) {
  const unlocked = new Set(state.badges); const award = id => { if (!unlocked.has(id)) { unlocked.add(id); toast(`解锁徽章：${badgeCatalog.find(b => b[0] === id)?.[2]}`); } };
  if (state.sessions.length >= 1) award('seed'); if (state.sessions.length >= 10) award('light'); if (state.streak >= 7) award('streak7'); if (item.finalText.length > 100) award('hundred'); if (item.answers.some(answer => /\d|例如|比如|上周|上个月|去年/.test(answer))) award('evidence'); if (new Set(state.usedTemplates).size >= 2) award('allTemplates'); state.badges = [...unlocked];
}
function finishSession(early = false) {
  const draft = session.draft || makeDraft(); const finalText = draft.map(block => `【${block.label}】${block.text || '（未展开）'}`).join('\n'); const now = new Date(); const day = now.toDateString(); const yesterday = new Date(Date.now() - 86400000).toDateString();
  const skipped = session.skipped.length; const completion = early ? 0.5 : (skipped ? 0.8 : 1); const xp = Math.round(10 * completion); const durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000)); const duration = `${Math.floor(durationSeconds / 60)}分 ${durationSeconds % 60}秒`;
  if (state.lastActive !== day) state.streak = state.lastActive === yesterday ? state.streak + 1 : 1;
  state.lastActive = day; state.xp += xp; state.usedTemplates = [...new Set([...state.usedTemplates, session.templateKey])];
  const item = { id: session.id, thought: session.thought, templateKey: session.templateKey, templateName: templates[session.templateKey].name, answers: session.answers, finalText, createdAt: now.toISOString(), duration, xp };
  state.sessions.unshift(item); state.sessions = state.sessions.slice(0, 20); session.completed = item; checkBadges(item); saveState(); view = 'card'; render();
}
function saveAsImage() {
  const item = session.completed; const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1120; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2d594b'; ctx.fillRect(0, 0, 900, 1120); ctx.fillStyle = '#d9e967'; ctx.font = '24px sans-serif'; ctx.fillText('QǐNiàn / EXPRESSION STUDY', 66, 74); ctx.fillStyle = '#f7f4e8'; ctx.font = 'bold 46px sans-serif'; ctx.fillText('我最初的想法', 66, 160); ctx.font = '30px sans-serif'; wrapCanvasText(ctx, `“${item.thought}”`, 66, 216, 760, 48, '#c5d0c4'); ctx.fillStyle = '#d9e967'; ctx.font = '40px sans-serif'; ctx.fillText('↓', 66, 390); ctx.fillStyle = '#f7f4e8'; wrapCanvasText(ctx, item.finalText, 66, 465, 760, 38, '#f7f4e8'); ctx.fillStyle = '#c5d0c4'; ctx.font = '20px sans-serif'; ctx.fillText(`${item.duration}   ${item.thought.length}字 → ${item.finalText.replace(/\s/g, '').length}字   +${item.xp} XP`, 66, 1055);
  canvas.toBlob(blob => { if (!blob) { toast('图片生成失败，请重试'); return; } const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = '起念-表达进化卡.png'; link.click(); URL.revokeObjectURL(url); toast('进化卡已保存'); });
}
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, color) { ctx.fillStyle = color; const chars = [...text]; let line = ''; let currentY = y; for (const char of chars) { if (ctx.measureText(line + char).width > maxWidth && line) { ctx.fillText(line, x, currentY); line = char; currentY += lineHeight; } else line += char; } if (line) ctx.fillText(line, x, currentY); }
function bindViewEvents() {
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; render(); }));
  document.querySelectorAll('[data-template]').forEach(button => button.addEventListener('click', () => { session.templateKey = button.dataset.template; render(); }));
  document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { const field = document.querySelector('#thought'); field.value = button.dataset.prompt; document.querySelector('#thought-count').textContent = `${field.value.length} / 100`; field.focus(); }));
  document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => { session = { detailId: button.dataset.detail }; view = 'detail'; render(); }));
  const thought = document.querySelector('#thought'); if (thought) thought.addEventListener('input', () => { document.querySelector('#thought-count').textContent = `${thought.value.length} / 100`; });
  const answer = document.querySelector('#answer'); if (answer) answer.addEventListener('input', () => { document.querySelector('#answer-count').textContent = `${answer.value.length} / 200`; document.querySelector('#answer-hint').textContent = answer.value.length > 0 && answer.value.trim().length < 5 ? '多说一点点会更有说服力哦' : '不超过 200 字'; });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.action;
    if (action === 'start') { beginSession(); return; }
    if (action === 'begin-chat') { startChat(); return; }
    if (action === 'answer') { const value = document.querySelector('#answer').value.trim(); session.answers[session.index] = value; if (session.index + 1 >= templates[session.templateKey].questions.length) { session.index++; session.draft = makeDraft(); view = 'draft'; } else session.index++; render(); return; }
    if (action === 'skip') { session.answers[session.index] = ''; session.skipped.push(session.index); if (session.index + 1 >= templates[session.templateKey].questions.length) { session.index++; session.draft = makeDraft(); view = 'draft'; } else session.index++; render(); return; }
    if (action === 'revise') { session.index = Math.max(0, session.index - 1); render(); return; }
    if (action === 'early-draft') { session.early = true; session.draft = makeDraft(); view = 'draft'; render(); return; }
    if (action === 'copy-draft') { updateDraftFromInputs(); await copyText(composeDraft()); return; }
    if (action === 'finish') { updateDraftFromInputs(); finishSession(session.early); return; }
    if (action === 'copy-final') { await copyText(session.completed.finalText); return; }
    if (action === 'save-image') { saveAsImage(); return; }
    if (action === 'again') { beginSession(); return; }
    if (action === 'copy-history') { const item = state.sessions.find(entry => entry.id === button.dataset.id); if (item) await copyText(item.finalText); return; }
    if (action === 'clear-data') { if (confirm('确定清除本浏览器中的所有训练记录和成长数据吗？此操作无法撤销。')) { localStorage.removeItem(STORAGE_KEY); state = { ...initialState }; view = 'home'; render(); toast('本地数据已清除'); } }
  }));
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; render(); }));
document.querySelector('.icon-button').addEventListener('click', () => { view = 'settings'; render(); });
render();