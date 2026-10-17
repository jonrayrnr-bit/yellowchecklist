import * as db from './data.js';

const main = document.getElementById('main');
const accountEl = document.getElementById('account');
const banner = document.getElementById('banner');

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};
const mark = (m, label) =>
  m === 'x'
    ? `<svg class="mark mark-x" viewBox="0 0 24 24" role="img" aria-label="${esc(label || 'Not on the list')}"><rect x="2.5" y="2.5" width="19" height="19" rx="2.5"/><path d="M7 7l10 10M17 7L7 17"/></svg>`
    : `<svg class="mark mark-check" viewBox="0 0 24 24" role="img" aria-label="${esc(label || 'On the list')}"><rect x="2.5" y="2.5" width="19" height="19" rx="2.5"/><path d="M6.5 12.5l4 4 7.5-9"/></svg>`;
const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
const go = (hash) => { location.hash = hash; };
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function errorBox(e) { return `<p class="error" role="alert">${esc(e.message || e)}</p>`; }
async function needProfile() {
  const p = await db.myProfile();
  if (!p) { go((await db.currentUser()) ? '#/welcome' : '#/signin'); return null; }
  return p;
}

// ---------- shared pieces ----------
function itemsHtml(l, max) {
  const items = max ? l.items.slice(0, max) : l.items;
  const tag = l.ranked ? 'ol' : 'ul';
  const rows = items.map((it) => `
    <li class="item ${it.mark === 'x' ? 'is-x' : ''}">
      ${mark(it.mark)}
      ${l.ranked ? `<span class="rank">${it.position}.</span>` : ''}
      <span class="item-text">${esc(it.text)}${it.note && !max ? `<span class="item-note">${esc(it.note)}</span>` : ''}</span>
    </li>`).join('');
  const more = max && l.items.length > max ? `<li class="more">+ ${l.items.length - max} more</li>` : '';
  return `<${tag} class="items">${rows}${more}</${tag}>`;
}
function upvoteBtn(l, on) {
  return `<button class="upvote ${on ? 'on' : ''}" data-upvote="${esc(l.id)}" aria-pressed="${on}" aria-label="Upvote ${esc(l.title)}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 9h-4.5v7h-5v-7H5z"/></svg><span>${l.upvote_count}</span></button>`;
}
function card(l, upvoted) {
  return `<article class="card paper">
    <header>
      <h3><a href="#/list/${esc(l.id)}">${esc(l.title)}</a></h3>
      <p class="meta">by <a href="#/u/${esc(l.author?.username)}">@${esc(l.author?.username)}</a>
        ${l.category ? ` · <a href="#/c/${esc(l.category.slug)}">${esc(l.category.name)}</a>` : ''} · ${ago(l.created_at)}</p>
    </header>
    ${itemsHtml(l, 5)}
    <footer>${upvoteBtn(l, upvoted.has(l.id))}<a class="link" href="#/list/${esc(l.id)}">Open</a>
      <a class="link" href="#/create?remix=${esc(l.id)}">Mine would be…</a></footer>
  </article>`;
}
async function cards(lists, empty = 'No lists here yet. Be the first.') {
  if (!lists.length) return `<p class="empty">${esc(empty)}</p>`;
  const up = await db.myUpvotes(lists.map((l) => l.id));
  return `<div class="grid">${lists.map((l) => card(l, up)).join('')}</div>`;
}

