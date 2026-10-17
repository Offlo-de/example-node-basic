const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function renderPage(rows) {
  const content = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row.day)}</td><td>${escapeHtml(row.request_count)}</td><td>${escapeHtml(row.calculated_at.toISOString())}</td></tr>`).join('')
    : '<tr><td colspan="3">No saved totals yet. Run the daily summary command after the worker has processed requests.</td></tr>';
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offlo.de request demo</title></head>
<body>
  <h1>Hello from Offlo.de!</h1>
  <p>This page visit was queued in Redis. The background worker saves it to PostgreSQL and prints it.</p>
  <h2>Daily request totals</h2>
  <p>Saved by the separate daily summary command. Dates use UTC. Today's count is a snapshot as of the last run.</p>
  <table>
    <caption>Saved request counts by day</caption>
    <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Requests</th><th scope="col">Calculated at (UTC)</th></tr></thead>
    <tbody>${content}</tbody>
  </table>
  <p>Reload this page after the summary command runs to see updated totals.</p>
</body>
</html>`;
}
