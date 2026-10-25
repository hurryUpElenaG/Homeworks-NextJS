import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { puzzles } from "./schema";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not configured. Add it to .env first.");
}

const words = [
  "apple", "brave", "crane", "drift", "eagle",
  "flame", "grape", "house", "input", "jelly",
  "knife", "lemon", "magic", "night", "ocean",
  "piano", "queen", "river", "stone", "tiger",
  "uncle", "video", "water", "young", "zebra",
  "bread", "chair", "dream", "earth", "field",
] as const;

async function seed() {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  try {
    await db
      .insert(puzzles)
      .values(words.map((answer, index) => ({ id: index + 1, answer })))
      .onConflictDoNothing({ target: puzzles.id });
    process.stdout.write(`Seed complete: checked ${words.length} puzzle records.\n`);
  } finally {
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  process.stderr.write(`Puzzle seeding failed: ${String(error)}\n`);
  process.exitCode = 1;
});
