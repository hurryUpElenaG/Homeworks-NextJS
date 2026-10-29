# Verify GitHub OAuth App for the Next.js Word Game

This guide explains how to check the GitHub OAuth settings used by a local Next.js project with Better Auth.

## 1. Open GitHub Developer Settings

1. Open https://github.com/settings/developers
2. Sign in to your GitHub account if asked.
3. Select **OAuth Apps** in the left menu.
4. Click your existing **Word Game** OAuth App.

If you do not have an OAuth App yet, select **New OAuth App** and follow the fields in section 3.

## 2. Check the existing OAuth App

Compare the values on the app's settings page with these expected local-development values:

- **Application name:** `Word Game` (the name can be different; it is only a label).
- **Homepage URL:** `http://localhost:3000`
- **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`

The callback URL must match the callback route used by your Better Auth setup. The URL above is the standard GitHub callback for Better Auth's default provider configuration. If your project configures a custom base path or callback route, use the route configured by your project instead.

## 3. Create an OAuth App if needed

On https://github.com/settings/developers:

1. Open **OAuth Apps**.
2. Click **New OAuth App**.
3. Enter:
   - **Application name:** `Word Game`
   - **Homepage URL:** `http://localhost:3000`
   - **Application description:** `Word Game homework project` (optional)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Click **Register application**.

## 4. Find the Client ID and Client Secret

On the OAuth App settings page:

- Copy **Client ID** into `GITHUB_CLIENT_ID` in your local `.env` file.
- Under **Client secrets**, generate a new client secret if you do not already have one available.
- Copy the secret into `GITHUB_CLIENT_SECRET` immediately. GitHub may not show the full secret again later.

Do not share your Client Secret, Better Auth secret, or screenshots that expose them. Never commit `.env` to a public repository.

## 5. Configure the `.env` file

In the project root (the same folder as `package.json`), create or update `.env`:

```dotenv
BETTER_AUTH_SECRET=replace_with_your_generated_secret
BETTER_AUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=replace_with_your_github_client_id
GITHUB_CLIENT_SECRET=replace_with_your_github_client_secret
ADMIN_EMAIL=your_admin_email@example.com
```

Replace every placeholder with your own value.

### Generate BETTER_AUTH_SECRET

Run this in the terminal from your project folder:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the generated output into `BETTER_AUTH_SECRET`.

### Set ADMIN_EMAIL

Use the email address that your application's admin logic checks. This is not a value supplied by GitHub. Your application code must explicitly use this variable to grant or recognize administrator access.

## 6. Check that `.env` is not committed

Make sure `.env` is listed in `.gitignore`. Do not paste secrets into chat, screenshots, GitHub issues, or source code.

## 7. Restart and test locally

1. Save `.env`.
2. Stop the running development server with `Ctrl+C`.
3. Start it again:

```powershell
npm run dev
```

4. Open http://localhost:3000.
5. Try **Sign in with GitHub**.

If sign-in fails, check that:
- `BETTER_AUTH_URL` is exactly `http://localhost:3000` for local development.
- The GitHub callback URL exactly matches the callback route used by your Better Auth configuration.
- The Client ID and Client Secret belong to the same OAuth App.
- The `.env` file is in the project root and the server was restarted after editing it.
- Your GitHub OAuth provider configuration reads `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, or the equivalent variable names used by your code.

## Official references

- GitHub Developer Settings: https://github.com/settings/developers
- GitHub: Creating an OAuth App: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
- Better Auth: GitHub provider: https://www.better-auth.com/docs/authentication/github

## If you want someone to check your settings

You can share a screenshot showing the Homepage URL and Authorization callback URL, but hide the Client Secret and any other credentials. For Client ID checks, compare it locally with the value in `.env`; do not share secrets publicly.
