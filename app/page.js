'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, BellIcon, CoinsIcon, TrophyIcon, ShoppingCartIcon, RefreshCwIcon, UserIcon, LogOutIcon, ShieldIcon, UsersIcon, SettingsIcon, DollarSignIcon, Star, Hammer, Flag } from 'lucide-react';
import { toast } from 'sonner';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auth state
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Data state
  const [roles, setRoles] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Admin state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminTransactions, setAdminTransactions] = useState([]);
  const [adminConfig, setAdminConfig] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);

  // Transfer state
  const [transferUsername, setTransferUsername] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // Conversion state
  const [conversionAmount, setConversionAmount] = useState('');

  // Purchase state
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUserData(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchRoles();
      fetchMarketplace();
      fetchLeaderboard();
      fetchTransactions();
      fetchNotifications();
      if (user?.is_admin) {
        fetchAdminData();
      }
    }
  }, [token, user?.is_admin]);

  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`/api/${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  };

  const fetchUserData = async (authToken) => {
    try {
      const tempToken = token || authToken;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempToken}`,
      };
      const response = await fetch('/api/auth/me', { headers });
      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await apiCall('roles');
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchMarketplace = async () => {
    try {
      const data = await apiCall('marketplace');
      setMarketplace(data.items || []);
    } catch (error) {
      console.error('Failed to fetch marketplace:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await apiCall('leaderboard');
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const data = await apiCall('transactions');
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiCall('notifications');
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [usersData, transData, configData, logsData] = await Promise.all([
        apiCall('admin/users'),
        apiCall('admin/transactions'),
        apiCall('admin/config'),
        apiCall('admin/audit-logs'),
      ]);
      setAdminUsers(usersData.users || []);
      setAdminTransactions(transData.transactions || []);
      setAdminConfig(configData.config || {});
      setAuditLogs(logsData.logs || []);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = authMode === 'login' ? 'auth/login' : 'auth/register';
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      toast.success(data.message);
      setUsername('');
      setPassword('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    toast.info('Logged out');
  };

  const handleTransfer = async () => {
    if (!transferUsername || !transferAmount) {
      toast.error('Please enter username and amount');
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall('transfer', {
        method: 'POST',
        body: JSON.stringify({ to_username: transferUsername, amount: parseFloat(transferAmount) }),
      });
      toast.success(data.message);
      setTransferUsername('');
      setTransferAmount('');
      fetchUserData();
      fetchTransactions();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConversion = async () => {
    if (!conversionAmount) {
      toast.error('Please enter amount');
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall('convert', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(conversionAmount) }),
      });
      toast.success(data.message);
      setConversionAmount('');
      fetchUserData();
      fetchTransactions();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId, quantity) => {
    setLoading(true);
    try {
      const data = await apiCall('marketplace/purchase', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, quantity }),
      });
      toast.success(data.message);
      fetchUserData();
      fetchMarketplace();
      fetchTransactions();
      setSelectedItem(null);
      setPurchaseQuantity(1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminFreezeUser = async (userId, reason) => {
    try {
      await apiCall('admin/users/freeze', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, reason }),
      });
      toast.success('User frozen');
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdminUnfreezeUser = async (userId) => {
    try {
      await apiCall('admin/users/unfreeze', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success('User unfrozen');
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdminBanUser = async (userId, reason) => {
    try {
      await apiCall('admin/users/ban', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, reason }),
      });
      toast.success('User banned');
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdminAssignRole = async (userId, roleId) => {
    try {
      await apiCall('admin/users/assign-role', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role_id: roleId }),
      });
      toast.success('Role assigned');
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdminDistributeSalary = async () => {
    setLoading(true);
    try {
      const data = await apiCall('admin/salary/distribute', { method: 'POST' });
      toast.success(data.message);
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminInjectMoney = async (userId, amount, type) => {
    try {
      await apiCall('admin/treasury/inject', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, amount: parseFloat(amount), type }),
      });
      toast.success('Money injected');
      fetchAdminData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Auth Screen
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-950 via-black to-red-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="bg-yellow-500 rounded-full p-8 shadow-2xl border-4 border-red-700">
                <Hammer className="w-20 h-20 text-red-900" />
              </div>
            </div>
            <h1 className="text-6xl font-black text-yellow-400 mb-4 tracking-wider uppercase" style={{ textShadow: '4px 4px 8px rgba(0,0,0,0.8)' }}>
              USSR Economic System
            </h1>
            <p className="text-2xl text-red-300 font-bold uppercase tracking-wide">Workers of the World, Unite!</p>
          </div>

          <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500 shadow-2xl">
            <CardHeader className="border-b-4 border-yellow-500 bg-red-800">
              <CardTitle className="text-4xl font-black text-yellow-400 text-center uppercase tracking-wider">
                {authMode === 'login' ? 'State Authorization' : 'Citizen Registration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleAuth} className="space-y-6">
                <div>
                  <Label className="text-2xl font-bold text-yellow-300 mb-3 block uppercase">Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="h-14 text-xl bg-black text-white border-2 border-red-600 focus:border-yellow-500"
                    required
                  />
                </div>
                <div>
                  <Label className="text-2xl font-bold text-yellow-300 mb-3 block uppercase">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-14 text-xl bg-black text-white border-2 border-red-600 focus:border-yellow-500"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 text-2xl font-black bg-red-700 hover:bg-red-600 text-yellow-300 uppercase tracking-wider shadow-lg"
                >
                  {loading ? 'Processing...' : authMode === 'login' ? 'Enter System' : 'Register Citizen'}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-yellow-400 hover:text-yellow-300 font-bold text-xl uppercase underline"
                >
                  {authMode === 'login' ? 'Register New Citizen' : 'Return to Login'}
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-red-300 text-sm">
            <p className="font-bold uppercase tracking-wide">For the Glory of the Motherland</p>
          </div>
        </div>
      </div>
    );
  }

  // Main Application
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-black to-red-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-b-4 border-yellow-500 shadow-2xl">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="bg-yellow-500 rounded-full p-4 border-4 border-red-700">
                <Hammer className="w-12 h-12 text-red-900" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-yellow-400 uppercase tracking-wider" style={{ textShadow: '3px 3px 6px rgba(0,0,0,0.8)' }}>
                  USSR Economic System
                </h1>
                <p className="text-red-300 font-bold uppercase tracking-wide">Centralized State Control</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Card className="bg-black border-2 border-yellow-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <UserIcon className="w-8 h-8 text-yellow-400" />
                    <div>
                      <p className="text-yellow-400 font-black text-xl uppercase">{user.username}</p>
                      <p className="text-red-300 text-sm font-bold uppercase">{user.role}</p>
                      {user.is_admin && (
                        <Badge className="bg-red-700 text-yellow-300 border border-yellow-500 mt-1">
                          <ShieldIcon className="w-3 h-3 mr-1" />
                          STATE AUTHORITY
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-black px-4 py-2 rounded border-2 border-green-500">
                  <CoinsIcon className="w-6 h-6 text-green-400" />
                  <span className="text-2xl font-black text-green-400">{user.ruble_balance?.toFixed(2)}</span>
                  <span className="text-green-300 font-bold uppercase text-sm">Rubles</span>
                </div>
                <div className="flex items-center gap-2 bg-black px-4 py-2 rounded border-2 border-blue-500">
                  <Star className="w-6 h-6 text-blue-400" />
                  <span className="text-2xl font-black text-blue-400">{user.token_ruble_balance?.toFixed(2)}</span>
                  <span className="text-blue-300 font-bold uppercase text-sm">Token Rubles</span>
                </div>
              </div>

              <Button
                onClick={logout}
                variant="destructive"
                className="h-12 px-6 bg-red-700 hover:bg-red-600 text-yellow-300 font-bold uppercase border-2 border-yellow-500"
              >
                <LogOutIcon className="w-5 h-5 mr-2" />
                Exit System
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-red-900 border-2 border-yellow-500 p-2 flex flex-wrap gap-2 h-auto">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-red-900 text-yellow-300 font-bold uppercase px-6 py-3 text-base">
              <UserIcon className="w-5 h-5 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-red-900 text-yellow-300 font-bold uppercase px-6 py-3 text-base">
              <ShoppingCartIcon className="w-5 h-5 mr-2" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-red-900 text-yellow-300 font-bold uppercase px-6 py-3 text-base">
              <TrophyIcon className="w-5 h-5 mr-2" />
              Leaderboard
            </TabsTrigger>
            {user.is_admin && (
              <TabsTrigger value="admin" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-red-900 text-yellow-300 font-bold uppercase px-6 py-3 text-base">
                <ShieldIcon className="w-5 h-5 mr-2" />
                Admin Panel
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Transfer Card */}
              <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                  <CardTitle className="text-3xl font-black text-yellow-400 uppercase">Transfer Rubles</CardTitle>
                  <CardDescription className="text-red-300 text-lg font-bold">Send Rubles to fellow citizens</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-xl font-bold text-yellow-300 mb-2 block">Recipient Username</Label>
                    <Input
                      value={transferUsername}
                      onChange={(e) => setTransferUsername(e.target.value)}
                      placeholder="Enter username"
                      className="h-12 text-lg bg-black text-white border-2 border-red-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xl font-bold text-yellow-300 mb-2 block">Amount (Rubles)</Label>
                    <Input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-12 text-lg bg-black text-white border-2 border-red-600"
                    />
                  </div>
                  <Button
                    onClick={handleTransfer}
                    disabled={loading}
                    className="w-full h-14 text-xl font-black bg-red-700 hover:bg-red-600 text-yellow-300 uppercase"
                  >
                    Execute Transfer
                  </Button>
                </CardContent>
              </Card>

              {/* Conversion Card */}
              <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                  <CardTitle className="text-3xl font-black text-yellow-400 uppercase">Convert Token Rubles</CardTitle>
                  <CardDescription className="text-red-300 text-lg font-bold">Convert Token Rubles to Rubles</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-xl font-bold text-yellow-300 mb-2 block">Amount (Token Rubles)</Label>
                    <Input
                      type="number"
                      value={conversionAmount}
                      onChange={(e) => setConversionAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-12 text-lg bg-black text-white border-2 border-red-600"
                    />
                  </div>
                  <div className="bg-red-950 border-2 border-yellow-600 p-4 rounded">
                    <p className="text-yellow-400 font-bold text-lg">Current Rate: 0.8:1</p>
                    <p className="text-red-300 text-sm">You will receive 80% of Token Rubles as Rubles</p>
                  </div>
                  <Button
                    onClick={handleConversion}
                    disabled={loading}
                    className="w-full h-14 text-xl font-black bg-red-700 hover:bg-red-600 text-yellow-300 uppercase"
                  >
                    Execute Conversion
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Notifications */}
            <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
              <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                <CardTitle className="text-3xl font-black text-yellow-400 uppercase flex items-center gap-3">
                  <BellIcon className="w-8 h-8" />
                  State Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="h-96">
                  {notifications.length === 0 ? (
                    <p className="text-red-300 text-center text-lg font-bold py-8">No notifications from the state</p>
                  ) : (
                    <div className="space-y-4">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 rounded border-2 ${
                            notif.type === 'success'
                              ? 'bg-green-950 border-green-500'
                              : notif.type === 'error'
                              ? 'bg-red-950 border-red-500'
                              : 'bg-gray-900 border-gray-500'
                          }`}
                        >
                          <h4 className="font-black text-xl text-yellow-400 mb-2">{notif.title}</h4>
                          <p className="text-red-200 text-lg">{notif.message}</p>
                          <p className="text-red-400 text-sm mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
              <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                <CardTitle className="text-3xl font-black text-yellow-400 uppercase">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="h-96">
                  {transactions.length === 0 ? (
                    <p className="text-red-300 text-center text-lg font-bold py-8">No transactions recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 20).map((trans) => (
                        <div key={trans.id} className="bg-black border-2 border-red-600 p-4 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <Badge className="bg-yellow-600 text-black mb-2">{trans.transaction_type.toUpperCase()}</Badge>
                              <p className="text-white text-lg font-bold">{trans.description}</p>
                              {trans.from_username && <p className="text-red-300 text-sm">From: {trans.from_username}</p>}
                              {trans.to_username && <p className="text-green-300 text-sm">To: {trans.to_username}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-green-400">₽ {parseFloat(trans.amount).toFixed(2)}</p>
                              <p className="text-red-400 text-xs">{new Date(trans.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace">
            <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
              <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                <CardTitle className="text-4xl font-black text-yellow-400 uppercase flex items-center gap-3">
                  <ShoppingCartIcon className="w-10 h-10" />
                  State Marketplace
                </CardTitle>
                <CardDescription className="text-red-300 text-xl font-bold">Limited stock items controlled by the state</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {marketplace.length === 0 ? (
                  <p className="text-red-300 text-center text-lg font-bold py-8">No items available</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {marketplace.map((item) => (
                      <Card key={item.id} className="bg-black border-4 border-red-600 hover:border-yellow-500 transition-all">
                        <CardHeader className="border-b-2 border-red-600 bg-red-950">
                          <CardTitle className="text-2xl font-black text-yellow-400 uppercase">{item.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <p className="text-red-200 text-lg">{item.description}</p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-yellow-300 font-bold text-lg uppercase">Price:</span>
                              <span className="text-2xl font-black text-green-400">₽ {parseFloat(item.price).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-yellow-300 font-bold text-lg uppercase">Stock:</span>
                              <Badge className={item.stock > 0 ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}>
                                {item.stock} units
                              </Badge>
                            </div>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                disabled={item.stock === 0}
                                className="w-full h-12 text-lg font-black bg-red-700 hover:bg-red-600 text-yellow-300 uppercase disabled:opacity-50"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setPurchaseQuantity(1);
                                }}
                              >
                                {item.stock > 0 ? 'Purchase' : 'Out of Stock'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-red-900 border-4 border-yellow-500 text-white">
                              <DialogHeader>
                                <DialogTitle className="text-3xl font-black text-yellow-400">{selectedItem?.name}</DialogTitle>
                                <DialogDescription className="text-red-300 text-lg">{selectedItem?.description}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-xl font-bold text-yellow-300">Quantity</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={selectedItem?.stock}
                                    value={purchaseQuantity}
                                    onChange={(e) => setPurchaseQuantity(parseInt(e.target.value) || 1)}
                                    className="h-12 text-lg bg-black text-white border-2 border-red-600"
                                  />
                                </div>
                                <div className="bg-black border-2 border-yellow-600 p-4 rounded">
                                  <p className="text-yellow-400 font-bold text-xl">
                                    Total: ₽ {(parseFloat(selectedItem?.price || 0) * purchaseQuantity).toFixed(2)}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => handlePurchase(selectedItem?.id, purchaseQuantity)}
                                  disabled={loading}
                                  className="w-full h-14 text-xl font-black bg-red-700 hover:bg-red-600 text-yellow-300 uppercase"
                                >
                                  Confirm Purchase
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
              <CardHeader className="border-b-2 border-yellow-500 bg-red-800">
                <CardTitle className="text-4xl font-black text-yellow-400 uppercase flex items-center gap-3">
                  <TrophyIcon className="w-10 h-10" />
                  Weekly Citizens Leaderboard
                </CardTitle>
                <CardDescription className="text-red-300 text-xl font-bold">Top citizens of the motherland</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {leaderboard.length === 0 ? (
                  <p className="text-red-300 text-center text-lg font-bold py-8">No rankings available</p>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {leaderboard.map((entry, index) => (
                        <div
                          key={index}
                          className={`p-6 rounded border-4 ${
                            index === 0
                              ? 'bg-gradient-to-r from-yellow-600 to-yellow-800 border-yellow-400'
                              : index === 1
                              ? 'bg-gradient-to-r from-gray-400 to-gray-600 border-gray-300'
                              : index === 2
                              ? 'bg-gradient-to-r from-orange-600 to-orange-800 border-orange-400'
                              : 'bg-black border-red-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="text-5xl font-black">
                                {index === 0 && <span>🥇</span>}
                                {index === 1 && <span>🥈</span>}
                                {index === 2 && <span>🥉</span>}
                                {index > 2 && <span className="text-yellow-400">#{parseInt(entry.rank)}</span>}
                              </div>
                              <div>
                                <p className={`text-3xl font-black uppercase ${index < 3 ? 'text-black' : 'text-yellow-400'}`}>
                                  {entry.username}
                                </p>
                                <p className={`text-xl font-bold ${index < 3 ? 'text-gray-800' : 'text-red-300'}`}>{entry.role}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-4xl font-black ${index < 3 ? 'text-black' : 'text-green-400'}`}>
                                ₽ {parseFloat(entry.total_wealth).toFixed(2)}
                              </p>
                              <p className={`text-sm font-bold uppercase ${index < 3 ? 'text-gray-800' : 'text-red-300'}`}>Total Wealth</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Panel Tab */}
          {user.is_admin && (
            <TabsContent value="admin" className="space-y-8">
              <div className="bg-yellow-500 border-4 border-red-700 p-6 rounded-lg">
                <h2 className="text-4xl font-black text-red-900 uppercase flex items-center gap-3">
                  <ShieldIcon className="w-10 h-10" />
                  State Authority Control Panel
                </h2>
              </div>

              {/* Admin Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                  <CardHeader className="bg-red-800 border-b-2 border-yellow-500">
                    <CardTitle className="text-2xl font-black text-yellow-400 uppercase">Distribute Salaries</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Button
                      onClick={handleAdminDistributeSalary}
                      disabled={loading}
                      className="w-full h-14 text-xl font-black bg-green-700 hover:bg-green-600 text-white uppercase"
                    >
                      <CoinsIcon className="w-6 h-6 mr-2" />
                      Pay All Citizens
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                  <CardHeader className="bg-red-800 border-b-2 border-yellow-500">
                    <CardTitle className="text-2xl font-black text-yellow-400 uppercase">System Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-yellow-300 font-bold text-lg">Total Citizens:</span>
                      <span className="text-2xl font-black text-white">{adminUsers.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-yellow-300 font-bold text-lg">Total Transactions:</span>
                      <span className="text-2xl font-black text-white">{adminTransactions.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                  <CardHeader className="bg-red-800 border-b-2 border-yellow-500">
                    <CardTitle className="text-2xl font-black text-yellow-400 uppercase">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    <Button className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold uppercase" onClick={fetchAdminData}>
                      <RefreshCwIcon className="w-5 h-5 mr-2" />
                      Refresh Data
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* User Management Table */}
              <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                <CardHeader className="bg-red-800 border-b-2 border-yellow-500">
                  <CardTitle className="text-3xl font-black text-yellow-400 uppercase">Citizen Management</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-yellow-500">
                          <TableHead className="text-yellow-400 font-black text-lg uppercase">Username</TableHead>
                          <TableHead className="text-yellow-400 font-black text-lg uppercase">Role</TableHead>
                          <TableHead className="text-yellow-400 font-black text-lg uppercase">Rubles</TableHead>
                          <TableHead className="text-yellow-400 font-black text-lg uppercase">Status</TableHead>
                          <TableHead className="text-yellow-400 font-black text-lg uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminUsers.map((u) => (
                          <TableRow key={u.id} className="border-b border-red-700">
                            <TableCell className="text-white font-bold text-lg">{u.username}</TableCell>
                            <TableCell className="text-yellow-300 font-bold">{u.role_name}</TableCell>
                            <TableCell className="text-green-400 font-bold">₽ {parseFloat(u.ruble_balance).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  u.account_status === 'active'
                                    ? 'bg-green-700'
                                    : u.account_status === 'frozen'
                                    ? 'bg-blue-700'
                                    : 'bg-red-700'
                                }
                              >
                                {u.account_status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {u.account_status === 'active' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAdminFreezeUser(u.id, 'Administrative action')}
                                    className="font-bold uppercase"
                                  >
                                    Freeze
                                  </Button>
                                )}
                                {u.account_status === 'frozen' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAdminUnfreezeUser(u.id)}
                                    className="bg-green-700 hover:bg-green-600 font-bold uppercase"
                                  >
                                    Unfreeze
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleAdminBanUser(u.id, 'State decision')}
                                  className="font-bold uppercase"
                                >
                                  Ban
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Transaction History */}
              <Card className="bg-gradient-to-b from-red-900 to-black border-4 border-yellow-500">
                <CardHeader className="bg-red-800 border-b-2 border-yellow-500">
                  <CardTitle className="text-3xl font-black text-yellow-400 uppercase">All Transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {adminTransactions.slice(0, 50).map((trans) => (
                        <div key={trans.id} className="bg-black border-2 border-red-600 p-4 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <Badge className="bg-yellow-600 text-black mb-2">{trans.transaction_type.toUpperCase()}</Badge>
                              <p className="text-white text-lg font-bold">{trans.description}</p>
                              {trans.from_username && <p className="text-red-300 text-sm">From: {trans.from_username}</p>}
                              {trans.to_username && <p className="text-green-300 text-sm">To: {trans.to_username}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-green-400">₽ {parseFloat(trans.amount).toFixed(2)}</p>
                              <p className="text-red-400 text-xs">{new Date(trans.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-t-4 border-yellow-500 py-8 mt-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Flag className="w-8 h-8 text-red-500" />
            <p className="text-2xl font-black text-yellow-400 uppercase tracking-wider">Glory to the Motherland</p>
            <Flag className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-red-300 font-bold uppercase">Centralized Economic System • State Authority Control</p>
        </div>
      </footer>
    </div>
  );
}
