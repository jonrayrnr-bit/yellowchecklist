-- YellowChecklist database setup
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run once on a fresh project.

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now()
);

create table public.categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  parent_id int references public.categories (id) on delete set null,
  sort int not null default 0
);

create table public.prompts (
  id serial primary key,
  text text not null,
  type text not null default 'lead-in'
    check (type in ('lead-in', 'quote', 'lyric', 'photo', 'remix')),
  category_id int references public.categories (id) on delete set null,
  featured_on date unique,
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  intro text not null default '' check (char_length(intro) <= 1000),
  category_id int references public.categories (id) on delete set null,
  prompt_id int references public.prompts (id) on delete set null,
  ranked boolean not null default false,
  kind text not null default 'checklist' check (kind in ('checklist', 'udefine')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'published' check (status in ('draft', 'published')),
  upvote_count int not null default 0,
  remixed_from uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  id bigserial primary key,
  list_id uuid not null references public.lists (id) on delete cascade,
  position int not null,
  text text not null check (char_length(text) between 1 and 200),
  note text not null default '' check (char_length(note) <= 500),
  mark text not null default 'check' check (mark in ('check', 'x'))
);

create table public.upvotes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

create table public.comments (
  id bigserial primary key,
  list_id uuid not null references public.lists (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.reports (
  id bigserial primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  list_id uuid references public.lists (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index lists_category_idx on public.lists (category_id, created_at desc);
create index lists_author_idx on public.lists (author_id, created_at desc);
create index list_items_list_idx on public.list_items (list_id, position);
create index comments_list_idx on public.comments (list_id, created_at);

-- ---------- Upvote count stays in sync (one upvote per person per list) ----------

create function public.sync_upvote_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.lists set upvote_count = upvote_count + 1 where id = new.list_id;
  elsif tg_op = 'DELETE' then
    update public.lists set upvote_count = greatest(upvote_count - 1, 0) where id = old.list_id;
  end if;
  return null;
end $$;

create trigger upvotes_sync after insert or delete on public.upvotes
for each row execute function public.sync_upvote_count();

-- ---------- Who can see a list ----------

create function public.can_view_list(l public.lists) returns boolean
language sql stable as $$
  select (l.status = 'published' and l.visibility in ('public', 'unlisted'))
      or l.author_id = auth.uid()
$$;

-- ---------- Security rules ----------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.prompts enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.upvotes enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "make your own profile" on public.profiles for insert with check (id = auth.uid());
create policy "edit your own profile" on public.profiles for update using (id = auth.uid());

create policy "categories are public" on public.categories for select using (true);
create policy "prompts are public" on public.prompts for select using (true);

create policy "see visible lists" on public.lists for select using (public.can_view_list(lists));
create policy "post your own lists" on public.lists for insert with check (author_id = auth.uid());
create policy "edit your own lists" on public.lists for update using (author_id = auth.uid());
create policy "delete your own lists" on public.lists for delete using (author_id = auth.uid());

create policy "see items of visible lists" on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_id and public.can_view_list(l)));
create policy "manage items on your lists" on public.list_items for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.author_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.author_id = auth.uid()));

create policy "upvotes are public" on public.upvotes for select using (true);
create policy "upvote as yourself" on public.upvotes for insert with check (user_id = auth.uid());
create policy "remove your upvote" on public.upvotes for delete using (user_id = auth.uid());

create policy "see comments on visible lists" on public.comments for select
  using (exists (select 1 from public.lists l where l.id = list_id and public.can_view_list(l)));
create policy "comment as yourself" on public.comments for insert with check (author_id = auth.uid());
create policy "delete your own comments" on public.comments for delete using (author_id = auth.uid());

create policy "anyone signed in can report" on public.reports for insert with check (reporter_id = auth.uid());

-- Nobody can set upvote counts by hand: only the trigger above changes them.
revoke insert, update on public.lists from anon, authenticated;
grant insert (author_id, title, intro, category_id, prompt_id, ranked, kind, visibility, status, remixed_from)
  on public.lists to authenticated;
grant update (title, intro, category_id, prompt_id, ranked, kind, visibility, status, updated_at)
  on public.lists to authenticated;

-- ---------- Starter categories (the 10 launch categories) ----------

insert into public.categories (slug, name, description, sort) values
  ('to-do', 'To-Do & Productivity', 'The site''s roots: to-do lists and how to use lists better', 1),
  ('bucket-lists-travel', 'Bucket Lists & Travel', 'Places, experiences, goals', 2),
  ('personal-rankings', 'Personal Rankings', 'Your own bests, worsts and lessons', 3),
  ('nerd-out', 'Nerd Out', 'Deep dives into a niche obsession', 4),
  ('things-my-always-does', 'Things My ___ Always Does', 'Funny lists about the people and pets in your life', 5),
  ('satire-comedy', 'Satire & Comedy', 'Comic and satirical lists', 6),
  ('history', 'History', 'Flubs, disasters, firsts, famous people''s lists', 7),
  ('food-drink', 'Food & Drink', 'What we eat, drink and argue about', 8),
  ('life-lessons', 'Life Lessons & Wisdom', 'What you learned along the way', 9),
  ('nostalgia', 'Nostalgia', 'The things that take you back', 10);

-- ---------- Starter prompts ----------

insert into public.prompts (text, type) values
  ('Books that changed my life', 'lead-in'),
  ('I remember the first time I heard…', 'lead-in'),
  ('Movies I can quote word for word', 'lead-in'),
  ('Songs that take me straight back to…', 'lead-in'),
  ('Albums I''d take to a desert island', 'lead-in'),
  ('Things I learned the hard way about…', 'lead-in'),
  ('The first time I saw…', 'lead-in'),
  ('Places that felt like home the moment I arrived', 'lead-in'),
  ('Things I''ll never understand about…', 'lead-in'),
  ('Things I wish I''d known before I started…', 'lead-in'),
  ('Teachers, mentors or people who shaped me', 'lead-in'),
  ('Small things that make my day better', 'lead-in'),
  ('Hobbies I got way too into', 'lead-in'),
  ('Things I''d tell my 18-year-old self', 'lead-in');
