import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not configured. Add it to .env first.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./drizzle",
  dbCredentials: { url },
});
