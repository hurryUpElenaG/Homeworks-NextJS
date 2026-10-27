# 🎲 Homework 3 — Word Game, part 3: authentication and authorization

> In [homework 2](./hmw_2.md) the game moved to the server, but it still trusts everybody: anyone can open the admin area, anyone can post a score under any nickname, and anyone with a game's link can play it. Now you give the app **accounts** (who are you?) and **permissions** (what may you do?).

**Estimated time:** 8–10 hours · **Deadline:** none, but the sooner you start, the better · **Uses:** everything from classes 1–7, especially authentication and authorization (class 7)

Same kind of homework as the first two. It describes **what** the app must do. **How** you build it is up to you: the data model, the file structure, the components and the guards are your decisions. The one fixed choice is the tool: use **Better Auth**, as in class 7. Look back at the [class 07 README](../class_07_auth/README.md) for how it works.

---

## 🧱 Starting point

You continue with **your project from homework 2**. It has to work first: games on the server, the leaderboards, the admin area with its forms.

---

## 📖 The story

Look at what homework 2 left open:

- the **admin area** is open to anyone who knows its address,
- the **leaderboard nickname** can be anything, so anyone can post as anyone,
- a **game** belongs to whoever has the link.

This homework closes all three. By the end, every action in your app has an **owner** and a **rule** about who may do it, and the rule is enforced **on the server**, not just on the screen.

---

## 📋 Business requirements

### 1. Accounts

- A visitor can **create an account** with a **name, an email and a password** (at least 8 characters), and can **sign in** and **sign out**.
- A visitor can also **continue with GitHub**, using **your own GitHub OAuth app**. If the GitHub values aren't configured, the button simply doesn't appear and the rest of the app works.
- Errors are **clear and kind**, and they never help an attacker. A failed sign-in says the same thing whether the email exists or not ("Invalid email or password").
- A signed-in user **stays signed in** after a reload. After **signing out**, nothing protected can be opened anymore.
- The **header** always shows the state: a **Sign in** link, or the user's **name** and a **Sign out** button.
- **Passwords are never stored in plain text**, and no secret ends up in the repository.

### 2. Coming back to where you were

- If a visitor tries something that needs an account (pressing **Play**, opening a game, opening the admin area), they're **sent to sign in**, and **after signing in they land exactly where they were going**.
- Coming back must **only ever lead to a page on your own site**. A return address that points to another site (including the tricky variants that browsers also treat as another site) must send the user to the home page instead.

### 3. Who may do what

There are three kinds of users: a **visitor** (not signed in), a **player** and an **admin**. This table is the rulebook:

| What                                                         | Visitor                    | Player                   | Admin                    |
| ------------------------------------------------------------ | -------------------------- | ------------------------ | ------------------------ |
| Browse puzzles, leaderboards, the Hall of Fame               | ✅                         | ✅                       | ✅                       |
| **Start a game** and **make guesses**                        | ❌ asked to sign in        | ✅                       | ✅                       |
| **Open or continue a game**                                  | ❌                         | ✅ **only their own**    | ✅ **only their own**    |
| **Save a score** for a finished game                         | ❌                         | ✅ **only their own, once** | ✅ **only their own, once** |
| See **My games**                                             | ❌                         | ✅ their own             | ✅ their own             |
| **Admin area**: puzzles with their words, add, publish, unpublish | ❌                    | ❌                       | ✅                       |
| **Users page**: see accounts, promote or demote              | ❌                         | ❌                       | ✅                       |

The rules behind the table:

- **New accounts are players.** Nobody can become an admin from the sign-up form, or by sending extra data with the request.
- A fresh install has **at least one admin**. Your README says exactly how (for example the seed creates one from an email you configure, or a step you run once).
- On the **Users page** an admin sees every account with its role, and can **make a player an admin, or an admin a player**. An admin **cannot take away their own admin role**, so the app is never left without admins.
- A visitor who isn't allowed is **sent to sign in**. A signed-in user who isn't allowed sees a **clear "not allowed" page**. These are different situations, so they get different answers.
- **Somebody else's game looks exactly like a game that doesn't exist** ("not found"). The app must not confirm that it's there.
- The **leaderboards show the player's account name**. The nickname form from homework 2 goes away: nobody can post a score under another person's name.
- **The rules hold everywhere, not only on the screen.** Hiding a button or a link is a courtesy, not protection. Opening the page by typing its address, or sending the request by hand (for example from the developer tools), as a visitor or as another user, must be **refused**: for pages, for actions, and for the data they read and change.
- **A fake cookie gets nobody in.** Creating a session cookie by hand in the browser must not open any protected page.
- The user's **role** and the **owner** of a game or a score come from the **server's knowledge of who is signed in**, never from anything the browser sends.