// ---------- views ----------
async function viewHome() {
  const [prompt, cats, hot, fresh] = await Promise.all([db.promptOfDay(), db.categories(), db.feed({ sort: 'hot', limit: 12 }), db.feed({ sort: 'new', limit: 6 })]);
  const listOfDay = hot[0];
  main.innerHTML = `
    <section class="hero">
      <h1>Make a list.<br><span class="hl">Trade a list.</span></h1>
      <p class="lede">Lists that say who you are. See someone's top five, then post yours.</p>
      ${prompt ? `<div class="prompt paper">
        <p class="eyebrow">Prompt of the Day</p>
        <p class="prompt-text">${esc(prompt.text)}</p>
        <a class="btn" href="#/create?prompt=${prompt.id}">Make this list</a>
      </div>` : ''}
    </section>
    ${listOfDay ? `<section><h2 class="section-title">List of the Day</h2>${await cards([listOfDay])}</section>` : ''}
    <section><h2 class="section-title">Trending</h2>${await cards(hot.slice(1))}</section>
    <section><h2 class="section-title">Just posted</h2>${await cards(fresh)}</section>
    <section><h2 class="section-title">Categories</h2>
      <ul class="cats">${cats.map((c) => `<li><a class="paper cat" href="#/c/${esc(c.slug)}"><b>${esc(c.name)}</b><span>${esc(c.description)}</span></a></li>`).join('')}</ul>
    </section>`;
}

async function viewList(id) {
  const l = await db.getList(id);
  if (!l) { main.innerHTML = `<p class="empty">That list isn't here. It may be private or deleted.</p>`; return; }
  const [up, user, comments] = await Promise.all([db.myUpvotes([l.id]), db.currentUser(), db.comments(l.id)]);
  const mine = user && user.id === l.author_id;
  document.title = `${l.title} · YellowChecklist`;
  main.innerHTML = `
    <article class="sheet paper">
      ${l.status === 'draft' ? `<p class="pill">Draft · only you can see this</p>` : ''}
      ${l.visibility !== 'public' && l.status !== 'draft' ? `<p class="pill">${esc(l.visibility)}</p>` : ''}
      <h1 class="sheet-title">${esc(l.title)}</h1>
      <p class="meta">by <a href="#/u/${esc(l.author?.username)}">@${esc(l.author?.username)}</a>
        ${l.category ? ` · <a href="#/c/${esc(l.category.slug)}">${esc(l.category.name)}</a>` : ''} · ${ago(l.created_at)}
        ${l.kind === 'udefine' ? ' · <span class="tag">U Define</span>' : ''}</p>
      ${l.prompt ? `<p class="from-prompt">From the prompt: <i>${esc(l.prompt.text)}</i></p>` : ''}
      ${l.remixed_from ? `<p class="from-prompt"><a href="#/list/${esc(l.remixed_from)}">See the list this answers</a></p>` : ''}
      ${l.intro ? `<p class="intro">${esc(l.intro)}</p>` : ''}
      ${itemsHtml(l)}
      <div class="actions">
        ${upvoteBtn(l, up.has(l.id))}
        <a class="btn" href="#/create?remix=${esc(l.id)}">Mine would be…</a>
        <button class="btn-ghost" data-share>Share</button>
        ${mine && l.status === 'draft' ? `<button class="btn-ghost" data-publish>Publish</button>` : ''}
        ${mine ? `<button class="btn-ghost danger" data-delete>Delete</button>` : `<button class="btn-ghost" data-report>Report</button>`}
      </div>
    </article>
    <section class="comments">
      <h2 class="section-title">Comments</h2>
      ${comments.length ? `<ul class="comment-list">${comments.map((c) => `
        <li><p class="meta"><a href="#/u/${esc(c.author?.username)}">@${esc(c.author?.username)}</a> · ${ago(c.created_at)}
          ${user && user.id === c.author_id ? `<button class="link danger" data-del-comment="${c.id}">delete</button>` : ''}</p>
          <p>${esc(c.body)}</p></li>`).join('')}</ul>` : `<p class="empty">No comments yet.</p>`}
      ${user ? `<form id="comment-form" class="stack">
          <label for="comment-body">Add a comment</label>
          <textarea id="comment-body" required maxlength="2000" rows="3" placeholder="Me too! My family always…"></textarea>
          <button class="btn" type="submit">Post comment</button></form>`
        : `<p><a href="#/signin">Sign in</a> to comment.</p>`}
    </section>`;

  main.querySelector('[data-share]').onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: l.title, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch {}
  };
  const pub = main.querySelector('[data-publish]');
  if (pub) pub.onclick = async () => { await db.publishDraft(l.id); toast('Published'); route(); };
  const del = main.querySelector('[data-delete]');
  if (del) del.onclick = async () => {
    if (del.dataset.armed) { await db.deleteList(l.id); toast('List deleted'); go('#/'); }
    else { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; }
  };
  const rep = main.querySelector('[data-report]');
  if (rep) rep.onclick = async () => {
    if (!(await needProfile())) return;
    await db.report({ listId: l.id, reason: 'Reported from list page' }); toast('Thanks. We will take a look.'); rep.disabled = true;
  };
  main.querySelectorAll('[data-del-comment]').forEach((b) => (b.onclick = async () => { await db.deleteComment(Number(b.dataset.delComment)); route(); }));
  const form = document.getElementById('comment-form');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    if (!(await needProfile())) return;
    const body = form.querySelector('textarea').value.trim();
    if (!body) return;
    await db.addComment(l.id, body); route();
  };
}

