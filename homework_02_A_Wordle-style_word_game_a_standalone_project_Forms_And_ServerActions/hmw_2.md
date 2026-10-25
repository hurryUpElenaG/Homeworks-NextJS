# 🎲 Homework 2 — Word Game, part 2: forms and Server Actions

> In [homework 1](./hmw_1.md) you built a word game that anyone can cheat at: the secret word travels to the browser, and nothing is saved. Now you turn it into a **real app**: games live on the server, players post scores, and an admin manages the puzzles, all through **forms**.

**Estimated time:** 8–10 hours · **Deadline:** none, but the sooner you start, the better · **Uses:** everything from classes 1–6, especially forms and Server Actions (class 6)

This is the same kind of homework as the first one. It describes **what** the app must do. **How** you build it is up to you: the data model, the file structure, the components, the hooks and the libraries are your decisions. Look back at the class READMEs (especially the [class 06 README](../class_06_forms/README.md)) for the tools.

---

## 🧱 Starting point

You continue with **your project from homework 1**. It has to work first: puzzles in the database, the 6 × 5 board, the validation, the colours.

---

## 📖 The story

When you answered the reflection question of homework 1 ("can you find the answer without playing?"), you found a hole. This homework **closes it**, and makes the game something people could actually play together:

- the **server** runs the game (so the answer is never sent to the browser),
- finished games can be **saved to a leaderboard**,
- and an **admin** can add and publish puzzles without touching the code.

---

## 📋 Business requirements

### 1. Playing on the server (no cheating)

- On a puzzle, a **Play** button **starts a new game** and opens it at **its own address**, so it can be bookmarked and shared (the exact address is up to you).
- Each game **remembers its guesses on the server**. Reload the page, or open the game's address later (another tab, a private window), and you see **the same board with the same colours**.
- Submitting a guess is a **form** that is **handled by the server**. The server decides whether the guess is valid, whether the game is still running, which colours each letter gets, and it saves the guess.
- The **secret word is never sent to the browser while the game is running**: not in the page, not in the page source, not in any data or response. It may be shown only when the player has **lost** (and a player who won already knows it).
- **Tampering doesn't help.** Re-sending a request by hand (for example from the browser's developer tools) cannot give a player a 7th attempt, or let them keep playing after winning or losing.
- A guess that **isn't valid** (not 5 letters, digits, symbols, empty) shows a **clear message next to the input** and **doesn't use up an attempt**. Capital letters are fine: `CRANE` and `crane` are the same guess. **What the player typed stays in the field** after an error.
- While a guess is being processed, the button is **disabled and shows that it's working**. A double click uses **one** attempt, not two.

### 2. Saving the score

- When a game is over, the player can **save the result** to the leaderboard with a **nickname**: 2 to 20 characters after trimming spaces; letters, digits, spaces, hyphens and underscores only.
- A finished game can be saved **once**. A second try shows a **friendly message**, not a crash and not a duplicate. A game that isn't finished can't be saved.
- Each puzzle page shows its **leaderboard**: the **top 10 winners**, fewest attempts first, then the earliest. Each row shows nickname, attempts and date. Lost games aren't listed.
- A **Hall of Fame** page lists the **top 10 players overall**, by number of puzzles won. (Nicknames aren't accounts: two people can pick the same one, and that's fine for now.)
- After saving, the player sees the **updated leaderboard right away**, not an old version of the page.

### 3. Managing puzzles (admin)

- An **admin area**, at its own address, lists **all puzzles**, including unpublished ones: number, word (visible here), status, and how many games were played and won.
- An **Add puzzle** form with:
  - the **word** (5 letters, a–z; capital letters are lowercased automatically; it must **not already exist**),
  - a **difficulty** (easy, medium or hard),
  - an optional **hint** (up to 140 characters),
  - a **"publish now"** checkbox.

  The puzzle **number is assigned automatically** (the next free one). After saving, the admin lands on the puzzle list and sees the new puzzle.
