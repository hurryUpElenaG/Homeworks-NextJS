# Word Game — Homework 2

A Wordle-style game built with Next.js App Router, TypeScript, PostgreSQL, Drizzle ORM, Zod, Tailwind CSS and shadcn/ui-style components.

## How to run the game

Requirements: Node.js 20.9+, npm and PostgreSQL.

1. Create a PostgreSQL database named `word_game`.
2. Copy `.env.example` to `.env` and set your real `DATABASE_URL`. Never commit `.env`.
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