// --- create ---
let draft = null;
async function viewCreate() {
  const profile = await needProfile();
  if (!profile) return;
  const p = params();
  const [cats, pod] = await Promise.all([db.categories(), db.promptOfDay()]);
  if (!draft || p.get('fresh') === null) {
    draft = { title: '', intro: '', category_id: '', ranked: false, kind: 'checklist', visibility: 'public', prompt_id: null, remixed_from: null,
      items: [{ text: '', note: '', mark: 'check' }, { text: '', note: '', mark: 'check' }, { text: '', note: '', mark: 'check' }] };
    if (p.get('remix')) {
      const src = await db.getList(p.get('remix'));
      if (src) Object.assign(draft, { title: src.title, category_id: src.category_id || '', ranked: src.ranked, kind: src.kind, remixed_from: src.id,
        items: src.items.map(() => ({ text: '', note: '', mark: 'check' })), remixOf: src });
    }
    if (p.get('prompt')) {
      const all = await db.prompts();
      const pr = all.find((x) => String(x.id) === p.get('prompt'));
      if (pr) Object.assign(draft, { title: pr.text.replace(/…$/, ''), prompt_id: pr.id, promptText: pr.text });
    }
    history.replaceState(null, '', location.pathname + location.search + '#/create?fresh=1');
  }
  renderCreate(cats, pod);
}
function renderCreate(cats, pod) {
  const d = draft;
  const isU = d.kind === 'udefine';
  main.innerHTML = `
    <form id="create" class="sheet paper stack" novalidate>
      <h1 class="sheet-title">${d.remixOf ? 'Mine would be…' : 'New list'}</h1>
      ${d.remixOf ? `<p class="from-prompt">Answering <a href="#/list/${esc(d.remixOf.id)}">${esc(d.remixOf.title)}</a> by @${esc(d.remixOf.author?.username)}</p>` : ''}
      ${!d.remixOf ? `<div class="prompt-row">
        <p class="from-prompt">${d.promptText ? `Prompt: <i>${esc(d.promptText)}</i>` : pod ? `Prompt of the Day: <i>${esc(pod.text)}</i> <button type="button" class="link" data-use-prompt="${pod.id}">use it</button>` : ''}</p>
        <button type="button" class="btn-ghost" data-give-prompt>Give me a prompt</button></div>` : ''}
      <label for="f-title">Title</label>
      <input id="f-title" name="title" required maxlength="120" value="${esc(d.title)}" placeholder="Top 5 places I want to go">
      <div class="row">
        <div class="stack"><label for="f-cat">Category</label>
          <select id="f-cat" name="category_id"><option value="">Choose one</option>
            ${cats.map((c) => `<option value="${c.id}" ${String(d.category_id) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="stack"><label for="f-vis">Who can see it</label>
          <select id="f-vis" name="visibility">
            ${['public', 'unlisted', 'private'].map((v) => `<option value="${v}" ${d.visibility === v ? 'selected' : ''}>${v === 'public' ? 'Everyone' : v === 'unlisted' ? 'Anyone with the link' : 'Only me'}</option>`).join('')}</select></div>
      </div>
      <fieldset class="toggles"><legend class="sr-only">List style</legend>
        <label><input type="checkbox" name="ranked" ${d.ranked ? 'checked' : ''}> Numbered (ranked)</label>
        <label><input type="checkbox" name="udefine" ${isU ? 'checked' : ''}> U Define: mark what's in ✓ and what's out ✗</label>
      </fieldset>
      <label for="f-intro">A line about it <span class="opt">(optional)</span></label>
      <textarea id="f-intro" name="intro" rows="2" maxlength="1000">${esc(d.intro)}</textarea>
      <p class="label">Items</p>
      <ol class="editor">
        ${d.items.map((it, i) => `<li class="edit-item">
          ${isU ? `<button type="button" class="mark-btn" data-mark="${i}" aria-label="Item ${i + 1}: ${it.mark === 'x' ? 'off the list, switch to on' : 'on the list, switch to off'}">${mark(it.mark)}</button>` : mark('check')}
          <input data-item="${i}" maxlength="200" value="${esc(it.text)}" aria-label="Item ${i + 1}" placeholder="${d.remixOf && d.remixOf.items[i] ? esc(d.remixOf.items[i].text) : `Item ${i + 1}`}">
          <span class="edit-tools">
            <button type="button" class="icon" data-up="${i}" aria-label="Move item ${i + 1} up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon" data-down="${i}" aria-label="Move item ${i + 1} down" ${i === d.items.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon" data-remove="${i}" aria-label="Remove item ${i + 1}">×</button>
          </span></li>`).join('')}
      </ol>
      <button type="button" class="btn-ghost" data-add ${d.items.length >= 50 ? 'disabled' : ''}>+ Add item</button>
      <details><summary>Paste a whole list</summary>
        <label for="f-paste" class="sr-only">One item per line</label>
        <textarea id="f-paste" rows="4" placeholder="One item per line"></textarea>
        <button type="button" class="btn-ghost" data-paste>Add these</button></details>
      <div id="form-msg"></div>
      <div class="actions">
        <button class="btn" type="submit" data-status="published">Post it</button>
        <button class="btn-ghost" type="submit" data-status="draft">Save draft</button>
      </div>
    </form>`;

  const form = document.getElementById('create');
  const sync = () => {
    d.title = form.title.value; d.intro = form.intro.value; d.category_id = form.category_id.value;
    d.visibility = form.visibility.value; d.ranked = form.ranked.checked; d.kind = form.udefine.checked ? 'udefine' : 'checklist';
    form.querySelectorAll('[data-item]').forEach((inp) => (d.items[Number(inp.dataset.item)].text = inp.value));
  };
  const rerender = (focusSel) => { sync(); renderCreate(cats, pod); if (focusSel) main.querySelector(focusSel)?.focus(); };
  form.addEventListener('change', (e) => { if (e.target.name === 'udefine' || e.target.name === 'ranked') rerender(); });
  form.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || b.type === 'submit') return;
    sync();
    const ds = b.dataset;
    if ('add' in ds) { d.items.push({ text: '', note: '', mark: 'check' }); return rerender(`[data-item="${d.items.length - 1}"]`); }
    if (ds.remove) { d.items.splice(Number(ds.remove), 1); if (!d.items.length) d.items.push({ text: '', note: '', mark: 'check' }); return rerender(); }
    if (ds.up) { const i = Number(ds.up); [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]]; return rerender(`[data-up="${i - 1}"]`); }
    if (ds.down) { const i = Number(ds.down); [d.items[i + 1], d.items[i]] = [d.items[i], d.items[i + 1]]; return rerender(`[data-down="${i + 1}"]`); }
    if (ds.mark) { const it = d.items[Number(ds.mark)]; it.mark = it.mark === 'x' ? 'check' : 'x'; return rerender(`[data-mark="${ds.mark}"]`); }
    if ('paste' in ds) {
      const lines = form.querySelector('#f-paste').value.split('\n').map((s) => s.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      d.items = d.items.filter((it) => it.text.trim()).concat(lines.map((text) => ({ text: text.slice(0, 200), note: '', mark: 'check' }))).slice(0, 50);
      return rerender();
    }
    if (ds.usePrompt || 'givePrompt' in ds) {
      const pr = ds.usePrompt ? (await db.prompts()).find((x) => String(x.id) === ds.usePrompt) : await db.randomPrompt(d.prompt_id);
      if (pr) { d.prompt_id = pr.id; d.promptText = pr.text; d.title = pr.text.replace(/…$/, ''); }
      return rerender('#f-title');
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); sync();
    const msg = document.getElementById('form-msg');
    const items = d.items.map((it) => ({ ...it, text: it.text.trim() })).filter((it) => it.text);
    if (!d.title.trim()) { msg.innerHTML = errorBox('Give your list a title.'); form.title.focus(); return; }
    if (!items.length) { msg.innerHTML = errorBox('Add at least one item.'); return; }
    const status = e.submitter?.dataset.status || 'published';
    form.querySelectorAll('button[type=submit]').forEach((b) => (b.disabled = true));
    try {
      const id = await db.createList({ title: d.title.trim(), intro: d.intro.trim(), category_id: d.category_id ? Number(d.category_id) : null,
        prompt_id: d.prompt_id, ranked: d.ranked, kind: d.kind, visibility: d.visibility, status, remixed_from: d.remixed_from }, items);
      draft = null;
      toast(status === 'draft' ? 'Draft saved' : 'Posted!');
      go(`#/list/${id}`);
    } catch (err) {
      msg.innerHTML = errorBox(err);
      form.querySelectorAll('button[type=submit]').forEach((b) => (b.disabled = false));
    }
  });
}

