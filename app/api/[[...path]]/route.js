import { NextResponse } from 'next/server';
import pool, { transaction } from '@/lib/db';
import { hashPassword, verifyPassword, generateToken, getUserFromRequest, requireAdmin } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimiter';
import { initializeDatabase } from '@/lib/initDb';
import cron from 'node-cron';

// Initialize database on startup
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Weekly salary distribution cron job (runs every Monday at 00:00)
cron.schedule('0 0 * * 1', async () => {
  console.log('⏰ Running weekly salary distribution...');
  try {
    await distributeSalaries();
    console.log('✅ Weekly salary distribution complete');
  } catch (error) {
    console.error('❌ Salary distribution failed:', error);
  }
});

// Weekly leaderboard reset (runs every Monday at 00:01)
cron.schedule('1 0 * * 1', async () => {
  console.log('⏰ Resetting weekly leaderboard...');
  try {
    await resetLeaderboard();
    console.log('✅ Leaderboard reset complete');
  } catch (error) {
    console.error('❌ Leaderboard reset failed:', error);
  }
});

// Helper: Distribute salaries
async function distributeSalaries() {
  return await transaction(async (client) => {
    const result = await client.query(`
      SELECT u.id, u.username, u.ruble_balance, r.weekly_salary, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.account_status = 'active' AND r.weekly_salary > 0
    `);

    for (const user of result.rows) {
      // Update balance
      await client.query(
        'UPDATE users SET ruble_balance = ruble_balance + $1 WHERE id = $2',
        [user.weekly_salary, user.id]
      );

      // Log transaction
      await client.query(
        `INSERT INTO transactions (to_user_id, amount, transaction_type, description)
         VALUES ($1, $2, 'salary', 'Weekly salary payment')`,
        [user.id, user.weekly_salary]
      );

      // Notify user
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'success')`,
        [
          user.id,
          'Weekly Salary Received',
          `You have received your weekly salary of ${user.weekly_salary} Rubles as a ${user.role_name}.`
        ]
      );
    }

    return result.rows.length;
  });
}

// Helper: Reset leaderboard
async function resetLeaderboard() {
  const weekNumber = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  const year = new Date().getFullYear();

  return await transaction(async (client) => {
    // Calculate current rankings
    const rankings = await client.query(`
      SELECT 
        u.id,
        u.username,
        (u.ruble_balance + u.token_ruble_balance) as total_wealth,
        ROW_NUMBER() OVER (ORDER BY (u.ruble_balance + u.token_ruble_balance) DESC) as rank
      FROM users u
      WHERE u.account_status = 'active'
      ORDER BY total_wealth DESC
      LIMIT 100
    `);

    // Save to leaderboard history
    for (const row of rankings.rows) {
      await client.query(
        `INSERT INTO leaderboard (user_id, username, total_wealth, week_number, year, rank)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.username, row.total_wealth, weekNumber, year, row.rank]
      );
    }

    // Award top citizen
    if (rankings.rows.length > 0) {
      const winner = rankings.rows[0];
      const reward = 5000;
      
      await client.query(
        'UPDATE users SET ruble_balance = ruble_balance + $1 WHERE id = $2',
        [reward, winner.id]
      );

      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'success')`,
        [
          winner.id,
          '🏆 Top Citizen of the Week!',
          `Congratulations! You are the Top Citizen of the Week and have been awarded ${reward} Rubles!`
        ]
      );
    }

    return rankings.rows.length;
  });
}

// Helper: Create notification
async function createNotification(userId, title, message, type = 'info') {
  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
    [userId, title, message, type]
  );
}

// Helper: Log audit
async function logAudit(userId, action, details = {}, ipAddress = null) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
    [userId, action, JSON.stringify(details), ipAddress]
  );
}

// Helper: Get system config value
async function getConfigValue(key, defaultValue) {
  const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
  if (result.rows.length === 0) return defaultValue;
  return parseFloat(result.rows[0].value) || defaultValue;
}

// POST /api/auth/register
async function handleRegister(request) {
  try {
    await ensureDbInitialized();
  } catch (error) {
    console.error('Database initialization error during registration:', error);
    return NextResponse.json({
      error: 'Database initialization failed',
      message: error?.message || 'Failed to initialize database'
    }, { status: 500 });
  }
  
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ error: 'Username must be 3-50 characters' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if username exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    // Get default role (Worker)
    const roleResult = await pool.query("SELECT id FROM roles WHERE name = 'Worker' LIMIT 1");
    const roleId = roleResult.rows[0]?.id;

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role_id, ruble_balance, token_ruble_balance, account_status)
       VALUES ($1, $2, $3, 1000, 100, 'active')
       RETURNING id, username, role_id, ruble_balance, token_ruble_balance, account_status, is_admin, created_at`,
      [username, passwordHash, roleId]
    );

    const user = result.rows[0];

    // Get role info
    const roleInfo = await pool.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
    user.role_name = roleInfo.rows[0]?.name;

    // Create welcome notification
    await createNotification(
      user.id,
      'Welcome to the USSR Economic System',
      'You have been assigned the Worker role. Report to your duties and serve the state!',
      'info'
    );

    // Log audit
    await logAudit(user.id, 'USER_REGISTERED', { username });

    // Generate token
    const token = generateToken({ ...user, role_name: user.role_name });

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role_name,
        ruble_balance: parseFloat(user.ruble_balance),
        token_ruble_balance: parseFloat(user.token_ruble_balance),
        account_status: user.account_status,
        is_admin: user.is_admin,
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      error: 'Registration failed',
      message: error?.message || 'Unknown error during registration'
    }, { status: 500 });
  }
}

