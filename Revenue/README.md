# Revenue Finance Desk

A shared college-project finance workspace built with React, Vite and Supabase. The team app lives in `app/`; the original standalone prototype and the supplied reference images are preserved alongside it.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
3. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project API settings. Use only the publishable/anon key in the browser; never use the service-role key.
4. In Supabase Auth, enable email sign-in. Set the local app URL (`http://localhost:5173`) as the Site URL and add local and production URLs to the redirect allowlist.
5. From this folder, start Vite with `node node_modules/vite/bin/vite.js app --host 0.0.0.0` and open the URL it prints.

The workspace path contains `&`, which can confuse Windows `npm run` scripts. Calling the local Vite/TypeScript entry points with Node directly avoids that shell issue.

## Deploy to Vercel

Import this folder as the project root. [`vercel.json`](vercel.json) runs the production typecheck/build and publishes `dist/`. Add the same two Supabase environment variables to Vercel, then deploy. Configure the deployed URL in Supabase Auth's Site URL and redirect allowlist.

## Shared access and security

- Passwordless email links authenticate users through Supabase Auth.
- The first signed-in user creates an organization. Members can create one-time invite links that expire after seven days; anyone holding a valid link can join after signing in.
- Organization membership controls access through Postgres row-level security. Project rows and invite hashes are not available to anonymous users.
- Workspace members can add, edit and delete projects and invite teammates. Share invite links only with trusted colleagues.
- Run the schema as a trusted Supabase administrator. Do not put a database password or service-role key in `.env.local` or client code.

Project records are stored in Supabase, not browser local storage. CSV export reflects the current project search results.