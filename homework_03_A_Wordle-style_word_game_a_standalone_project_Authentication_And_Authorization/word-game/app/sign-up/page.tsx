import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/safe-next";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
  }) {
  
  const params = await searchParams;
  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );

  return (
    <AuthForm
      mode="sign-up"
      next={safeNext(params.next)}
      githubEnabled={githubEnabled}
    />
  );
}
