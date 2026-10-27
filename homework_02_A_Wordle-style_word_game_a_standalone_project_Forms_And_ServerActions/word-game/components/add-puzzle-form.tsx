"use client";
import { useActionState } from "react";
import { addPuzzle } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/game";
import { ActionSubmit } from "@/components/action-submit";
import { Input } from "@/components/ui/input";

export function AddPuzzleForm() {
    
  const [state, formAction] = useActionState<ActionState, FormData>(addPuzzle,{});
  const value = (name: string) => state.values?.[name] ?? "";

    return (
      
    <form action={formAction} className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-bold">Add puzzle</h2>
      <div>
        <label htmlFor="word" className="mb-1 block text-sm font-medium">
          Word
        </label>
        <Input
          key={value("word")}
          id="word"
          name="word"
          defaultValue={value("word")}
          maxLength={5}
          aria-describedby="word-error"
          aria-invalid={!!state.fieldErrors?.word}
        />
        {state.fieldErrors?.word?.map((e) => (
          <p
            id="word-error"
            key={e}
            role="alert"
            className="text-sm text-red-600"
          >
            {e}
          </p>
        ))}
      </div>
      <div>
        <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">
          Difficulty
        </label>
        <select
          key={value("difficulty") || "medium"}
          id="difficulty"
          name="difficulty"
          defaultValue={value("difficulty") || "medium"}
          className="bg-background h-10 w-full rounded-md border px-3"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        {state.fieldErrors?.difficulty?.map((e) => (
          <p key={e} role="alert" className="text-sm text-red-600">
            {e}
          </p>
        ))}
      </div>
      <div>
        <label htmlFor="hint" className="mb-1 block text-sm font-medium">
          Hint (optional)
        </label>
        <Input
          key={value("hint")}
          id="hint"
          name="hint"
          defaultValue={value("hint")}
          maxLength={140}
          aria-describedby="hint-error"
        />
        {state.fieldErrors?.hint?.map((e) => (
          <p
            id="hint-error"
            key={e}
            role="alert"
            className="text-sm text-red-600"
          >
            {e}
          </p>
        ))}
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
