import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { user } from "../db/auth-schema";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

if (!connectionString) throw new Error("DATABASE_URL is not configured.");

if (!email)
  throw new Error(
    "Set ADMIN_EMAIL to the email of an account that has already signed up.",
  );

async function main() {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });

  try {
    const [account] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!account)
      throw new Error(
        "No account has that email. Sign up in the app first, then run this command.",
      );

    await db
      .update(user)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(user.id, account.id));
    process.stdout.write(`Admin role granted to ${account.email}.\n`);
    
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Could not grant admin role."}\n`,
  );
  process.exitCode = 1;
});