async function viewCategory(slug) {
  const cats = await db.categories();
  const c = cats.find((x) => x.slug === slug);
  if (!c) { main.innerHTML = `<p class="empty">No such category.</p>`; return; }
  const sort = params().get('sort') || 'hot';
  const lists = await db.feed({ categoryId: c.id, sort, limit: 40 });
  document.title = `${c.name} · YellowChecklist`;
  main.innerHTML = `
    <header class="page-head"><h1>${esc(c.name)}</h1><p class="lede">${esc(c.description)}</p>
      <nav class="tabs" aria-label="Sort">${['hot', 'new', 'top'].map((s) =>
        `<a href="#/c/${esc(slug)}?sort=${s}" ${s === sort ? 'aria-current="page"' : ''}>${s[0].toUpperCase() + s.slice(1)}</a>`).join('')}</nav>
      <a class="btn" href="#/create">+ New list here</a></header>
    ${await cards(lists)}`;
}

async function viewProfile(username) {
  const prof = await db.profileByUsername(username);
  if (!prof) { main.innerHTML = `<p class="empty">No one goes by @${esc(username)} yet.</p>`; return; }
  const user = await db.currentUser();
  const mine = user && user.id === prof.id;
  const [lists, mydrafts] = await Promise.all([db.feed({ authorId: prof.id, sort: 'new', limit: 60, includePrivate: mine }), mine ? db.drafts() : []]);
  main.innerHTML = `
    <header class="page-head"><h1>@${esc(prof.username)}</h1>
      ${mine ? `<form id="bio" class="stack"><label for="f-bio">Your bio</label>
        <textarea id="f-bio" rows="2" maxlength="280" placeholder="Writer, hiker, dog person…">${esc(prof.bio)}</textarea>
        <button class="btn-ghost" type="submit">Save bio</button></form>` : `<p class="lede">${esc(prof.bio)}</p>`}
    </header>
    ${mydrafts.length ? `<section><h2 class="section-title">Your drafts</h2>${await cards(mydrafts)}</section>` : ''}
    <section><h2 class="section-title">Lists</h2>${await cards(lists, mine ? "You haven't posted a list yet." : 'No lists yet.')}</section>`;
  const f = document.getElementById('bio');
  if (f) f.onsubmit = async (e) => { e.preventDefault(); await db.updateBio(f.querySelector('textarea').value.trim()); toast('Bio saved'); };
}

