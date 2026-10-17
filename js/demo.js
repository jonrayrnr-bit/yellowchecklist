// Sample content for demo mode only (open the site with ?demo).
// Nothing here is saved; the live site reads from Supabase instead.
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

export const demoSeed = {
  categories: [
    { id: 1, slug: 'to-do', name: 'To-Do & Productivity', description: "The site's roots: to-do lists and how to use lists better" },
    { id: 2, slug: 'bucket-lists-travel', name: 'Bucket Lists & Travel', description: 'Places, experiences, goals' },
    { id: 3, slug: 'personal-rankings', name: 'Personal Rankings', description: 'Your own bests, worsts and lessons' },
    { id: 4, slug: 'nerd-out', name: 'Nerd Out', description: 'Deep dives into a niche obsession' },
    { id: 5, slug: 'things-my-always-does', name: 'Things My ___ Always Does', description: 'Funny lists about the people and pets in your life' },
    { id: 6, slug: 'satire-comedy', name: 'Satire & Comedy', description: 'Comic and satirical lists' },
    { id: 7, slug: 'history', name: 'History', description: "Flubs, disasters, firsts, famous people's lists" },
    { id: 8, slug: 'food-drink', name: 'Food & Drink', description: 'What we eat, drink and argue about' },
    { id: 9, slug: 'life-lessons', name: 'Life Lessons & Wisdom', description: 'What you learned along the way' },
    { id: 10, slug: 'nostalgia', name: 'Nostalgia', description: 'The things that take you back' },
  ],
  prompts: [
    { id: 1, text: 'Books that changed my life', type: 'lead-in' },
    { id: 2, text: 'Small things that make my day better', type: 'lead-in' },
    { id: 3, text: "Things I'd tell my 18-year-old self", type: 'lead-in' },
    { id: 4, text: 'Places that felt like home the moment I arrived', type: 'lead-in' },
    { id: 5, text: 'Hobbies I got way too into', type: 'lead-in' },
  ],
  profiles: [
    { id: 'u1', username: 'jpray', bio: 'Writer, teacher, hiker, Aussiedoodle daddy.' },
    { id: 'u2', username: 'listlover', bio: '' },
    { id: 'u3', username: 'northbound', bio: 'Collector of small joys.' },
  ],
  lists: [
    { id: 'd1', author_id: 'u1', title: 'Purple Things I Like', intro: 'My list, my rules.', category_id: 3, ranked: false, kind: 'udefine',
      visibility: 'public', status: 'published', upvote_count: 14, created_at: hoursAgo(5),
      items: [
        { position: 1, text: 'Grimace', note: '', mark: 'check' },
        { position: 2, text: 'Purple Rain', note: 'The whole album, really', mark: 'check' },
        { position: 3, text: 'Eggplant parm', note: '', mark: 'check' },
        { position: 4, text: 'Purple ketchup', note: 'Never again', mark: 'x' },
      ] },
    { id: 'd2', author_id: 'u2', title: 'Acceptable Hot Dog Condiments', intro: 'Fight me in the comments.', category_id: 8, ranked: false, kind: 'udefine',
      visibility: 'public', status: 'published', upvote_count: 22, created_at: hoursAgo(20),
      items: [
        { position: 1, text: 'Yellow mustard', note: '', mark: 'check' },
        { position: 2, text: 'Onions', note: '', mark: 'check' },
        { position: 3, text: 'Sweet relish', note: '', mark: 'check' },
        { position: 4, text: 'Ketchup', note: 'Only for kids', mark: 'x' },
      ] },
    { id: 'd3', author_id: 'u3', title: 'Top 5 Places I Want to Go', intro: '', category_id: 2, ranked: true, kind: 'checklist',
      visibility: 'public', status: 'published', upvote_count: 9, created_at: hoursAgo(2),
      items: [
        { position: 1, text: 'New Zealand', note: '', mark: 'check' },
        { position: 2, text: 'Kyoto in the fall', note: '', mark: 'check' },
        { position: 3, text: 'Patagonia', note: '', mark: 'check' },
        { position: 4, text: 'The Faroe Islands', note: '', mark: 'check' },
        { position: 5, text: 'Banff', note: '', mark: 'check' },
      ] },
    { id: 'd4', author_id: 'u1', title: 'Things My Aussiedoodle Always Does', intro: '', category_id: 5, ranked: false, kind: 'checklist',
      visibility: 'public', status: 'published', upvote_count: 31, created_at: hoursAgo(40),
      items: [
        { position: 1, text: 'Herds me to the kitchen at 5 pm sharp', note: '', mark: 'check' },
        { position: 2, text: 'Leans on whoever is sitting down', note: '', mark: 'check' },
        { position: 3, text: 'Brings one shoe, never both', note: '', mark: 'check' },
      ] },
    { id: 'd5', author_id: 'u3', title: 'Small Things That Make My Day Better', intro: '', category_id: 9, prompt_id: 2, ranked: false, kind: 'checklist',
      visibility: 'public', status: 'published', upvote_count: 6, created_at: hoursAgo(1),
      items: [
        { position: 1, text: 'First sip of coffee', note: '', mark: 'check' },
        { position: 2, text: 'A green light streak', note: '', mark: 'check' },
        { position: 3, text: 'Clean sheets', note: '', mark: 'check' },
      ] },
  ],
  upvotes: [],
  comments: [
    { id: 1, list_id: 'd2', author_id: 'u3', body: 'Ketchup is fine. We do it differently up north!', created_at: hoursAgo(10) },
  ],
};
