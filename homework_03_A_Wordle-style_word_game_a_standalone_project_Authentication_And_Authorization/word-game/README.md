# Word Game — Homework 3

A Wordle-style game built with Next.js App Router, TypeScript, PostgreSQL, Drizzle ORM, Zod, Tailwind CSS and shadcn/ui-style components.

## How to run the game

Requirements: Node.js 20.9+, npm and PostgreSQL.

1. Create a PostgreSQL database named `word_game`.
2. Copy `.env.example` to `.env` and set your real values for `DATABASE_URL` and GitHub OAuth app setup. Never commit `.env`.

From your Github account provide the values for(GitHub OAuth app setup):
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_EMAIL=
3. Install packages: `npm install`
4. Apply both migrations: `npm run db:migrate`. The second migration adds game history, score saving, puzzle metadata and the database uniqueness rule.
5. Seed the original puzzles: `npm run db:seed`.
6. Start Next.js: `npm run dev`.
7. Open <http://localhost:3000>. The admin area is <http://localhost:3000/admin>; it is intentionally **not protected by authentication** for this homework and must not be deployed publicly as-is.

## Useful commands

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run test:wordle

## Important testing notes

1. Test as a visitor, a player and an admin.
2. Try to open `/admin`, `/users`, `/my-games` and another player's `/game/:id` by typing the address directly.
3. Re-send game/admin actions from the browser's developer tools. The server-side guard must still refuse them.
4. Test invalid return destinations: `https://example.com`, `//example.com`, and `/\example.com`.
5. Confirm the browser's session cookie is HttpOnly and the `account.password` database value is a hash.


