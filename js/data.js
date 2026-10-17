// Data layer. Talks to Supabase when it can load; otherwise runs a
// demo mode with sample lists kept in memory (handy for previews).
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB } from './config.js';
import { demoSeed } from './demo.js';

let sb = null;
let mode = 'demo';
const listeners = new Set();

export async function init() {
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (!forceDemo) {
    try {
      const { createClient } = await import(SUPABASE_LIB);
      sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
      mode = 'live';
      sb.auth.onAuthStateChange(() => listeners.forEach((fn) => fn()));
    } catch (e) {
      console.warn('Supabase unavailable, running demo mode', e);
    }
  }
  if (mode === 'demo') demo.load();
  return mode;
}
export const getMode = () => mode;
export const onAuth = (fn) => listeners.add(fn);

const LIST_SELECT =
  'id,title,intro,ranked,kind,visibility,status,upvote_count,created_at,remixed_from,category_id,prompt_id,author_id,' +
  'author:profiles(username),category:categories(name,slug),items:list_items(position,text,note,mark)';

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
const sortItems = (l) => (l && l.items ? { ...l, items: [...l.items].sort((a, b) => a.position - b.position) } : l);

// ---------- Auth ----------
export async function currentUser() {
  if (mode === 'demo') return demo.user;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}
export async function signInEmail(email) {
  if (mode === 'demo') { demo.signIn(email); listeners.forEach((fn) => fn()); return; }
  check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }));
}
export async function signOut() {
  if (mode === 'demo') { demo.user = null; listeners.forEach((fn) => fn()); return; }
  await sb.auth.signOut();
}
export async function myProfile() {
  const u = await currentUser();
  if (!u) return null;
  if (mode === 'demo') return demo.profiles.find((p) => p.id === u.id) || null;
  return check(await sb.from('profiles').select('*').eq('id', u.id).maybeSingle());
}
export async function createProfile(username) {
  const u = await currentUser();
  if (mode === 'demo') {
    if (demo.profiles.some((p) => p.username === username)) throw new Error('That username is taken.');
    demo.profiles.push({ id: u.id, username, bio: '' });
    return;
  }
  const res = await sb.from('profiles').insert({ id: u.id, username });
  if (res.error && res.error.code === '23505') throw new Error('That username is taken.');
  check(res);
}
export async function updateBio(bio) {
  const u = await currentUser();
  if (mode === 'demo') { demo.profiles.find((p) => p.id === u.id).bio = bio; return; }
  check(await sb.from('profiles').update({ bio }).eq('id', u.id));
}
export async function profileByUsername(username) {
  if (mode === 'demo') return demo.profiles.find((p) => p.username === username) || null;
  return check(await sb.from('profiles').select('*').eq('username', username).maybeSingle());
}

