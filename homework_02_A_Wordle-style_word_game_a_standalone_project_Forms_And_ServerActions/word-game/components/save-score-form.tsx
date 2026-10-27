"use client";
import { useActionState } from "react";
import { saveScore, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function SaveScoreForm({ gameId }: { gameId: string }) {
    
  const [state, formAction] = useActionState<ActionState, FormData>(saveScore.bind(null, gameId),{});
    
    return (
      
    <form action={formAction} className="space-y-3">
      <label htmlFor="nickname" className="block text-sm font-semibold">
          Nickname
        </label>
      <Input
        key={state.values?.nickname ?? "initial"}
        id="nickname"
        name="nickname"
        defaultValue={state.values?.nickname ?? ""}
        minLength={2}
        maxLength={20}
        aria-invalid={!!state.fieldErrors?.nickname}
        aria-describedby={
          state.fieldErrors?.nickname ? "nickname-error" : "nickname-help"
        }
      />
      <p id="nickname-help" className="text-muted-foreground text-xs">
        2–20 characters: letters, numbers, spaces, hyphens, underscores.
      </p>
      {state.fieldErrors?.nickname?.map((message) => (
        <p
          id="nickname-error"
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
      <ActionSubmit idle="Save score" pending="Saving…" />
    </form>
  );
}
