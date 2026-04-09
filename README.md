# USSR Economic System

A full-stack web application simulating a centralized USSR-style economic system with strict administrative control, role-based hierarchy, and a state-controlled marketplace.

## 🚀 Features

### Authentication & User Management
- **JWT-based authentication** with bcrypt password hashing
- **Role-based access control** with 6 default roles (Worker, Technician, Engineer, Manager, Director, Commissar)
- **Account status management** (Active, Frozen, Banned)
- **Rate limiting** on login attempts to prevent brute-force attacks
- **Session expiry** (7 days default)

### Economic System
- **Dual Currency Economy**
  - **Rubles** - Primary currency for transactions and purchases
  - **Token Rubles** - Secondary currency earned via activities
  - **Currency Conversion** - Convert Token Rubles to Rubles at configurable rates

- **Weekly Salary Distribution**
  - Automatic weekly salary distribution (cron job)
  - Manual distribution by admin
  - Role-based salary amounts

- **Central Treasury**
  - Admin-controlled money injection
  - Peer-to-peer transfers with regulation

### Transaction System
- **P2P Transfers**
  - Daily and weekly transfer limits
  - Transfer cooldowns between transactions
  - Tax system (admin-configurable)
  - Transaction logging for transparency

- **Anti-Abuse Protection**
  - Rate limiting on all actions
  - Daily transfer caps
  - Minimum account age before transactions
  - Cooldown between actions
  - Automatic suspicious activity detection
  - Account freeze capability

### Marketplace
- **State-Controlled Store**
  - Admin creates and manages items
  - Limited stock per item
  - Purchase history tracking
  - Real-time stock updates
  - Items include: Soviet Worker Badge, Propaganda Poster, Ration Voucher, Luxury Apartment Upgrade, Party Membership Card, State Vehicle Permit

### Leaderboard System
- **Weekly Rankings** based on total wealth (Rubles + Token Rubles)
- **Top Citizen of the Week** reward system
- **Historical leaderboard** tracking
- Medal display for top 3 citizens (🥇🥈🥉)

### Admin Panel
Full administrative control including:
- **User Management**
  - View all users with balances and roles
  - Freeze/Unfreeze accounts
  - Ban users
  - Assign roles
  - Inject money (Rubles or Token Rubles)

- **Transaction Monitoring**
  - View all system-wide transactions
  - Filter by user, date, and transaction type
  - Export capabilities

- **Economic Controls**
  - Set conversion rates
  - Modify tax rates
  - Adjust transfer limits
  - Configure cooldown periods
  - Manual salary distribution

- **Audit System**
  - Complete action logging
  - Searchable audit logs
  - Tamper-resistant logging
  - Track all admin actions

### Notification System
- In-app notifications for:
  - Salary received
  - Transfers (sent/received)
  - Account status changes
  - Purchases
  - System announcements

## 🎨 Design

**Soviet Propaganda Aesthetic:**
- Deep red, black, and gold color scheme
- Bold, authoritative typography
- Spacious, government-style layout
- Hammer and sickle iconography
- Large, clear panels and buttons
- Fully responsive for mobile and desktop

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (React) with App Router
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Lucide React** icons
- **Sonner** for toast notifications

### Backend
- **Next.js API Routes** (Node.js)
- **PostgreSQL** (via Supabase)
- **JWT** for authentication
- **bcryptjs** for password hashing
- **node-cron** for scheduled tasks

### Database
- **PostgreSQL** with proper indexing
- **Connection pooling** for performance
- **Transaction support** for data integrity

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Yarn package manager

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd ussr-economic-system
```

2. **Install dependencies**
```bash
yarn install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
# PostgreSQL Configuration
DATABASE_URL=postgresql://[username]:[password]@[host]:[port]/[database]

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRY_HOURS=168

# Initial Admin Configuration
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=YourSecurePassword123!

# Economic System Configuration
BASE_CONVERSION_RATE=0.8
MINIMUM_CONVERSION_AMOUNT=100
DEFAULT_TAX_RATE=0.05
DAILY_TRANSFER_LIMIT=10000
WEEKLY_TRANSFER_LIMIT=50000
TRANSFER_COOLDOWN_SECONDS=60
MINIMUM_ACCOUNT_AGE_DAYS=1
```

4. **Start the development server**
```bash
yarn dev
```

The application will be available at `http://localhost:3000`

