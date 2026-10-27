import assert from "node:assert/strict";
import { checkGuess, type LetterResult } from "../lib/wordle";

const cases: Array<{
  answer: string;
  guess: string;
  expected: LetterResult[];
}> = [
  {
    answer: "crane",
    guess: "crane",
    expected: ["correct", "correct", "correct", "correct", "correct"],
  },
  {
    answer: "alloy",
    guess: "llama",
    expected: ["present", "correct", "present", "absent", "absent"],
  },
  {
    answer: "speed",
    guess: "erase",
    expected: ["present", "absent", "absent", "present", "present"],
  },
  {
    answer: "apple",
    guess: "eagle",
    expected: ["absent", "present", "absent", "correct", "correct"],
  },
];

for (const testCase of cases) {
  assert.deepEqual(
    checkGuess(testCase.answer, testCase.guess),
    testCase.expected,
  );
  process.stdout.write(`PASS ${testCase.answer} / ${testCase.guess}\n`);
}
process.stdout.write("All Wordle colour tests passed.\n");
