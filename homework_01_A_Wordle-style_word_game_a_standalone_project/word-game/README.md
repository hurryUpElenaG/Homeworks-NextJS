# Word Game

A standalone Wordle-style five-letter word game built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui-style reusable components, Zod, Drizzle ORM, and PostgreSQL.

## Requirements

- Node.js 20.9 or newer (use a current supported Node.js LTS release)
- PostgreSQL 15 or newer recommended
- npm

## How to run the game

1. Clone this repository and open the `word-game` folder in VS Code.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a PostgreSQL database named `word_game`:

   ```sql
   CREATE DATABASE word_game;
   ```

4. Copy `.env.example` to `.env` and update `DATABASE_URL` with your local PostgreSQL username and password. Never commit `.env`.
5. Generate the Drizzle migration from the schema:

   ```bash
   npm run db:generate
   ```

6. Apply the migration:

   ```bash
   npm run db:migrate
   ```

7. Insert the 30 puzzles. The seed is safe to run repeatedly and will not insert duplicate puzzle IDs:

   ```bash
   npm run db:seed
   ```

8. Start the development server:

   ```bash
   npm run dev
   ```

9. Visit <http://localhost:3000>.

## Useful commands

```bash
npm run dev          # Start Next.js development server
npm run lint         # Run ESLint
npm run build        # Type-check and build the app
npm run test:wordle  # Test the four required colour examples
npm run db:generate  # Generate SQL migrations
npm run db:migrate   # Apply SQL migrations
npm run db:seed      # Seed puzzle data
```

## Routes

- `/` — rules and list of puzzles (only IDs are queried for this page)
- `/puzzle/1` — play puzzle 1
- `/puzzle/7` — play puzzle 7
- Invalid or missing puzzle IDs show a friendly not-found page.

## Letter-colour test cases

| Answer | Guess | Expected result |
|---|---|---|
| `crane` | `crane` | correct, correct, correct, correct, correct |
| `alloy` | `llama` | present, correct, present, absent, absent |
| `speed` | `erase` | present, absent, absent, present, present |
| `apple` | `eagle` | absent, present, absent, correct, correct |

Run `npm run test:wordle` to check these cases automatically. The algorithm first consumes exact-position matches, then consumes each remaining matching letter at most once. This is important for repeated letters.

## Design notes and current limitations

- PostgreSQL stores puzzle numbers and secret words. Drizzle defines the schema and applies migrations.
- The puzzle list selects only puzzle IDs, and the page passes only the puzzle ID to the interactive client component. The server action returns the answer only after a win or the sixth guess.
- React state holds the current game progress, so reloading the page resets that game. Persistence is an optional stretch goal.
- Guess validation checks the format (five English letters), not whether the guess is in a full dictionary.
- The attempt number is sent from the browser, so this is a coursework game, not a tamper-proof competitive game. A production version would persist attempts and game status server-side and validate them transactionally.