async function viewSearch() {
  const q = params().get('q') || '';
  const cats = await db.categories();
  let results = '';
  if (q) {
    const lists = await db.feed({ q, sort: 'top', limit: 40 });
    const catHits = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    const person = /^@?[a-z0-9_]{3,24}$/i.test(q) ? await db.profileByUsername(q.replace('@', '').toLowerCase()) : null;
    results = `
      ${person ? `<p>Person: <a href="#/u/${esc(person.username)}">@${esc(person.username)}</a></p>` : ''}
      ${catHits.length ? `<p>Categories: ${catHits.map((c) => `<a href="#/c/${esc(c.slug)}">${esc(c.name)}</a>`).join(', ')}</p>` : ''}
      ${await cards(lists, `No lists match "${q}". Make one?`)}`;
  }
  main.innerHTML = `
    <header class="page-head"><h1>Search</h1>
      <form id="search" class="search" role="search"><label for="f-q" class="sr-only">Search lists, categories or @people</label>
        <input id="f-q" type="search" value="${esc(q)}" placeholder="Lists, categories or @people"><button class="btn">Search</button></form></header>
    ${results}`;
  const f = document.getElementById('search');
  f.onsubmit = (e) => { e.preventDefault(); go(`#/search?q=${encodeURIComponent(f.querySelector('input').value.trim())}`); };
  if (!q) f.querySelector('input').focus();
}

