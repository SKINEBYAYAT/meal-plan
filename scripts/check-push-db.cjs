const { Pool } = require('pg');

async function main() {
  let value = process.env.DATABASE_URL;
  if (!value || !/^postgres(?:ql)?:\/\//.test(value)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  const start = value.indexOf('://') + 3;
  const end = value.lastIndexOf('@');
  const colon = value.indexOf(':', start);
  if (end > colon && colon >= start) {
    let password = value.slice(colon + 1, end);
    try { password = decodeURIComponent(password); } catch {}
    value = value.slice(0, colon + 1) + encodeURIComponent(password) + value.slice(end);
  }
  try { new URL(value); } catch {
    const hostPart = value.slice(value.lastIndexOf('@') + 1).split('/')[0];
    console.log(JSON.stringify({ invalidConnectionString: true,
      credentialsSeparatorPresent: value.includes('@'),
      numericPortPresent: /:\d+(\/|$)/.test(value),
      hostnameContainsWhitespace: /\s/.test(hostPart), hostnameContainsBrackets: /[\[\]<>]/.test(hostPart),
      containsWrappingQuotes: /["'`]/.test(value),
      duplicatedScheme: (value.match(/:\/\//g) || []).length > 1,
      trailingWhitespace: value !== value.trim() }));
    throw new Error('Invalid connection string');
  }
  const pool = new Pool({ connectionString: value, connectionTimeoutMillis: 15000, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const schema = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('push_devices', 'meal_reminders') ORDER BY table_name, ordinal_position");
      console.log(JSON.stringify({ schema: schema.rows }));
      const devices = await client.query(`SELECT master_enabled,
        CASE WHEN endpoint LIKE '%push.apple.com%' THEN 'Apple' ELSE 'Other' END AS provider,
        length(endpoint) > 0 AS has_endpoint, length(p256dh) > 0 AS has_p256dh,
        length(auth) > 0 AS has_auth, count(*)::int AS count
        FROM push_devices GROUP BY 1, 2, 3, 4, 5`);
      const reminders = await client.query(`SELECT d.master_enabled, r.enabled,
        count(*)::int AS count,
        count(*) FILTER (WHERE r.last_sent_date IS NULL OR r.last_sent_time IS NULL)::int AS never_sent_or_reset,
        max(r.last_sent_date) AS latest_sent_date
        FROM meal_reminders r JOIN push_devices d ON d.device_id = r.device_id GROUP BY 1, 2`);
      console.log(JSON.stringify({ devices: devices.rows, reminders: reminders.rows }));
      const claim = await client.query(`SELECT
        NOT (NULL::text = '2026-09-10' AND NULL::text = '12:00') AS old_claim,
        (NULL::text IS DISTINCT FROM '2026-09-10' OR NULL::text IS DISTINCT FROM '12:00') AS fixed_claim`);
      const integrity = await client.query(`SELECT
        (SELECT count(*)::int FROM meal_reminders r LEFT JOIN push_devices d ON d.device_id = r.device_id WHERE d.device_id IS NULL) AS orphan_reminders,
        (SELECT count(*)::int FROM (SELECT endpoint FROM push_devices GROUP BY endpoint HAVING count(*) > 1) duplicates) AS duplicate_endpoints`);
      console.log(JSON.stringify({ claimRegression: claim.rows[0], integrity: integrity.rows[0] }));
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await pool.end(); }
}

main().catch(error => {
  // Never print connection URLs, passwords, endpoints, or subscription keys.
  console.error(JSON.stringify({ connectionFailed: true, code: error.code ?? null,
    reason: error.code === '28P01' ? 'Database authentication failed' :
      error.code === 'ENOTFOUND' ? 'Database hostname could not be resolved' :
      error.code === 'ENETUNREACH' ? 'Database network is unreachable' :
      'Connection or read-only query failed' }));
  process.exitCode = 1;
});