## 🔑 Default Credentials

### Admin Account
- **Username**: `admin` (or as configured in .env)
- **Password**: `StateControl2025!` (or as configured in .env)
- **Starting Balance**: 100,000 Rubles + 10,000 Token Rubles
- **Role**: Director
- **Permissions**: Full admin access

### Sample Users
Pre-seeded users for testing:
- **ivan_petrov** (Worker) - Password: `password123`
- **maria_ivanova** (Technician) - Password: `password123`
- **dmitri_sokolov** (Engineer) - Password: `password123`
- **natasha_volkova** (Worker) - Password: `password123`
- **sergei_popov** (Technician) - Password: `password123`

## 🕐 Scheduled Tasks

### Weekly Salary Distribution
- **Schedule**: Every Monday at 00:00 (midnight)
- **Action**: Distributes weekly salaries to all active users based on their role
- **Manual Trigger**: Available in Admin Panel

### Weekly Leaderboard Reset
- **Schedule**: Every Monday at 00:01
- **Action**: Calculates rankings, awards Top Citizen reward, archives to history
- **Reward**: 5,000 Rubles to #1 ranked citizen

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds of 12
- **JWT Authentication**: Secure token-based sessions
- **Rate Limiting**: 
  - 5 login attempts per 15 minutes
  - 10 transfers per hour
  - 5 conversions per hour
  - 20 purchases per hour
- **SQL Injection Prevention**: Parameterized queries
- **Account Protection**: Freeze/ban capabilities
- **Audit Logging**: All actions tracked
- **Transaction Integrity**: Database transactions for atomic operations

## 📊 Database Schema

### Main Tables
- **users** - User accounts with balances and roles
- **roles** - Role definitions with salaries
- **transactions** - All financial transactions
- **marketplace_items** - State marketplace inventory
- **purchases** - Purchase history
- **notifications** - In-app notifications
- **system_config** - System-wide configuration
- **audit_logs** - Complete action history
- **leaderboard** - Historical weekly rankings

## 🚀 Deployment

### Environment Variables for Production
Ensure all sensitive values are properly set:
- Strong `JWT_SECRET`
- Secure admin credentials
- Production PostgreSQL connection string
- Appropriate CORS settings

### Database Initialization
The database automatically initializes on first API call with:
- All required tables and indexes
- Default roles
- Admin user
- System configuration
- Sample marketplace items

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### User Actions
- `GET /api/roles` - Get all roles
- `POST /api/transfer` - Transfer Rubles to another user
- `POST /api/convert` - Convert Token Rubles to Rubles
- `GET /api/marketplace` - Get marketplace items
- `POST /api/marketplace/purchase` - Purchase item
- `GET /api/leaderboard` - Get current leaderboard
- `GET /api/transactions` - Get user transactions
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/read` - Mark notification as read

### Admin Endpoints
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users/freeze` - Freeze user account
- `POST /api/admin/users/unfreeze` - Unfreeze user account
- `POST /api/admin/users/ban` - Ban user
- `POST /api/admin/users/assign-role` - Assign role to user
- `POST /api/admin/roles/create` - Create new role
- `POST /api/admin/roles/update` - Update role
- `GET /api/admin/transactions` - Get all transactions
- `POST /api/admin/treasury/inject` - Inject money to user
- `POST /api/admin/salary/distribute` - Distribute salaries manually
- `GET /api/admin/config` - Get system configuration
- `POST /api/admin/config/update` - Update system configuration
- `POST /api/admin/marketplace/create` - Create marketplace item
- `POST /api/admin/marketplace/update` - Update marketplace item
- `GET /api/admin/audit-logs` - Get audit logs

## 🎯 Future Enhancements

- Email notifications
- Multi-language support
- Advanced analytics dashboard
- Export transaction history as CSV
- User profile customization
- Achievement system
- Social features (messaging)
- Mobile app (React Native)

## 📝 License

This project is created as an educational simulation and is not affiliated with any real government or organization.

## 🤝 Credits

Built with modern web technologies:
- Next.js
- PostgreSQL
- Tailwind CSS
- shadcn/ui
- Lucide Icons

---

**For the Glory of the Motherland! 🚩**