- A puzzle can be **published and unpublished** with one button per row. An unpublished puzzle is **hidden from players**: it isn't in the list, and its address shows the "not found" page. Games that were already started can still be finished.
- Players see each puzzle's **difficulty** in the list.
- The admin area is **not protected** (there are no logins yet, that comes in a later class). Anyone who knows the address can use it. That's temporary: say so in your README.

### 4. Form quality (every form: guess, nickname, add puzzle, publish)

- **Validation happens on the server** for every form. A browser-only check is a convenience, never a protection.
- Errors appear **next to the field they belong to**, in plain language, **one message per problem**.
- **What the user typed is kept** after an error.
- Submit buttons show a **pending state** and **can't be clicked twice** by accident.
- Forms are **accessible**: every control has a label, errors are connected to their field for screen readers, and everything works with the keyboard alone (Enter submits).
- **No crashes.** If something unexpected goes wrong, the user sees a friendly message, never a stack trace or a blank page.
- **No half-saved data.** Things that belong together are saved together or not at all.
- **No duplicates**, even if two admins submit the same word at the same moment. The database itself must enforce it.

### 5. Quality

- `npm run lint` and `npm run build` **pass** with no errors.
- **Homework 1 still works**: the puzzle list, the board and the colour test cases from homework 1 are unchanged in behaviour.
- No leftover debug output (`console.log`), and no unused code.
- **No secrets are committed.** `.env` is not in the repository, and `.env.example` is.
- Your README's **"How to run the game"** is updated: the new migration(s), the seed, and how to open the admin area. Someone with a fresh database can still get everything running from your repository alone.
- Your **git history** tells a story: small commits with meaningful messages (at least 8 for this homework).
- You can **explain every line** you hand in, including parts an AI assistant helped with.

---

## ✅ Check it yourself

Before you submit, go through this list, and fix whatever doesn't behave as shown. It's also what a reviewer will do.

| # | Do this                                                                                   | You should see                                                                   |
| - | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1 | Start a game, make two guesses, reload                                                    | The same board, the same colours                                                 |
| 2 | Copy the game's address into a private window                                             | The same two guesses                                                             |
| 3 | While playing, view the page source and look at the Network tab. Search for the secret word | It's **nowhere**                                                              |
| 4 | Guess `abc`, `12345`, and an empty field                                                  | A message next to the input each time, and **no attempt used**                   |
| 5 | Guess `CRANE`, then `crane`                                                               | Treated as the same guess                                                        |
| 6 | After an error, look at the input                                                         | Your text is still there                                                         |
| 7 | Double-click the Guess button quickly                                                     | **One** attempt is used                                                          |
| 8 | Use all 6 attempts without winning                                                        | The game ends, the answer is shown, no more guesses                              |
| 9 | After the game is over, re-send a guess by hand (developer tools → resend the request)     | The server **refuses** it. No 7th attempt                                        |
| 10 | Win a game, then try to keep guessing the same way                                        | Refused                                                                          |
| 11 | Save a score twice for the same game                                                      | The second time, a friendly message, and only one row on the leaderboard         |
| 12 | Save a score with the nickname `a`, then with 30 characters, then with `<b>x</b>`          | A clear message each time                                                        |
| 13 | After saving, look at the puzzle's leaderboard                                            | Your result is there **without a manual refresh**                                |
| 14 | In admin, add a puzzle with a word that exists, with `abcd`, with `ABCDE`                 | A message, a message, and a saved puzzle with the lowercase word `abcde`         |
| 15 | Unpublish a puzzle                                                                        | Gone from the list, its address shows "not found"; a game already started can finish |
| 16 | Open the add-puzzle form, submit it empty                                                 | Every problem listed next to its own field                                       |
| 17 | Try the whole app with only the keyboard (Tab, Enter)                                     | Everything reachable and usable                                                  |

