"use client";

import { useActionState } from "react";
import { submitGuess, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function GuessForm({ gameId }: { gameId: string }) {
  const action = submitGuess.bind(null, gameId);
  const [state, formAction, pending] =
    useActionState<ActionState, FormData>(action, {});

  const hasGuessError = Boolean(state.fieldErrors?.guess);

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="guess" className="block text-sm font-semibold">
        Your five-letter guess
      </label>

      <Input
        id="guess"
        name="guess"
        defaultValue={state.values?.guess ?? ""}
        maxLength={5}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="CRANE"
        aria-invalid={hasGuessError}
        aria-describedby={
          hasGuessError ? "guess-error" : "guess-help"
        }
        readOnly={pending}
        className="text-center text-lg font-bold uppercase tracking-[0.3em]"
      />

      <p id="guess-help" className="text-xs text-muted-foreground">
        Use letters A–Z. Press Enter to submit.
      </p>

      {hasGuessError && (
        <p id="guess-error" role="alert" className="text-sm text-red-600">
          {state.fieldErrors?.guess?.join(" ")}
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}

      <ActionSubmit idle="Submit guess" pending="Checking…" />
    </form>
  );
}