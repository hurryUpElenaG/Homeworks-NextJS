"use client";

import { useActionState } from "react";
import { saveScore, type ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";

export function SaveScoreForm({ gameId }: { gameId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveScore.bind(null, gameId),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm">
        Your score will be saved under your account name.
      </p>
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
