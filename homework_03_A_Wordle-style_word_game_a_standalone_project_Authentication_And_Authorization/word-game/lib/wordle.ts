export type LetterResult = "correct" | "present" | "absent";

/**
 * Score a five-letter guess. Exact matches are consumed first, then remaining
 * letters can match only one occurrence in the answer.
 */
export function checkGuess(answer: string, guess: string): LetterResult[] {
  const normalizedAnswer = answer.toLowerCase();
  const normalizedGuess = guess.toLowerCase();
  const result: LetterResult[] = Array(5).fill("absent");
  const remaining = normalizedAnswer.split("");

  for (let i = 0; i < 5; i += 1) {
    if (normalizedGuess[i] === normalizedAnswer[i]) {
      result[i] = "correct";
      remaining[i] = "";
    }
  }

  for (let i = 0; i < 5; i += 1) {
    if (result[i] === "correct") continue;
    const matchingIndex = remaining.indexOf(normalizedGuess[i]);
    if (matchingIndex !== -1) {
      result[i] = "present";
      remaining[matchingIndex] = "";
    }
  }

  return result;
}
