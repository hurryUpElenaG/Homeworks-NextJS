"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({
  mode,
  next,
  githubEnabled,
}: {
  mode: "sign-in" | "sign-up";
  next: string;
  githubEnabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result =
        mode === "sign-up"
          ? await signUp.email({
              name: name.trim(),
              email: email.trim(),
              password,
              callbackURL: next,
            })
          : await signIn.email({
              email: email.trim(),
              password,
              callbackURL: next,
            });
      if (result.error)
        setError(
          mode === "sign-in"
            ? "Invalid email or password."
            : result.error.message ||
                "We couldn't create your account. Please try again.",
        );
      else {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError(
        mode === "sign-in"
          ? "Invalid email or password."
          : "We couldn't create your account. Please try again.",
      );
    } finally {
      setPending(false);
      setPassword("");
    }
  }

  async function github() {
    setError("");
    setPending(true);
    try {
      await signIn.social({ provider: "github", callbackURL: next });
    } catch {
      setError("We couldn't sign in with GitHub. Please try again.");
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm space-y-5">
      <div>
        <h1 className="text-3xl font-black">
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {mode === "sign-up"
            ? "Create an account to save your games."
            : "Welcome back to Word Game."}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "sign-up" && (
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
          />
          <p className="text-muted-foreground mt-1 text-xs">
            At least 8 characters.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending
            ? "Please wait…"
            : mode === "sign-up"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
      {githubEnabled && (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="w-full"
          onClick={github}
        >
          Continue with GitHub
        </Button>
      )}
      <p className="text-sm">
        {mode === "sign-up" ? "Already have an account? " : "New here? "}
        <Link
          className="underline"
          href={`${mode === "sign-up" ? "/sign-in" : "/sign-up"}?next=${encodeURIComponent(next)}`}
        >
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
