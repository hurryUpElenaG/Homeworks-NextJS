"use client";
import { useActionState } from "react";
import { addPuzzle } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function AddPuzzleForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    addPuzzle,
    {},
  );
  const value = (name: string) => state.values?.[name] ?? "";

  const hasWordError = Boolean(state.fieldErrors?.word);
  const hasHintError = Boolean(state.fieldErrors?.hint);
  const hasDifficultyError = Boolean(state.fieldErrors?.difficulty);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-bold">Add puzzle</h2>
      <div>
        <label htmlFor="word" className="mb-1 block text-sm font-medium">
          Word
        </label>
        <Input
          id="word"
          name="word"
          defaultValue={value("word")}
          maxLength={5}
          aria-invalid={hasWordError}
          aria-describedby={hasWordError ? "word-error" : undefined}
        />
        {hasWordError && (
          <p id="word-error" role="alert" className="text-sm text-red-600">
            {state.fieldErrors?.word?.join(" ")}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">
          Difficulty
        </label>
        <select
          id="difficulty"
          name="difficulty"
          aria-invalid={hasDifficultyError}
          aria-describedby={hasDifficultyError ? "difficulty-error" : undefined}
          className="bg-background h-10 w-full rounded-md border px-3"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        {hasDifficultyError && (
          <p id="difficulty-error" role="alert">
            {state.fieldErrors?.difficulty?.join(" ")}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="hint" className="mb-1 block text-sm font-medium">
          Hint (optional)
        </label>
        <Input
          id="hint"
          name="hint"
          defaultValue={value("hint")}
          maxLength={140}
          aria-invalid={hasHintError}
          aria-describedby={hasHintError ? "hint-error" : undefined}
        />
        {hasHintError && (
          <p id="hint-error" role="alert" className="text-sm text-red-600">
            {state.fieldErrors?.hint?.join(" ")}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked /> Publish now
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <ActionSubmit idle="Add puzzle" pending="Saving…" />
    </form>
  );
}