async function viewSignIn() {
  if (await db.myProfile()) { go('#/'); return; }
  if (await db.currentUser()) { go('#/welcome'); return; }
  main.innerHTML = `
    <form id="signin" class="sheet paper stack narrow">
      <h1 class="sheet-title">Sign in</h1>
      <p>No password needed. We'll email you a sign-in code.</p>
      <label for="f-email">Email</label>
      <input id="f-email" type="email" required autocomplete="email">
      <button class="btn" type="submit">Email me a code</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('signin');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const email = f.querySelector('input').value.trim();
    f.querySelector('button').disabled = true;
    try {
      await db.signInEmail(email);
      if (db.getMode() === 'demo') { go('#/welcome'); return; }
      showCodeStep(email);
    } catch (err) { msg.innerHTML = errorBox(err); f.querySelector('button').disabled = false; }
  };
}
function showCodeStep(email) {
  main.innerHTML = `
    <form id="code" class="sheet paper stack narrow">
      <h1 class="sheet-title">Check your email</h1>
      <p>We sent a code to <b>${esc(email)}</b>. Type it here. (It can take a minute; check spam too.)</p>
      <label for="f-code">Sign-in code</label>
      <input id="f-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required>
      <button class="btn" type="submit">Sign in</button>
      <button class="link" type="button" data-again>Send a new code</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('code');
  f.querySelector('input').focus();
  f.querySelector('[data-again]').onclick = () => viewSignIn();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const token = f.querySelector('input').value.replace(/\D/g, '');
    f.querySelector('button[type=submit]').disabled = true;
    try {
      await db.verifyCode(email, token);
      await renderAccount();
      go((await db.myProfile()) ? '#/' : '#/welcome');
    } catch (err) {
      msg.innerHTML = errorBox('That code didn\'t work. Check it, or send a new one.');
      f.querySelector('button[type=submit]').disabled = false;
    }
  };
}

