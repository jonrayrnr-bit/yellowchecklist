# YellowChecklist

Make a list. Trade a list. The site for yellowchecklist.com.

It is a plain website with no build step: HTML, CSS and JavaScript files that any
static host can serve. It runs on Cloudflare Pages and stores accounts, lists,
votes and comments in Supabase. It also installs on a phone like an app (a PWA).

## What's in here

| Path | What it is |
| --- | --- |
| `index.html` | The page shell |
| `css/style.css` | The yellow-paper look |
| `js/app.js` | Pages: home, list, create, category, profile, search, sign-in |
| `js/data.js` | Talks to Supabase (or runs demo mode) |
| `js/config.js` | Supabase project URL and publishable key (both public) |
| `js/demo.js` | Sample lists for demo mode |
| `supabase/schema.sql` | Database setup: tables, security rules, starter categories and prompts |
| `manifest.webmanifest`, `sw.js`, `icons/` | What lets it install as a phone app |

## One-time setup

1. **Database.** In Supabase, open SQL Editor, paste all of `supabase/schema.sql`, and click Run.
2. **Sign-in links.** In Supabase, Authentication → URL Configuration: set Site URL to
   `https://yellowchecklist.com` and add `https://yellowchecklist.com/**` and your
   `https://*.pages.dev/**` preview address under Redirect URLs.
3. **Code.** Put this folder in a GitHub repository named `yellowchecklist`.
4. **Hosting.** In Cloudflare, Workers & Pages → Create → Pages → Connect to Git →
   pick the repository. Framework preset: None. Build command: leave empty.
   Output directory: `/`. Deploy.
5. **Domain.** In that Pages project, Custom domains → add `yellowchecklist.com`.

## Trying it without the database

Open the site with `?demo` on the end (for example `https://yellowchecklist.com/?demo`)
to see it with sample lists. Nothing is saved in demo mode.

## Keys

`js/config.js` holds the **publishable** key, which is meant to be public. The
database security rules decide what anyone can do with it. Never put the
Supabase **secret** (service_role) key in this code.