// ---------- Categories & prompts ----------
let catCache = null;
export async function categories() {
  if (catCache) return catCache;
  catCache = mode === 'demo' ? demo.categories : check(await sb.from('categories').select('*').order('sort'));
  return catCache;
}
let promptCache = null;
export async function prompts() {
  if (promptCache) return promptCache;
  promptCache = mode === 'demo' ? demo.prompts : check(await sb.from('prompts').select('*').order('id'));
  return promptCache;
}
export async function promptOfDay() {
  const all = await prompts();
  if (!all.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const featured = all.find((p) => p.featured_on === today);
  if (featured) return featured;
  const day = Math.floor(Date.now() / 86400000);
  return all[day % all.length];
}
export async function randomPrompt(exceptId) {
  const all = (await prompts()).filter((p) => p.id !== exceptId);
  return all[Math.floor(Math.random() * all.length)] || null;
}

// ---------- Lists ----------
function hotScore(l) {
  const hours = (Date.now() - new Date(l.created_at).getTime()) / 3600000;
  return (l.upvote_count + 1) / Math.pow(hours + 2, 1.5);
}
export async function feed({ categoryId, authorId, sort = 'hot', q, limit = 30, includePrivate = false } = {}) {
  let rows;
  if (mode === 'demo') {
    rows = demo.lists.filter((l) => l.status === 'published' && (includePrivate || l.visibility === 'public'));
    if (categoryId) rows = rows.filter((l) => l.category_id === categoryId);
    if (authorId) rows = rows.filter((l) => l.author_id === authorId);
    if (q) rows = rows.filter((l) => l.title.toLowerCase().includes(q.toLowerCase()));
    rows = rows.map(demo.hydrate);
  } else {
    let query = sb.from('lists').select(LIST_SELECT).eq('status', 'published');
    if (!includePrivate) query = query.eq('visibility', 'public');
    if (categoryId) query = query.eq('category_id', categoryId);
    if (authorId) query = query.eq('author_id', authorId);
    if (q) query = query.ilike('title', `%${q.replace(/[%_]/g, '')}%`);
    query = sort === 'top' ? query.order('upvote_count', { ascending: false }) : query.order('created_at', { ascending: false });
    rows = check(await query.limit(sort === 'hot' ? 200 : limit));
  }
  rows = rows.map(sortItems);
  if (sort === 'hot') rows.sort((a, b) => hotScore(b) - hotScore(a));
  else if (sort === 'top') rows.sort((a, b) => b.upvote_count - a.upvote_count);
  else rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows.slice(0, limit);
}
export async function drafts() {
  const u = await currentUser();
  if (!u) return [];
  if (mode === 'demo') return demo.lists.filter((l) => l.author_id === u.id && l.status === 'draft').map(demo.hydrate);
  return check(await sb.from('lists').select(LIST_SELECT).eq('author_id', u.id).eq('status', 'draft').order('created_at', { ascending: false }));
}
export async function getList(id) {
  if (mode === 'demo') {
    const l = demo.lists.find((x) => x.id === id);
    return l ? sortItems(demo.hydrate(l)) : null;
  }
  const l = check(await sb.from('lists').select(LIST_SELECT + ',prompt:prompts(text)').eq('id', id).maybeSingle());
  return sortItems(l);
}
export async function createList(list, items) {
  const u = await currentUser();
  if (mode === 'demo') {
    const id = 'demo-' + Math.random().toString(36).slice(2, 10);
    demo.lists.unshift({ ...list, id, author_id: u.id, upvote_count: 0, created_at: new Date().toISOString(),
      items: items.map((it, i) => ({ ...it, position: i + 1 })) });
    return id;
  }
  const row = check(await sb.from('lists').insert({ ...list, author_id: u.id }).select('id').single());
  if (items.length) {
    const res = await sb.from('list_items').insert(items.map((it, i) => ({ ...it, list_id: row.id, position: i + 1 })));
    if (res.error) { await sb.from('lists').delete().eq('id', row.id); throw new Error(res.error.message); }
  }
  return row.id;
}
export async function publishDraft(id) {
  if (mode === 'demo') { demo.lists.find((l) => l.id === id).status = 'published'; return; }
  check(await sb.from('lists').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', id));
}
export async function deleteList(id) {
  if (mode === 'demo') { demo.lists = demo.lists.filter((l) => l.id !== id); return; }
  check(await sb.from('lists').delete().eq('id', id));
}

// ---------- Upvotes ----------
export async function myUpvotes(listIds) {
  const u = await currentUser();
  if (!u || !listIds.length) return new Set();
  if (mode === 'demo') return new Set(demo.upvotes.filter((v) => v.user_id === u.id).map((v) => v.list_id));
  const rows = check(await sb.from('upvotes').select('list_id').eq('user_id', u.id).in('list_id', listIds));
  return new Set(rows.map((r) => r.list_id));
}
export async function setUpvote(listId, on) {
  const u = await currentUser();
  if (mode === 'demo') {
    const l = demo.lists.find((x) => x.id === listId);
    if (on) { demo.upvotes.push({ user_id: u.id, list_id: listId }); l.upvote_count++; }
    else { demo.upvotes = demo.upvotes.filter((v) => !(v.user_id === u.id && v.list_id === listId)); l.upvote_count--; }
    return;
  }
  if (on) check(await sb.from('upvotes').insert({ list_id: listId, user_id: u.id }));
  else check(await sb.from('upvotes').delete().eq('list_id', listId).eq('user_id', u.id));
}

// ---------- Comments & reports ----------
export async function comments(listId) {
  if (mode === 'demo') return demo.comments.filter((c) => c.list_id === listId).map(demo.hydrateComment);
  return check(await sb.from('comments').select('id,body,created_at,author_id,author:profiles(username)').eq('list_id', listId).order('created_at'));
}
export async function addComment(listId, body) {
  const u = await currentUser();
  if (mode === 'demo') { demo.comments.push({ id: Date.now(), list_id: listId, author_id: u.id, body, created_at: new Date().toISOString() }); return; }
  check(await sb.from('comments').insert({ list_id: listId, body, author_id: u.id }));
}
export async function deleteComment(id) {
  if (mode === 'demo') { demo.comments = demo.comments.filter((c) => c.id !== id); return; }
  check(await sb.from('comments').delete().eq('id', id));
}
export async function report({ listId = null, commentId = null, reason = '' }) {
  const u = await currentUser();
  if (mode === 'demo') return;
  check(await sb.from('reports').insert({ list_id: listId, comment_id: commentId, reason, reporter_id: u.id }));
}

// ---------- Demo store ----------
const demo = {
  user: null, profiles: [], categories: [], prompts: [], lists: [], upvotes: [], comments: [],
  load() { Object.assign(this, structuredClone(demoSeed)); },
  signIn(email) {
    const id = 'demo-user-' + email.toLowerCase();
    this.user = { id, email };
  },
  hydrate(l) {
    return {
      ...l,
      author: { username: (demo.profiles.find((p) => p.id === l.author_id) || {}).username || 'someone' },
      category: demo.categories.find((c) => c.id === l.category_id) || null,
      prompt: demo.prompts.find((p) => p.id === l.prompt_id) || null,
    };
  },
  hydrateComment(c) {
    return { ...c, author: { username: (demo.profiles.find((p) => p.id === c.author_id) || {}).username || 'someone' } };
  },
};
