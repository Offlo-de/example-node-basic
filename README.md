# Offlo.de static + API demo

A minimal monorepo demonstrating Offlo.de serving static files and proxying an API
on the same origin. No dependencies or build step are required.

```text
apps/
  api/           Node.js API (npm workspace)
  web/           Static index.html
mise.toml        Node version, API port, and start task
offlo.toml       Slice configuration
package.json     Workspace configuration
```

## Configure in Offlo.de

Configure these routes for the slice identified by the root `offlo.toml`:

| Route | Type | Target |
| --- | --- | --- |
| `/api/` | Process | `mise run start`, port `3000`, working directory: repository root |
| `/` | Static files | `apps/web`, relative to the repository root |

Keep the `/api/` prefix when proxying to the API and give that route precedence
over the `/` static route. The API responds to `/api/` with `Hello from Offlo.de!`.
The page fetches `/api/` automatically and provides a button to call it again.

Open the slice's public URL to try the demo. Both routes use the same origin,
so no CORS configuration is needed. Static files are served directly by Offlo.de.

## Run the API locally

With [mise](https://mise.jdx.dev/getting-started.html) installed, run from the root:

```sh
mise trust
mise install
mise run start
```

Check the API at http://localhost:3000/api/. Stop with Ctrl+C.
No `npm install` is required. Edit `PORT` in `mise.toml` to change the API port
and update the Offlo.de process route to match.

The API process serves only the API. To exercise the HTML page and its relative
fetch together, use the Offlo.de routes above.