// POST /api/auth/login
async function handleLogin(request) {
  try {
    await ensureDbInitialized();
  } catch (error) {
    console.error('Database initialization error during login:', error);
    return NextResponse.json({
      error: 'Database initialization failed',
      message: error?.message || 'Failed to initialize database'
    }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Rate limiting
    const rateLimitOk = await checkRateLimit(username, 'login');
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
    }

    // Get user
    const result = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];

    // Check account status
    if (user.account_status === 'frozen') {
      return NextResponse.json({ error: 'Account is frozen by state authority' }, { status: 403 });
    }

    if (user.account_status === 'banned') {
      return NextResponse.json({ error: 'Account has been banned' }, { status: 403 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Log audit
    await logAudit(user.id, 'USER_LOGIN', { username });

    // Generate token
    const token = generateToken(user);

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role_name,
        ruble_balance: parseFloat(user.ruble_balance),
        token_ruble_balance: parseFloat(user.token_ruble_balance),
        account_status: user.account_status,
        is_admin: user.is_admin,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      error: 'Login failed',
      message: error?.message || 'Unknown error during login'
    }, { status: 500 });
  }
}

// GET /api/health - Health check endpoint
async function handleHealth(request) {
  try {
    // Test database connection
    const dbTest = await pool.query('SELECT NOW() as current_time');
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: !!dbTest.rows.length,
        time: dbTest.rows[0]?.current_time
      },
      environment: {
        node_env: process.env.NODE_ENV,
        database_url_set: !!process.env.DATABASE_URL,
        jwt_secret_set: !!process.env.JWT_SECRET,
        admin_username_set: !!process.env.INITIAL_ADMIN_USERNAME,
        admin_password_set: !!process.env.INITIAL_ADMIN_PASSWORD,
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

// GET /api/auth/me
async function handleGetMe(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.ruble_balance, u.token_ruble_balance, u.account_status, u.is_admin, u.created_at, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = result.rows[0];

    return NextResponse.json({
      user: {
        id: userData.id,
        username: userData.username,
        role: userData.role_name,
        ruble_balance: parseFloat(userData.ruble_balance),
        token_ruble_balance: parseFloat(userData.token_ruble_balance),
        account_status: userData.account_status,
        is_admin: userData.is_admin,
        created_at: userData.created_at,
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// GET /api/roles
async function handleGetRoles(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY weekly_salary ASC');
    return NextResponse.json({ roles: result.rows });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

// POST /api/transfer
async function handleTransfer(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { to_username, amount } = body;

  if (!to_username || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid transfer parameters' }, { status: 400 });
  }

  // Rate limiting
  const transferRateLimitOk = await checkRateLimit(user.id, 'transfer');
  if (!transferRateLimitOk) {
    return NextResponse.json({ error: 'Transfer limit exceeded. Please wait.' }, { status: 429 });
  }

  try {
    // Check account age
    const userInfo = await pool.query('SELECT created_at, account_status, ruble_balance, last_transfer_at FROM users WHERE id = $1', [user.id]);
    if (userInfo.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const accountAge = (Date.now() - new Date(userInfo.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    const minAccountAge = await getConfigValue('minimum_account_age_days', 1);

    if (accountAge < minAccountAge) {
      return NextResponse.json({ error: `Account must be at least ${minAccountAge} days old to transfer` }, { status: 403 });
    }

    // Check account status
    if (userInfo.rows[0].account_status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    // Check transfer cooldown
    const cooldown = await getConfigValue('transfer_cooldown_seconds', 60);
    if (userInfo.rows[0].last_transfer_at) {
      const timeSinceLastTransfer = (Date.now() - new Date(userInfo.rows[0].last_transfer_at).getTime()) / 1000;
      if (timeSinceLastTransfer < cooldown) {
        return NextResponse.json({ 
          error: `Please wait ${Math.ceil(cooldown - timeSinceLastTransfer)} seconds before next transfer` 
        }, { status: 429 });
      }
    }

    // Check daily limit
    const dailyLimit = await getConfigValue('daily_transfer_limit', 10000);
    const dailyTotal = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE from_user_id = $1 AND transaction_type = 'transfer' AND created_at > NOW() - INTERVAL '24 hours'`,
      [user.id]
    );

    if (parseFloat(dailyTotal.rows[0].total) + amount > dailyLimit) {
      return NextResponse.json({ error: `Daily transfer limit of ${dailyLimit} Rubles exceeded` }, { status: 403 });
    }

    // Get recipient
    const recipient = await pool.query('SELECT id, username, account_status FROM users WHERE username = $1', [to_username]);
    if (recipient.rows.length === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    if (recipient.rows[0].id === user.id) {
      return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });
    }

    if (recipient.rows[0].account_status !== 'active') {
      return NextResponse.json({ error: 'Recipient account is not active' }, { status: 403 });
    }

    // Calculate tax
    const taxRate = await getConfigValue('tax_rate', 0.05);
    const taxAmount = amount * taxRate;
    const netAmount = amount - taxAmount;

    // Check balance
    if (parseFloat(userInfo.rows[0].ruble_balance) < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Execute transfer
    await transaction(async (client) => {
      // Deduct from sender
      await client.query(
        'UPDATE users SET ruble_balance = ruble_balance - $1, last_transfer_at = NOW() WHERE id = $2',
        [amount, user.id]
      );

      // Add to recipient (after tax)
      await client.query(
        'UPDATE users SET ruble_balance = ruble_balance + $1 WHERE id = $2',
        [netAmount, recipient.rows[0].id]
      );

      // Log transaction
      await client.query(
        `INSERT INTO transactions (from_user_id, to_user_id, amount, transaction_type, description, tax_amount)
         VALUES ($1, $2, $3, 'transfer', 'P2P Transfer', $4)`,
        [user.id, recipient.rows[0].id, amount, taxAmount]
      );

      // Notify recipient
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Transfer Received', $2, 'success')`,
        [recipient.rows[0].id, `You received ${netAmount.toFixed(2)} Rubles from ${user.username} (${taxAmount.toFixed(2)} Rubles tax deducted)`]
      );

      // Notify sender
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Transfer Sent', $2, 'info')`,
        [user.id, `You sent ${amount.toFixed(2)} Rubles to ${to_username} (${taxAmount.toFixed(2)} Rubles tax, ${netAmount.toFixed(2)} net)`]
      );
    });

    // Log audit
    await logAudit(user.id, 'TRANSFER', { to: to_username, amount, tax: taxAmount });

    return NextResponse.json({
      message: 'Transfer successful',
      amount,
      tax: taxAmount,
      net: netAmount
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}

// POST /api/convert
async function handleConvert(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { amount } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  // Rate limiting
  const conversionRateLimitOk = await checkRateLimit(user.id, 'conversion');
  if (!conversionRateLimitOk) {
    return NextResponse.json({ error: 'Conversion limit exceeded. Please wait.' }, { status: 429 });
  }

  try {
    // Get conversion parameters
    const conversionRate = await getConfigValue('conversion_rate', 0.8);
    const minConversion = await getConfigValue('minimum_conversion_amount', 100);

    if (amount < minConversion) {
      return NextResponse.json({ error: `Minimum conversion amount is ${minConversion} Token Rubles` }, { status: 400 });
    }

    // Get user balance
    const userInfo = await pool.query('SELECT token_ruble_balance, account_status FROM users WHERE id = $1', [user.id]);
    if (userInfo.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userInfo.rows[0].account_status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    if (parseFloat(userInfo.rows[0].token_ruble_balance) < amount) {
      return NextResponse.json({ error: 'Insufficient Token Ruble balance' }, { status: 400 });
    }

    // Calculate conversion
    const rublesReceived = amount * conversionRate;

    // Execute conversion
    await transaction(async (client) => {
      await client.query(
        'UPDATE users SET token_ruble_balance = token_ruble_balance - $1, ruble_balance = ruble_balance + $2 WHERE id = $3',
        [amount, rublesReceived, user.id]
      );

      await client.query(
        `INSERT INTO transactions (to_user_id, amount, transaction_type, description)
         VALUES ($1, $2, 'conversion', 'Token Ruble to Ruble conversion')`,
        [user.id, rublesReceived]
      );

      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Conversion Complete', $2, 'success')`,
        [user.id, `Converted ${amount} Token Rubles to ${rublesReceived.toFixed(2)} Rubles`]
      );
    });

    await logAudit(user.id, 'CONVERSION', { amount, rate: conversionRate, received: rublesReceived });

    return NextResponse.json({
      message: 'Conversion successful',
      token_rubles_spent: amount,
      rubles_received: rublesReceived,
      rate: conversionRate
    });

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}

// GET /api/marketplace
async function handleGetMarketplace(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM marketplace_items WHERE is_active = TRUE ORDER BY price ASC'
    );
    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('Get marketplace error:', error);
    return NextResponse.json({ error: 'Failed to fetch marketplace' }, { status: 500 });
  }
}

// POST /api/marketplace/purchase
async function handlePurchase(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { item_id, quantity = 1 } = body;

  if (!item_id || quantity < 1) {
    return NextResponse.json({ error: 'Invalid purchase parameters' }, { status: 400 });
  }

  // Rate limiting
  const purchaseRateLimitOk = await checkRateLimit(user.id, 'purchase');
  if (!purchaseRateLimitOk) {
    return NextResponse.json({ error: 'Purchase limit exceeded. Please wait.' }, { status: 429 });
  }

  try {
    // Get item
    const itemResult = await pool.query('SELECT * FROM marketplace_items WHERE id = $1 AND is_active = TRUE', [item_id]);
    if (itemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const item = itemResult.rows[0];

    if (item.stock < quantity) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 });
    }

    const totalPrice = parseFloat(item.price) * quantity;

    // Get user balance
    const userInfo = await pool.query('SELECT ruble_balance, account_status FROM users WHERE id = $1', [user.id]);
    if (userInfo.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userInfo.rows[0].account_status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    if (parseFloat(userInfo.rows[0].ruble_balance) < totalPrice) {
      return NextResponse.json({ error: 'Insufficient Rubles' }, { status: 400 });
    }

    // Execute purchase
    await transaction(async (client) => {
      // Deduct balance
      await client.query(
        'UPDATE users SET ruble_balance = ruble_balance - $1 WHERE id = $2',
        [totalPrice, user.id]
      );

      // Reduce stock
      await client.query(
        'UPDATE marketplace_items SET stock = stock - $1 WHERE id = $2',
        [quantity, item_id]
      );

      // Record purchase
      await client.query(
        `INSERT INTO purchases (user_id, item_id, quantity, total_price)
         VALUES ($1, $2, $3, $4)`,
        [user.id, item_id, quantity, totalPrice]
      );

      // Log transaction
      await client.query(
        `INSERT INTO transactions (from_user_id, amount, transaction_type, description)
         VALUES ($1, $2, 'purchase', $3)`,
        [user.id, totalPrice, `Purchased ${quantity}x ${item.name}`]
      );

      // Notify user
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, 'Purchase Complete', $2, 'success')`,
        [user.id, `You purchased ${quantity}x ${item.name} for ${totalPrice.toFixed(2)} Rubles`]
      );
    });

    await logAudit(user.id, 'PURCHASE', { item: item.name, quantity, price: totalPrice });

    return NextResponse.json({
      message: 'Purchase successful',
      item: item.name,
      quantity,
      total_price: totalPrice
    });

  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: 'Purchase failed' }, { status: 500 });
  }
}

// GET /api/leaderboard
async function handleGetLeaderboard(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        r.name as role,
        (u.ruble_balance + u.token_ruble_balance) as total_wealth,
        ROW_NUMBER() OVER (ORDER BY (u.ruble_balance + u.token_ruble_balance) DESC) as rank
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.account_status = 'active'
      ORDER BY total_wealth DESC
      LIMIT 50
    `);

    return NextResponse.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

// GET /api/transactions
async function handleGetTransactions(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.username as from_username,
        u2.username as to_username
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      WHERE t.from_user_id = $1 OR t.to_user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 100
    `, [user.id]);

    return NextResponse.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// GET /api/notifications
async function handleGetNotifications(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );

    return NextResponse.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST /api/notifications/read
async function handleMarkNotificationRead(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { notification_id } = body;

  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [notification_id, user.id]
    );

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    return NextResponse.json({ error: 'Failed to mark notification' }, { status: 500 });
  }
}

// ============ ADMIN ROUTES ============

// GET /api/admin/users
async function handleAdminGetUsers(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.ruble_balance,
        u.token_ruble_balance,
        u.account_status,
        u.is_admin,
        u.created_at,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error('Admin get users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/admin/users/freeze
async function handleAdminFreezeUser(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, reason } = body;

  try {
    await pool.query(
      "UPDATE users SET account_status = 'frozen' WHERE id = $1",
      [user_id]
    );

    await createNotification(
      user_id,
      'Account Frozen',
      `Your account has been frozen by state authority. Reason: ${reason || 'Administrative action'}`,
      'error'
    );

    await logAudit(user.id, 'ADMIN_FREEZE_USER', { target_user_id: user_id, reason });

    return NextResponse.json({ message: 'User frozen' });
  } catch (error) {
    console.error('Admin freeze user error:', error);
    return NextResponse.json({ error: 'Failed to freeze user' }, { status: 500 });
  }
}

// POST /api/admin/users/unfreeze
async function handleAdminUnfreezeUser(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id } = body;

  try {
    await pool.query(
      "UPDATE users SET account_status = 'active' WHERE id = $1",
      [user_id]
    );

    await createNotification(
      user_id,
      'Account Unfrozen',
      'Your account has been restored by state authority. You may resume activities.',
      'success'
    );

    await logAudit(user.id, 'ADMIN_UNFREEZE_USER', { target_user_id: user_id });

    return NextResponse.json({ message: 'User unfrozen' });
  } catch (error) {
    console.error('Admin unfreeze user error:', error);
    return NextResponse.json({ error: 'Failed to unfreeze user' }, { status: 500 });
  }
}

// POST /api/admin/users/ban
async function handleAdminBanUser(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, reason } = body;

  try {
    await pool.query(
      "UPDATE users SET account_status = 'banned' WHERE id = $1",
      [user_id]
    );

    await createNotification(
      user_id,
      'Account Banned',
      `Your account has been permanently banned. Reason: ${reason || 'Violation of state regulations'}`,
      'error'
    );

    await logAudit(user.id, 'ADMIN_BAN_USER', { target_user_id: user_id, reason });

    return NextResponse.json({ message: 'User banned' });
  } catch (error) {
    console.error('Admin ban user error:', error);
    return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
  }
}

// POST /api/admin/users/assign-role
async function handleAdminAssignRole(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, role_id } = body;

  try {
    await pool.query(
      'UPDATE users SET role_id = $1 WHERE id = $2',
      [role_id, user_id]
    );

    const roleInfo = await pool.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    const roleName = roleInfo.rows[0]?.name;

    await createNotification(
      user_id,
      'Role Assignment',
      `You have been assigned a new role: ${roleName}`,
      'info'
    );

    await logAudit(user.id, 'ADMIN_ASSIGN_ROLE', { target_user_id: user_id, role_id, role_name: roleName });

    return NextResponse.json({ message: 'Role assigned' });
  } catch (error) {
    console.error('Admin assign role error:', error);
    return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 });
  }
}

// POST /api/admin/roles/create
async function handleAdminCreateRole(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, weekly_salary, token_earning_modifier } = body;

  try {
    const result = await pool.query(
      `INSERT INTO roles (name, description, weekly_salary, token_earning_modifier)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, weekly_salary, token_earning_modifier]
    );

    await logAudit(user.id, 'ADMIN_CREATE_ROLE', { role_name: name });

    return NextResponse.json({ message: 'Role created', role: result.rows[0] });
  } catch (error) {
    console.error('Admin create role error:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}

// POST /api/admin/roles/update
async function handleAdminUpdateRole(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { role_id, name, description, weekly_salary, token_earning_modifier } = body;

  try {
    await pool.query(
      `UPDATE roles 
       SET name = $1, description = $2, weekly_salary = $3, token_earning_modifier = $4
       WHERE id = $5`,
      [name, description, weekly_salary, token_earning_modifier, role_id]
    );

    await logAudit(user.id, 'ADMIN_UPDATE_ROLE', { role_id, role_name: name });

    return NextResponse.json({ message: 'Role updated' });
  } catch (error) {
    console.error('Admin update role error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

// GET /api/admin/transactions
async function handleAdminGetTransactions(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u1.username as from_username,
        u2.username as to_username
      FROM transactions t
      LEFT JOIN users u1 ON t.from_user_id = u1.id
      LEFT JOIN users u2 ON t.to_user_id = u2.id
      ORDER BY t.created_at DESC
      LIMIT 500
    `);

    return NextResponse.json({ transactions: result.rows });
  } catch (error) {
    console.error('Admin get transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST /api/admin/treasury/inject
async function handleAdminInjectMoney(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, amount, type } = body;

  if (!user_id || !amount || amount <= 0 || !['ruble', 'token_ruble'].includes(type)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  try {
    const column = type === 'ruble' ? 'ruble_balance' : 'token_ruble_balance';
    
    await pool.query(
      `UPDATE users SET ${column} = ${column} + $1 WHERE id = $2`,
      [amount, user_id]
    );

    await pool.query(
      `INSERT INTO transactions (to_user_id, amount, transaction_type, description)
       VALUES ($1, $2, 'treasury_injection', 'State treasury injection')`,
      [user_id, amount]
    );

    await createNotification(
      user_id,
      'Treasury Injection',
      `The state has granted you ${amount} ${type === 'ruble' ? 'Rubles' : 'Token Rubles'}`,
      'success'
    );

    await logAudit(user.id, 'ADMIN_TREASURY_INJECT', { target_user_id: user_id, amount, type });

    return NextResponse.json({ message: 'Money injected' });
  } catch (error) {
    console.error('Admin inject money error:', error);
    return NextResponse.json({ error: 'Failed to inject money' }, { status: 500 });
  }
}

// POST /api/admin/salary/distribute
async function handleAdminDistributeSalary(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const count = await distributeSalaries();
    await logAudit(user.id, 'ADMIN_DISTRIBUTE_SALARY', { users_paid: count });
    return NextResponse.json({ message: `Salaries distributed to ${count} users` });
  } catch (error) {
    console.error('Admin distribute salary error:', error);
    return NextResponse.json({ error: 'Failed to distribute salaries' }, { status: 500 });
  }
}

// POST /api/admin/config/update
async function handleAdminUpdateConfig(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { key, value } = body;

  try {
    await pool.query(
      `INSERT INTO system_config (key, value, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value.toString()]
    );

    await logAudit(user.id, 'ADMIN_UPDATE_CONFIG', { key, value });

    return NextResponse.json({ message: 'Config updated' });
  } catch (error) {
    console.error('Admin update config error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

// GET /api/admin/config
async function handleAdminGetConfig(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const result = await pool.query('SELECT * FROM system_config');
    const config = {};
    result.rows.forEach(row => {
      config[row.key] = row.value;
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Admin get config error:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

// POST /api/admin/marketplace/create
async function handleAdminCreateItem(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, price, stock, effects, image_url } = body;

  try {
    const result = await pool.query(
      `INSERT INTO marketplace_items (name, description, price, stock, effects, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, price, stock, JSON.stringify(effects || {}), image_url]
    );

    await logAudit(user.id, 'ADMIN_CREATE_ITEM', { item_name: name });

    return NextResponse.json({ message: 'Item created', item: result.rows[0] });
  } catch (error) {
    console.error('Admin create item error:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}

// POST /api/admin/marketplace/update
async function handleAdminUpdateItem(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { item_id, name, description, price, stock, effects, image_url, is_active } = body;

  try {
    await pool.query(
      `UPDATE marketplace_items 
       SET name = $1, description = $2, price = $3, stock = $4, effects = $5, image_url = $6, is_active = $7
       WHERE id = $8`,
      [name, description, price, stock, JSON.stringify(effects || {}), image_url, is_active, item_id]
    );

    await logAudit(user.id, 'ADMIN_UPDATE_ITEM', { item_id, item_name: name });

    return NextResponse.json({ message: 'Item updated' });
  } catch (error) {
    console.error('Admin update item error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// GET /api/admin/audit-logs
async function handleAdminGetAuditLogs(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    requireAdmin(user);
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 500
    `);

    return NextResponse.json({ logs: result.rows });
  } catch (error) {
    console.error('Admin get audit logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

// Main request handler
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');

    console.log('GET', path);

    if (path === 'health') return await handleHealth(request);
    if (path === 'auth/me') return await handleGetMe(request);
    if (path === 'roles') return await handleGetRoles(request);
    if (path === 'marketplace') return await handleGetMarketplace(request);
    if (path === 'leaderboard') return await handleGetLeaderboard(request);
    if (path === 'transactions') return await handleGetTransactions(request);
    if (path === 'notifications') return await handleGetNotifications(request);
    if (path === 'admin/users') return await handleAdminGetUsers(request);
    if (path === 'admin/transactions') return await handleAdminGetTransactions(request);
    if (path === 'admin/config') return await handleAdminGetConfig(request);
    if (path === 'admin/audit-logs') return await handleAdminGetAuditLogs(request);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('GET handler error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');

    console.log('POST', path);

    if (path === 'auth/register') return await handleRegister(request);
    if (path === 'auth/login') return await handleLogin(request);
    if (path === 'transfer') return await handleTransfer(request);
    if (path === 'convert') return await handleConvert(request);
    if (path === 'marketplace/purchase') return await handlePurchase(request);
    if (path === 'notifications/read') return await handleMarkNotificationRead(request);
    if (path === 'admin/users/freeze') return await handleAdminFreezeUser(request);
    if (path === 'admin/users/unfreeze') return await handleAdminUnfreezeUser(request);
    if (path === 'admin/users/ban') return await handleAdminBanUser(request);
    if (path === 'admin/users/assign-role') return await handleAdminAssignRole(request);
    if (path === 'admin/roles/create') return await handleAdminCreateRole(request);
    if (path === 'admin/roles/update') return await handleAdminUpdateRole(request);
    if (path === 'admin/treasury/inject') return await handleAdminInjectMoney(request);
    if (path === 'admin/salary/distribute') return await handleAdminDistributeSalary(request);
    if (path === 'admin/config/update') return await handleAdminUpdateConfig(request);
    if (path === 'admin/marketplace/create') return await handleAdminCreateItem(request);
    if (path === 'admin/marketplace/update') return await handleAdminUpdateItem(request);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST handler error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
