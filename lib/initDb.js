import pool from './db.js';
import { hashPassword } from './auth.js';

export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing database...');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        weekly_salary DECIMAL(15, 2) DEFAULT 0,
        token_earning_modifier DECIMAL(5, 2) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id UUID REFERENCES roles(id),
        ruble_balance DECIMAL(15, 2) DEFAULT 0,
        token_ruble_balance DECIMAL(15, 2) DEFAULT 0,
        account_status VARCHAR(20) DEFAULT 'active',
        is_admin BOOLEAN DEFAULT FALSE,
        last_transfer_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID REFERENCES users(id),
        to_user_id UUID REFERENCES users(id),
        amount DECIMAL(15, 2) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        description TEXT,
        tax_amount DECIMAL(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(15, 2) NOT NULL,
        stock INTEGER DEFAULT 0,
        effects JSONB DEFAULT '{}',
        image_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        item_id UUID REFERENCES marketplace_items(id),
        quantity INTEGER DEFAULT 1,
        total_price DECIMAL(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON purchases(item_id);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        username VARCHAR(50),
        total_wealth DECIMAL(15, 2),
        week_number INTEGER,
        year INTEGER,
        rank INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_week ON leaderboard(week_number, year);
      CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
    `);
    
    console.log('✓ Tables created');
    
    // Insert default roles
    const roleCheck = await client.query('SELECT COUNT(*) as count FROM roles');
    if (parseInt(roleCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO roles (name, description, weekly_salary, token_earning_modifier) VALUES
        ('Worker', 'Basic laborer of the state', 500, 1.0),
        ('Technician', 'Skilled technical worker', 800, 1.2),
        ('Engineer', 'Professional engineer', 1200, 1.5),
        ('Manager', 'Department manager', 2000, 2.0),
        ('Director', 'High-level director', 3500, 2.5),
        ('Commissar', 'Political commissar with special privileges', 5000, 3.0)
      `);
      console.log('✓ Default roles created');
    }
    
    // Insert initial admin
    const adminCheck = await client.query('SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await hashPassword(adminPassword);
      
      const directorRole = await client.query("SELECT id FROM roles WHERE name = 'Director' LIMIT 1");
      const roleId = directorRole.rows[0]?.id;
      
      await client.query(
        `INSERT INTO users (username, password_hash, role_id, ruble_balance, token_ruble_balance, is_admin, account_status) 
         VALUES ($1, $2, $3, 100000, 10000, TRUE, 'active')`,
        [adminUsername, hashedPassword, roleId]
      );
      console.log(`✓ Admin user created: ${adminUsername}`);
    }
    
    // Insert system config defaults
    const configCheck = await client.query('SELECT COUNT(*) as count FROM system_config');
    if (parseInt(configCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO system_config (key, value) VALUES
        ('conversion_rate', '0.8'),
        ('minimum_conversion_amount', '100'),
        ('tax_rate', '0.05'),
        ('daily_transfer_limit', '10000'),
        ('weekly_transfer_limit', '50000'),
        ('transfer_cooldown_seconds', '60')
      `);
      console.log('✓ System config initialized');
    }
    
    // Insert sample marketplace items
    const itemCheck = await client.query('SELECT COUNT(*) as count FROM marketplace_items');
    if (parseInt(itemCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO marketplace_items (name, description, price, stock, effects) VALUES
        ('Soviet Worker Badge', 'Honorary badge of the working class', 150, 50, '{}'),
        ('Propaganda Poster', 'Official state propaganda poster', 200, 30, '{}'),
        ('Ration Voucher', 'Extra food rations for the month', 500, 100, '{"bonus": "food"}'),
        ('Luxury Apartment Upgrade', 'Move to a better state-assigned apartment', 5000, 5, '{"boost": "housing"}'),
        ('Party Membership Card', 'Join the inner circle of the Party', 10000, 2, '{"prestige": true}'),
        ('State Vehicle Permit', 'Permission to use a state vehicle', 15000, 3, '{"transport": true}')
      `);
      console.log('✓ Sample marketplace items created');
    }
    
    // Insert sample users
    const userCheck = await client.query('SELECT COUNT(*) as count FROM users WHERE is_admin = FALSE');
    if (parseInt(userCheck.rows[0].count) < 5) {
      const workerRole = await client.query("SELECT id FROM roles WHERE name = 'Worker' LIMIT 1");
      const techRole = await client.query("SELECT id FROM roles WHERE name = 'Technician' LIMIT 1");
      const engRole = await client.query("SELECT id FROM roles WHERE name = 'Engineer' LIMIT 1");
      
      const samplePassword = await hashPassword('password123');
      
      await client.query(`
        INSERT INTO users (username, password_hash, role_id, ruble_balance, token_ruble_balance, account_status) VALUES
        ('ivan_petrov', $1, $2, 2500, 500, 'active'),
        ('maria_ivanova', $1, $3, 3200, 800, 'active'),
        ('dmitri_sokolov', $1, $4, 4500, 1200, 'active'),
        ('natasha_volkova', $1, $2, 1800, 400, 'active'),
        ('sergei_popov', $1, $3, 2900, 700, 'active')
        ON CONFLICT (username) DO NOTHING
      `, [samplePassword, workerRole.rows[0]?.id, techRole.rows[0]?.id, engRole.rows[0]?.id]);
      console.log('✓ Sample users created');
    }
    
    console.log('✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}