---

## 🤔 Reflection (short answers)

Create a file `HOMEWORK_2.md` in the root of your repo and answer these in **2–4 sentences each**, in your own words:

1. A Server Action can be called by **anyone**, not only through your form. For each of your actions, what could go wrong if someone called it directly with bad data, and what in your code stops it?
2. Which checks run in the **browser** and which on the **server**? Why do you still need the server ones if the browser already checks?
3. **How did you hide the secret word?** Describe where it is loaded and where it stops. What data does the browser receive when the game page loads?
4. After saving a score or adding a puzzle, what did you have to do to make the page show the new data? What did you see before you did it?
5. What stops one double click from using two attempts? And what happens if two requests for the same game arrive at the **same moment**?
6. What decisions did you make about nicknames and the unprotected admin area? What would you change once there are logins?
7. What was the hardest part? What would you do differently if you started again?

---

## 📬 How to submit

1. Push your work to your GitHub repository.
2. Email the **link to the repository** to **[ivo@kostovski.dev](mailto:ivo@kostovski.dev)** and write in the message that homework 2 is **done**. If the repository is private and you already invited me for homework 1, there's nothing more to do. Otherwise invite me as a collaborator (*Settings → Collaborators → Add people*) using the email **ivo.kostovski@gmail.com**.
3. Make sure `HOMEWORK_2.md` (the reflection) and the updated "How to run the game" section are in the repo.

---

## 🚀 Stretch goals (optional, for fun)

Pick any, or invent your own:

- 🌐 The guess form **works even without JavaScript** (try it with JavaScript disabled in the developer tools).
- ⚡ The guess appears on the board **instantly**, before the server answers (and rolls back if it's refused). Look up *optimistic updates*.
- ✏️ **Edit** a puzzle, or **delete** one with a confirmation step. What should happen to the games and scores of a deleted puzzle?
- 💡 A **"Show hint"** button that reveals the puzzle's hint.
- 📬 A public **"Suggest a word"** form. The admin gets a list of suggestions and can **approve** (it becomes a puzzle) or **reject** each one.
- ⏱️ A timer, and a leaderboard that also considers **time**.
- 🛡️ **Limit** how often one visitor can submit (to stop spam on the nickname form).
- 📊 A **statistics** page: win rate and average attempts per puzzle, and how often each difficulty is won.
- 📋 A **Share** button for finished games, like `Puzzle #7 4/6 🟩🟨⬜⬜🟩`.
- ➕ Anything else that makes the game better.

---

## 📚 Where to look when you're stuck

- The **[class 06 README](../class_06_forms/README.md)**, Part 1 especially: it follows one form submit from the click to the database, and ends with a security checklist for every Server Action and a list of gotchas. Reading the code of its example form (`app/actions/events.ts` and the `new/` folder) next to it helps a lot.
- The other class READMEs: [class 03](../class_03_db/README.md) (migrations), [class 04](../class_04_routing/README.md) (queries, validation, seeding).
- The official docs: [Next.js: Forms](https://nextjs.org/docs/app/guides/forms), [Server Actions](https://nextjs.org/docs/app/getting-started/mutating-data), [Data security](https://nextjs.org/docs/app/guides/data-security), React's [`useActionState`](https://react.dev/reference/react/useActionState) and [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus), [Zod](https://zod.dev/), [Drizzle](https://orm.drizzle.team/docs/overview).
- A hint for the double-submit and the "7th guess" requirements: think about **who decides** that a game is over, and **where that is recorded**. The browser's state can be bypassed, and the database can't be, if you use it well.
- Stuck for a long time? **Ask early**, in class or by email, and say what you tried.

> 🤖 **About AI:** you're welcome to use it, as stated in the rules. A good use is asking it to *explain* an error or a concept. A bad use is pasting the whole task and handing in the answer. You'll be asked to explain your code, and the reflection questions are there to check that you can.
