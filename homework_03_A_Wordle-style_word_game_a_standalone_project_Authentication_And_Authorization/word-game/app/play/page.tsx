import { notFound, redirect } from "next/navigation";
import { puzzleIdSchema } from "@/lib/validation";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ puzzleId?: string }>;
}) {
  const params = await searchParams;
  const parsed = puzzleIdSchema.safeParse(params.puzzleId ?? "");

  if (!parsed.success) {
    notFound();
  }

  // This GET page does not create a game. It only opens the puzzle page.
  redirect(`/puzzle/${parsed.data}`);
}
