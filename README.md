# Offlo.de web, worker, and cron example

Three separate processes demonstrate a request-processing flow:

1. The web process puts a "Hey, request arrived!" message in a Redis queue for
   each request (except the browser's favicon request).
2. The background worker consumes the queue, saves each request in PostgreSQL,
   and prints it.
3. A standalone cron command calculates counts for each UTC day and saves them
   in PostgreSQL. The web page displays those saved counts.

The worker has no built-in timer or cron scheduler.

## Run locally

Install mise and Docker with Compose, then run:

```sh
mise trust
mise install
mise exec -- npm ci
docker compose up -d --wait
mise run db:setup
mise run start
```

Start the worker in a second terminal:

```sh
mise run worker
```

Visit http://localhost:3000 a few times and watch the worker logs. After the
worker saves the requests, run the cron command manually in a third terminal:

```sh
mise run cleanup
# Equivalent when mise is activated in your shell:
npm run cleanup
```

Reload the page to see saved daily totals. Reloading queues another request;
that request appears in the total after the worker and summary command run.
The page shows an empty state until the first summary is saved.

Stop the web and worker processes with Ctrl+C, then use `docker compose down`
to stop the services. The local Compose data is disposable.

## Schedule the cron command

Configure your runtime's cron scheduler to run `npm run cleanup` daily with the
project directory as its working directory, the pinned Node version, and
`DATABASE_URL` in its environment. It runs once and exits; no worker needs to be
running for aggregation of requests already saved in PostgreSQL.

Example system crontab (replace both absolute paths; schedule follows the cron
host's timezone):

```cron
5 0 * * * cd /absolute/path/to/nodejs && /absolute/path/to/mise exec -- npm run cleanup >> /absolute/path/to/cleanup.log 2>&1
```

Counts use the original request arrival date in UTC. Each run recalculates all
days with requests, including today's partial count. Reruns update existing
totals, so late queue processing is included on the next run. Days without
requests have no row. Despite its example name, `cleanup` does not delete data.

## Configuration and files

`mise.toml` pins Node 24.16.0 and defines `PORT`, `DATABASE_URL`, and `REDIS_URL`.
The connection URLs accept environment overrides; the defaults match the local
demo services in `compose.yaml`. Use runtime secrets for deployed credentials.

- `server.js`: HTTP process, queue producer, saved totals page.
- `worker.js`: long-running queue consumer.
- `jobs/cleanup.js`: standalone daily summary command.
- `lib/database.js` and `lib/queue.js`: service connections.
- `lib/requests.js`: request inserts and daily aggregation.
- `schema.sql` and `scripts/setup-db.js`: repeatable table setup.

Run one worker instance for this simple example. Messages move to a processing
list before insertion and are acknowledged after the database write. On restart,
the worker retries an unfinished message; request UUIDs prevent duplicate rows.
Service failures stop the worker with a nonzero exit code so the runtime can
restart it. This demo has no multi-worker coordination or dead-letter queue.

## Verify locally

Run the SQL and page tests with `mise exec -- npm test`.

For the full integration check, start the disposable Compose services and run
database setup as above, then run:

```sh
mise exec -- npm run test:integration
```

Keep other web and worker processes stopped during this check. It starts its own
web server on port 13000 and worker, writes demo requests to the configured
services, verifies queue processing, saved daily totals, web output, restart
recovery, and clean shutdown. It leaves its sample rows in the demo database.
