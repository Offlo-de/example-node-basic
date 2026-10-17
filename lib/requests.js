export async function saveRequest(database, message) {
  await database.query(
    'INSERT INTO requests (id, message, method, path, arrived_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
    [message.id, message.message, message.method, message.path, message.arrivedAt],
  );
}

export async function summarizeRequests(database) {
  // Recompute every date so reruns and late queue processing remain accurate.
  return database.query(`
    INSERT INTO daily_request_counts (day, request_count, calculated_at)
    SELECT (arrived_at AT TIME ZONE 'UTC')::date, COUNT(*), NOW()
    FROM requests
    GROUP BY (arrived_at AT TIME ZONE 'UTC')::date
    ON CONFLICT (day) DO UPDATE
    SET request_count = EXCLUDED.request_count, calculated_at = EXCLUDED.calculated_at
    RETURNING day::text, request_count
  `);
}