async function viewWelcome() {
  const user = await db.currentUser();
  if (!user) { go('#/signin'); return; }
  if (await db.myProfile()) { go('#/'); return; }
  main.innerHTML = `
    <form id="welcome" class="sheet paper stack narrow">
      <h1 class="sheet-title">Pick a username</h1>
      <p>This is how people will see you. Lowercase letters, numbers and underscores, 3 to 24 characters.</p>
      <label for="f-user">Username</label>
      <input id="f-user" required pattern="[a-z0-9_]{3,24}" maxlength="24" autocapitalize="none" autocomplete="username">
      <button class="btn" type="submit">Save</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('welcome');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const name = f.querySelector('input').value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(name)) { document.getElementById('form-msg').innerHTML = errorBox('Use 3 to 24 lowercase letters, numbers or underscores.'); return; }
    try { await db.createProfile(name); renderAccount(); toast(`Welcome, @${name}`); go('#/create'); }
    catch (err) { document.getElementById('form-msg').innerHTML = errorBox(err); }
  };
}

// ---------- account + routing ----------
async function renderAccount() {
  const [user, prof] = [await db.currentUser(), await db.myProfile()];
  if (prof) accountEl.innerHTML = `<a href="#/u/${esc(prof.username)}">@${esc(prof.username)}</a> <button class="link" id="signout">Sign out</button>`;
  else if (user) accountEl.innerHTML = `<a href="#/welcome">Finish signing up</a>`;
  else accountEl.innerHTML = `<a href="#/signin">Sign in</a>`;
  const so = document.getElementById('signout');
  if (so) so.onclick = async () => { await db.signOut(); renderAccount(); go('#/'); };
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-upvote]');
  if (!b) return;
  if (!(await needProfile())) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.disabled = true;
  try {
    await db.setUpvote(b.dataset.upvote, on);
    const n = b.querySelector('span');
    n.textContent = Number(n.textContent) + (on ? 1 : -1);
    b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
  } catch (err) { toast(err.message); }
  b.disabled = false;
});

async function route() {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  document.title = 'YellowChecklist';
  main.setAttribute('aria-busy', 'true');
  try {
    if (!parts.length) await viewHome();
    else if (parts[0] === 'list' && parts[1]) await viewList(decodeURIComponent(parts[1]));
    else if (parts[0] === 'create') await viewCreate();
    else if (parts[0] === 'c' && parts[1]) await viewCategory(decodeURIComponent(parts[1]));
    else if (parts[0] === 'u' && parts[1]) await viewProfile(decodeURIComponent(parts[1]));
    else if (parts[0] === 'search') await viewSearch();
    else if (parts[0] === 'signin') await viewSignIn();
    else if (parts[0] === 'welcome') await viewWelcome();
    else main.innerHTML = `<p class="empty">Page not found. <a href="#/">Go home</a></p>`;
  } catch (err) {
    console.error(err);
    main.innerHTML = errorBox(err);
  }
  main.removeAttribute('aria-busy');
}

(async function start() {
  const mode = await db.init();
  if (mode === 'demo') {
    banner.hidden = false;
    banner.textContent = 'Demo mode: sample lists, nothing is saved.';
  }
  const authErr = db.authErrorFromUrl();
  if (authErr) {
    banner.hidden = false;
    banner.textContent = `Sign-in link didn't work (${authErr}). Sign in again and type the emailed code instead.`;
    history.replaceState(null, '', location.pathname + '#/signin');
  } else if (new URLSearchParams(location.search).has('code')) {
    // Came back from an email link. It only works in the browser that asked for it.
    const signedIn = await db.currentUser();
    history.replaceState(null, '', location.pathname + (signedIn ? (location.hash || '#/') : '#/signin'));
    if (!signedIn) {
      banner.hidden = false;
      banner.textContent = 'That link opened in a different browser than the one you signed in from. Sign in here and type the emailed code instead.';
    }
  }
  db.onAuth(async () => {
    await renderAccount();
    const user = await db.currentUser();
    if (user && !(await db.myProfile()) && !location.hash.startsWith('#/welcome')) go('#/welcome');
  });
  await renderAccount();
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
