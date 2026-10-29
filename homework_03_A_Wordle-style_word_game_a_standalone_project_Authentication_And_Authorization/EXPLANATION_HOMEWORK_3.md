# Word Game Homework 3 — file-by-file explanation

This guide describes the authentication and authorization process. The app uses the Next.js App Router, TypeScript, PostgreSQL, Drizzle ORM, Zod, Tailwind CSS and the existing small shadcn/ui-style components.

## 1. Authentication database files

### 1.1 `db/auth-schema.ts`
This file declares the four tables Better Auth needs:

- `user`: one row per account. `role` is `player` by default; it is not accepted from sign-up form data.
- `session`: one row per signed-in browser/device. It contains a random session token and an expiry date. The browser receives the token in a protected cookie, while the database row lets the server check whether it is real and still valid.
- `account`: the login method attached to a user. For email/password login, `password` stores a hash, not the original password. GitHub OAuth accounts can store provider tokens here, so this table must never be exposed to the browser.
- `verification`: table Better Auth can use for short-lived verification/reset codes.

The foreign keys from `session` and `account` to `user` use `ON DELETE CASCADE`, so removing a user also removes their sessions and login accounts.

### 1.2 `db/auth.ts`
This is the server-only Better Auth configuration. `drizzleAdapter` connects Better Auth to the Drizzle database client. `emailAndPassword` enables password authentication and sets the minimum password length to eight characters. GitHub is added only when both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` exist; otherwise the app works without that button.

The `role` additional field has `input: false`. This is important: the client cannot choose its role when signing up. The database default is `player`, and the only code that changes roles is the protected admin action. `nextCookies()` integrates Better Auth with Next.js Server Actions.

### 1.3 `app/api/auth/[...all]/route.ts`
Better Auth owns its API endpoints under `/api/auth/*`. `toNextJsHandler(auth)` exposes its GET and POST handlers. The GitHub OAuth callback is `/api/auth/callback/github`; that exact URL must be entered in the GitHub OAuth app settings.

### 1.4 `lib/auth-client.ts`
This is the browser-safe Better Auth client. Client Components import `signIn`, `signUp`, `signOut`, and other client methods from here. It does not contain the server secret or a database connection.

### 1.5 `lib/session.ts`
This is the server-side source of truth for identity and authorization:

- `getCurrentUser()` reads request headers and asks Better Auth to validate the session against the server-side session store. It returns the user or `null`.
- `requireUser(returnTo)` redirects visitors to sign in and encodes the requested local destination.
- `requireAdmin(returnTo)` first requires a valid signed-in user, then checks the database-backed role. A player is redirected to `/not-allowed`.

These helpers are used by protected pages and Server Actions, not only by navigation links.

### 1.6 `lib/safe-next.ts`
The `next` URL parameter is user input. `safeNext()` only accepts a same-site relative path. It rejects absolute URLs, paths beginning with `//`, backslashes and line breaks. Invalid values become `/`. This prevents an open-redirect bug in which a trusted sign-in page could send the user to an attacker's website after login.

### 1.7 `proxy.ts`
The proxy performs an inexpensive first check for protected routes. It checks whether the expected session cookie exists and redirects visitors to sign in. A cookie's existence does **not** prove it is valid; therefore the protected page/action still calls `requireUser` or `requireAdmin`, which asks Better Auth to validate the session. A forged cookie cannot pass that real check.

## 2. Forms and account UI

### 2.1 `app/sign-in/page.tsx` and `app/sign-up/page.tsx`
These are Server Components. They read `searchParams`, sanitize `next` with `safeNext`, and check whether GitHub is configured. Only the boolean `githubEnabled` reaches the browser; OAuth secrets never do.

### 2.2 `components/auth-form.tsx`
This Client Component contains labelled name, email and password fields. It uses `signUp.email()` for registration and `signIn.email()` for login. It disables the submit button while a request is pending, clears the password after an attempt, and keeps the other fields in state when an error occurs. Sign-in failures use the same “Invalid email or password” message whether the email does not exist or the password is wrong.

When GitHub is configured, its button starts Better Auth's OAuth flow. The app does not collect or handle the GitHub password itself.

### 2.3 `components/sign-out-button.tsx`
The button calls Better Auth's sign-out endpoint, then refreshes the router. Better Auth revokes the server-side session and clears the browser cookie, so another tab cannot keep using the old session.

### 2.4 `components/header.tsx`
The header is a Server Component and asks `getCurrentUser()` for the current account. Visitors see Sign in. Signed-in users see their name and Sign out. My games is shown for signed-in users; Admin and Users links are shown only to admins. These link conditions improve the UI, but are not the security checks.

### 2.5 `app/not-allowed/page.tsx`
This page gives a signed-in user a clear answer when their role is insufficient. This is different from a visitor, who is redirected to sign in.

## 3. Ownership and game actions

### 3.1 `db/schema.ts`
The existing `games` and `scores` tables now have an `ownerId` column that references `user.id`. A game and its score are tied to an actual account. The existing `nickname` score column remains for compatibility with the Homework 2 table shape, but new scores fill it using the authenticated user's account name; the browser no longer sends a nickname.

### 3.2 `app/actions/game.ts`
Every action checks identity on the server:

- `startGame()` checks the requested puzzle is published, then inserts the new game with `ownerId` from the verified session. If the visitor is signed out, the sign-in destination is `/play?puzzleId=...`, so after login the app can create the intended game.
- `submitGuess()` validates the game ID and guess, then queries by **both** game ID and the current user's ID. It uses a transaction and row lock to avoid two simultaneous guesses overwriting one another. A game that belongs to someone else returns “Game not found.”
- `saveScore()` also queries by game ID and owner ID. It only accepts a won game and uses the unique game constraint to stop a second score being saved. It derives `ownerId` and the score name from the session, not from form data.

Server Actions are endpoints that can be called directly, so each action performs its own checks even if the page already checked access.

### 3.3 `app/play/page.tsx`
This route is the safe return destination for a Play button clicked while signed out. After sign-in, it validates the puzzle ID, checks that the puzzle is published, creates an owned game, and redirects to that game.

### 3.4 `app/game/[id]/page.tsx`
The page requires a real user session and looks up the game using both its ID and `ownerId`. If the game is missing or belongs to another player, `notFound()` renders the same not-found result. This avoids revealing whether another player's game ID exists.

### 3.5 `components/save-score-form.tsx`
The nickname input was removed. The form tells the user that the score is saved under their account name and submits no owner or nickname fields.

### 3.6 `app/my-games/page.tsx`
This page requires a signed-in user, loads only rows belonging to that user, and displays newest games first. It shows the total number played and won, the puzzle number, status, attempts, date and a link to continue or review a game.

### 3.7 `db/queries.ts`
Public puzzle lists and leaderboards remain readable without an account. Leaderboards join scores to the account table and display the account name. The `getMyGames()` and `getMyGameStats()` functions always filter by `ownerId`; the admin user list is separate and is only called after the page's admin guard.

## 4. Admin authorization

### 4.1 `app/admin/page.tsx`
The page calls `requireAdmin()` before reading admin puzzle data. Typing `/admin` into the address bar as a visitor or player does not grant access.

### 4.2 `app/actions/admin.ts`
Both `addPuzzle()` and `togglePublished()` call `requireAdmin()` before touching the database. This prevents a player from invoking the Server Action manually even if they bypass the UI.

### 4.3 `app/actions/users.ts`
`toggleUserRole()` verifies the current user is an admin, validates the target, refuses to change the current admin's own role, and switches the target between `player` and `admin`. The role is never taken from a submitted role field; the server decides the new value based on the existing database role.

### 4.4 `app/users/page.tsx`
The Users page requires an admin session before reading accounts. It displays account names, email addresses and roles and gives admins a control to promote/demote other accounts. The current admin's own row cannot be changed.

### 4.5 `scripts/make-admin.ts`
The first admin must be bootstrapped outside public sign-up. This script reads `ADMIN_EMAIL`, finds an account that already exists, and changes its role to `admin`. It refuses to proceed if the account has not signed up yet. No public request can use this script.

## 5. Database migration and setup

### 5.1 `drizzle/0003_auth_ownership.sql`
The migration creates Better Auth's tables, removes Homework 2 games and scores because those rows had no trustworthy owner, and adds non-null owner columns and foreign keys. It deliberately keeps the puzzles. This is a clear migration policy: old unowned game history is removed rather than falsely assigning it to a new account.

### 5.2 `drizzle.config.ts`
The Drizzle Kit configuration now includes both the game schema and the Better Auth schema, so future schema comparisons can see the authentication tables.

### 5.3 `.env.example`
This is the committed template listing every environment variable. Copy it to `.env`, then fill in the database URL and Better Auth secret. GitHub OAuth values are optional. `.env` is ignored by Git and must not be committed.

### 5.4 `README.md`
The README documents local setup, migration order, GitHub OAuth app setup, the callback URL, and how to promote the first admin account.

## 6. Important testing notes

1. Test as a visitor, a player and an admin.
2. Try to open `/admin`, `/users`, `/my-games` and another player's `/game/:id` by typing the address directly.
3. Re-send game/admin actions from the browser's developer tools. The server-side guard must still refuse them.
4. Test invalid return destinations: `https://example.com`, `//example.com`, and `/\example.com`.
5. Confirm the browser's session cookie is HttpOnly and the `account.password` database value is a hash.
6. Run `npm run lint` and `npm run build` after installing dependencies and configuring `.env`. This generated patch has not been built against your live PostgreSQL database in this environment, so verify migration and Better Auth package compatibility locally before submitting.
