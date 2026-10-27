"use client";
import { useActionState } from "react";
import { submitGuess, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function GuessForm({
  gameId,
  disabled,
}: {
  gameId: string;
  disabled: boolean;
}) {
  const action = submitGuess.bind(null, gameId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action,{});
    
  return (
    
    <form action={formAction} className="space-y-3">
      <label htmlFor="guess" className="block text-sm font-semibold">
        Your five-letter guess
      </label>
      <Input
        key={state.values?.guess ?? "initial"}
        id="guess"
        name="guess"
        defaultValue={state.values?.guess ?? ""}
        maxLength={5}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="CRANE"
        aria-invalid={!!state.fieldErrors?.guess}
        aria-describedby={
          state.fieldErrors?.guess ? "guess-error" : "guess-help"
        }
        disabled={disabled || pending}
        className="text-center text-lg font-bold tracking-[0.3em] uppercase"
      />
      <p id="guess-help" className="text-muted-foreground text-xs">
        Use letters A–Z. Press Enter to submit.
      </p>
      {state.fieldErrors?.guess?.map((message) => (
        <p
          id="guess-error"
          key={message}
          role="alert"
          className="text-sm text-red-600"
        >
          {message}
        </p>
      ))}
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
