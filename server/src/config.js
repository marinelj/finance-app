/** Settings from the environment (server/.env). Nothing here has a secret default. */

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Copy server/.env.example to server/.env.`);
  return value;
}

function list(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const sslmode = env.DB_SSLMODE ?? 'prefer';
  return {
    db: {
      host: required('DB_HOST'),
      port: Number(env.DB_PORT ?? 5432),
      database: required('DB_NAME'),
      user: required('DB_USER'),
      password: required('DB_PASSWORD'),
      // node-postgres has no "prefer": use TLS only when asked to.
      ssl:
        sslmode === 'require' || sslmode === 'verify-full'
          ? { rejectUnauthorized: sslmode === 'verify-full' }
          : false,
      max: 10,
    },
    host: env.API_HOST ?? '0.0.0.0',
    port: Number(env.API_PORT ?? 8787),
    /** "first" lets only the first account sign up; "open" lets anyone; "closed" lets nobody. */
    signup: ['first', 'open', 'closed'].includes(env.SIGNUP) ? env.SIGNUP : 'first',
    /** Browser origins allowed to call the API (the phone apps don't need this). */
    corsOrigins: list(env.CORS_ORIGINS),
    sessionDays: Number(env.SESSION_DAYS ?? 90),
    /** Biggest upload accepted, in megabytes. */
    maxBodyMb: Number(env.MAX_BODY_MB ?? 20),
  };
}
