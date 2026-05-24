import { Pool } from 'pg';

// Create pool lazily to avoid build-time failures
let pool;
let poolInitialized = false;

function initializePool() {
  if (poolInitialized) return pool;
  
  // Validate DATABASE_URL only at runtime (not during build)
  if (!process.env.DATABASE_URL) {
    throw new Error('CRITICAL: DATABASE_URL environment variable is not set. Provide a valid PostgreSQL connection string.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });

  poolInitialized = true;
  return pool;
}

// Test connection
function attachPoolListeners() {
  const p = initializePool();
  
  if (!p._listenersAttached) {
    p.on('connect', () => {
      console.log('✓ PostgreSQL connected');
    });

    p.on('error', (err) => {
      console.error('PostgreSQL error:', err);
    });
    
    p._listenersAttached = true;
  }
}

export default new Proxy({}, {
  get(target, prop) {
    const p = initializePool();
    attachPoolListeners();
    return p[prop];
  }
});

// Helper function to execute queries
export async function query(text, params) {
  const p = initializePool();
  attachPoolListeners();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Transaction helper
export async function transaction(callback) {
  const p = initializePool();
  attachPoolListeners();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
