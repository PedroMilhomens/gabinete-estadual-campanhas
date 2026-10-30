# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Development authentication setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, and the public `VITE_TURNSTILE_SITE_KEY`.
   Never use a `service_role` key in this frontend.
2. Apply the Supabase migrations. Configure email/password authentication and
   require email confirmation in Supabase Auth.
3. Configure Turnstile in Supabase Auth with the matching site key and its
   secret in the Supabase dashboard. The secret must not use a `VITE_` variable
   or be stored in this repository. Login and signup remain disabled until a
   valid Turnstile token is available.
4. Configure Supabase Auth SMTP before production use; the built-in mailer is
   rate-limited. Set the password minimum to 10 characters.
5. Deploy the notification Edge Functions:

   ```sh
   supabase functions deploy notify-new-signup
   supabase functions deploy notify-user-decision
   supabase functions deploy lgpd-user-data
   ```

   Configure the following Edge Function secrets outside the repository:
   `DATABASE_WEBHOOK_SECRET` (a long random value), `RESEND_API_KEY`, and
   `EMAIL_FROM` (a sender address verified with Resend). Supabase supplies
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge
   Functions; never add the service-role key to client environment variables or
   commit it. Set the three secrets with `supabase secrets set` or in the
   Supabase Dashboard under Project Settings > Edge Functions > Secrets.
6. In the Supabase Dashboard, create two Database Webhooks for `public.profiles`:
   one for `INSERT` calling
   `https://<project-ref>.supabase.co/functions/v1/notify-new-signup`, and one
   for `UPDATE` calling
   `https://<project-ref>.supabase.co/functions/v1/notify-user-decision`.
   Add `Content-Type: application/json` and
   `x-webhook-secret: <DATABASE_WEBHOOK_SECRET>` to both. The decision function
   sends mail only when `status` changes to `approved` or `rejected`; other
   profile updates are ignored. These two webhook endpoints disable gateway
   JWT checks because Database Webhooks authenticate using the shared secret
   header. The LGPD function also validates the caller's JWT itself and checks
   the approved admin role before processing data.

Run the app with `npm run dev`. The signup screen looks up chapters using the
restricted `signup_chapters` database function, so chapter records must be
created before a user can register. New accounts require email confirmation and
remain blocked from application data until approved.

Available checks: `npm run build`, `npm run lint`, and `npm test`.
Run `npm audit` regularly; Dependabot is configured for weekly npm and GitHub
Actions updates.

Approved members can save activity drafts, attach up to five JPEG, PNG, or PDF
files (maximum 5 MB each), submit or resubmit work, and view their submission
status and review comments. Attachments are stored in the private Supabase
`attachments` bucket; the app generates signed preview links that expire after
five minutes.

Approved reviewers and admins can filter submitted work by chapter, campaign,
activity, and status; record a score within the activity limit with an approval
or return comment; view chapter rankings; and export submitted work as CSV.
Review decisions and their comments are written together through a database
function. Members see rankings only for data permitted by their chapter access.
The public `/privacy` and `/terms` pages describe data handling and use.
Approved admins can export an account's profile, auth email, submissions,
comments, audit entries, and attachment metadata with five-minute signed
download links, or permanently delete the account and its associated data from
the user-management screen. The LGPD function verifies the caller's JWT and
approved admin role before processing either action.

Static response headers are configured in `public/_headers` for Netlify and
Cloudflare Pages. Backup, restore, audit-log operation, and incident-response
procedures are documented in [docs/OPERATIONS.md](./docs/OPERATIONS.md).

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