### 4. My games

- A signed-in user has a **My games** page: their games, **newest first**, each with the puzzle number, the state (in progress, won, lost), the attempts used, and a link to continue or look at it. **Only their own.**
- At the top it shows how many games they **played** and **won**.

### 5. Existing data

Games and scores from homework 2 have no owner. Choose what to do with them (remove them cleanly, or give them a clear treatment), and **say what you chose in your README**. The app must **work after the change on a database that already has data**, without crashing.

### 6. Form quality (sign-up and sign-in too)

The rules of homework 2 apply to the new forms:

- Problems appear **next to the field** (or as one clear message) in plain language.
- What the user typed is **kept** after an error (the password is the one exception).
- The button shows a **pending state** and can't be double-clicked.
- Every control has a **label**, the password is **masked**, and everything works with the **keyboard**.
- Passwords and tokens are **never** printed in logs, shown in the URL, or sent anywhere they don't belong.

### 7. Quality

- `npm run lint` and `npm run build` **pass** with no errors.
- **Homework 1 and 2 still work**, now for signed-in players. (Playing needs an account, and that's the new rule.)
- No leftover debug output (`console.log`), and no unused code or leftover "pretend user" code.
- **No secrets are committed.** `.env` is not in the repository, and `.env.example` lists every variable (with empty values). If you ever commit a secret by accident, **create a new one**: deleting it from the repository doesn't make it safe again.
- Your README's **"How to run the game"** is updated: the new variables, **how to create the GitHub OAuth app** (with the callback address), the new migration(s), and how to get the first admin. Someone with a fresh database can still get everything running from your repository alone.
- Your **git history** tells a story: small commits with meaningful messages (at least 8 for this homework).
- You can **explain every line** you hand in, including parts an AI assistant helped with.

---

## ✅ Check it yourself

Before you submit, go through this list and fix whatever doesn't behave as shown. It's also what a reviewer will do.

| #  | Do this                                                                                      | You should see                                                                           |
| -- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1  | Browse the puzzle list and a leaderboard while signed out                                    | Works, no sign-in needed                                                                 |
| 2  | Signed out, press **Play**                                                                   | The sign-in page; after signing in you land where you were going                         |
| 3  | Sign up with a 7-character password, then with 8                                             | A clear message, then success (and you're signed in)                                     |
| 4  | Sign out, then sign in with a wrong password, and with an email that doesn't exist           | The **same** message both times                                                          |
| 5  | Use **Continue with GitHub**. Then remove the GitHub values and restart                      | It works; then the button is gone and the app still runs                                 |
| 6  | Reload while signed in; sign out in one tab and refresh another                              | Still signed in after reload; the other tab is signed out                                |
| 7  | Open the sign-in page with a return address of `https://example.com`, `//example.com`, and `/\example.com`, and sign in | You always land on **your own** home page                       |
| 8  | Sign out. In the developer tools create a cookie with the session cookie's name and any value. Open the admin area | You are **not** let in                                       |
| 9  | As a player open the admin area; as a visitor open it                                        | "Not allowed" page; the sign-in page                                                     |
| 10 | As a player, re-send an admin request by hand (add puzzle, publish)                          | **Refused**, nothing changes                                                             |
| 11 | As player A open player B's game address                                                     | "Not found", the same as an address that doesn't exist                                   |
| 12 | As player A re-send a guess for player B's game                                              | **Refused**                                                                              |
| 13 | Save a score; try to re-send the request with a different name                               | The leaderboard shows **your account name**                                              |
| 14 | Open **My games** with two accounts                                                          | Each sees **only their own** games                                                       |
| 15 | As an admin, promote a player; then try to remove **your own** admin role                    | The player gets the admin area on their next page load; your own demotion is **refused** |
| 16 | Sign up while adding an extra `role=admin` to the request                                    | The new account is still a **player**                                                    |
| 17 | In the developer tools look at the session cookie, and type `document.cookie` in the console | The cookie is marked **HttpOnly**, and the console can't read it                         |
| 18 | Look in the database at the passwords                                                        | Only **hashes**, never a readable password                                               |
| 19 | Start the app on a database that still has homework 2 data                                   | It works, as your README describes                                                       |

---

## 🤔 Reflection (short answers)

Create a file `HOMEWORK_3.md` in the root of your repo and answer these in **2–4 sentences each**, in your own words:

1. Explain **authentication** and **authorization** with an example of each from **your own app**.
2. Where do your checks live (the screen, a proxy, the pages, the actions, the queries)? Why do you need **more than one** layer? What would go wrong with **only** a proxy that looks at the cookie?
3. You created a fake cookie in check 8. What happened, and **why**?
4. For someone else's game you chose between "not signed in", "not allowed" and "not found". What did you choose, and **why** is that the right answer?
5. How did you stop the **return address** from taking people to another site? Which addresses did you test?
6. Where does the **owner** of a game or a score come from in your code, and why must it **never** come from the request?
7. What does your database store about passwords and sessions? What happens when a session expires, or when a user signs out?
8. What would you change to add a new role, such as **moderator**?
9. What was the hardest part? What would you do differently if you started again?

---

## 📬 How to submit

1. Push your work to your GitHub repository.
2. Email the **link to the repository** to **[ivo@kostovski.dev](mailto:ivo@kostovski.dev)** and write in the message that homework 3 is **done**. If the repository is private and you already invited me before, there's nothing more to do. Otherwise invite me as a collaborator (*Settings → Collaborators → Add people*) using the email **ivo.kostovski@gmail.com**.
3. Make sure `HOMEWORK_3.md` (the reflection) and the updated "How to run the game" section are in the repo. **Double-check that your `.env` is not.**

---

## 🚀 Stretch goals (optional, for fun)

Pick any, or invent your own:

- ✉️ **Email verification:** a new account must confirm its email before it can play.
- 🔑 **Password reset** ("I forgot my password"). It needs to send an email, so decide how.
- 🛡️ **Slow down guessing:** limit how many failed sign-ins one visitor can make in a minute.
- 🚫 **Ban a user** from the Users page, with a reason. A banned user can't sign in.
- 💻 A **"my sessions"** page: see where you're signed in and **sign out the other devices**.
- 🧑‍💻 A **profile page**: change your name, and **delete your account** (what should happen to your games and scores?).
- 🔐 **Two-factor** sign-in, or a **passkey**.
- 🖼️ Show the **GitHub avatar** next to the name.
- 📜 An **audit log**: who promoted whom, and when.
- 👤 Let **visitors play without an account**, and keep their games when they sign up later.
- ➕ Anything else that makes the app safer.

---

## 📚 Where to look when you're stuck

- The **[class 07 README](../class_07_auth/README.md)**: Part 1 explains the ideas (sessions, cookies, OAuth, roles, the four layers of checks), Part 2 shows **how to get the GitHub credentials**, Part 3 follows the Better Auth setup step by step, and Part 4 is about **ownership**. Its code (`db/auth.ts`, `lib/session.ts`, `proxy.ts`) is annotated.
- The **[class 06 README](../class_06_forms/README.md)** has the security checklist for Server Actions: it still applies, now with a real user behind it.
- The official docs: [Better Auth](https://www.better-auth.com/docs/installation), [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) and [Data security](https://nextjs.org/docs/app/guides/data-security), [creating a GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), and OWASP's [broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) and [authentication cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- A hint for the "someone else's game" requirements: ask yourself, for **every** query and every action, "**whose** data is this, and where do I check it?" The check that protects the data is the one **next to the data**.
- Stuck for a long time? **Ask early**, in class or by email, and say what you tried.

> 🤖 **About AI:** you're welcome to use it, as stated in the rules. A good use is asking it to *explain* an error or a concept. A bad use is pasting the whole task and handing in the answer. You'll be asked to explain your code, and the reflection questions are there to check that you can.
