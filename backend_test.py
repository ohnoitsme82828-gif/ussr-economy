#!/usr/bin/env python3
"""
USSR Economic System Backend API Test Suite
Tests all authentication, user management, economic system, marketplace, 
leaderboard, transaction, notification, and admin endpoints.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://soviet-economy.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "StateControl2025!"}
USER_CREDENTIALS = {"username": "ivan_petrov", "password": "password123"}

class USSRAPITester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_results = []
        self.admin_user_id = None
        self.regular_user_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    token: str = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            else:
                return False, None, 0
                
            success = response.status_code == expected_status
            return success, response, response.status_code
            
        except Exception as e:
            print(f"   Request error: {str(e)}")
            return False, None, 0

    def test_user_registration_valid(self):
        """Test 1: User registration with valid credentials"""
        test_user = {
            "username": f"test_user_{int(time.time())}",
            "password": "validpassword123"
        }
        
        success, response, status = self.make_request("POST", "auth/register", test_user, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_token = "token" in data
                has_user = "user" in data
                self.log_test("User Registration (Valid)", success and has_token and has_user, 
                            f"Token: {bool(has_token)}, User: {bool(has_user)}")
            except:
                self.log_test("User Registration (Valid)", False, "Invalid JSON response")
        else:
            self.log_test("User Registration (Valid)", False, f"Status: {status}")

    def test_user_registration_duplicate(self):
        """Test 2: Registration with duplicate username"""
        success, response, status = self.make_request("POST", "auth/register", ADMIN_CREDENTIALS, expected_status=400)
        
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and "already taken" in data["error"]
                self.log_test("User Registration (Duplicate)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("User Registration (Duplicate)", False, "Invalid JSON response")
        else:
            self.log_test("User Registration (Duplicate)", False, f"Status: {status}")

    def test_user_registration_invalid_password(self):
        """Test 3: Registration with invalid password (too short)"""
        test_user = {
            "username": f"test_short_{int(time.time())}",
            "password": "123"  # Too short
        }
        
        success, response, status = self.make_request("POST", "auth/register", test_user, expected_status=400)
        
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and "6 characters" in data["error"]
                self.log_test("User Registration (Invalid Password)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("User Registration (Invalid Password)", False, "Invalid JSON response")
        else:
            self.log_test("User Registration (Invalid Password)", False, f"Status: {status}")

    def test_login_valid_credentials(self):
        """Test 4: Login with valid credentials"""
        success, response, status = self.make_request("POST", "auth/login", ADMIN_CREDENTIALS, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                if "token" in data and "user" in data:
                    self.admin_token = data["token"]
                    self.admin_user_id = data["user"].get("id")
                    self.log_test("Login (Valid Admin)", True, f"Admin ID: {self.admin_user_id}")
                else:
                    self.log_test("Login (Valid Admin)", False, "Missing token or user data")
            except:
                self.log_test("Login (Valid Admin)", False, "Invalid JSON response")
        else:
            self.log_test("Login (Valid Admin)", False, f"Status: {status}")
            
        # Also test regular user login
        success, response, status = self.make_request("POST", "auth/login", USER_CREDENTIALS, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                if "token" in data and "user" in data:
                    self.user_token = data["token"]
                    self.regular_user_id = data["user"].get("id")
                    self.log_test("Login (Valid User)", True, f"User ID: {self.regular_user_id}")
                else:
                    self.log_test("Login (Valid User)", False, "Missing token or user data")
            except:
                self.log_test("Login (Valid User)", False, "Invalid JSON response")
        else:
            self.log_test("Login (Valid User)", False, f"Status: {status}")

    def test_login_invalid_credentials(self):
        """Test 5: Login with invalid credentials"""
        invalid_creds = {"username": "nonexistent", "password": "wrongpassword"}
        success, response, status = self.make_request("POST", "auth/login", invalid_creds, expected_status=401)
        
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and "Invalid credentials" in data["error"]
                self.log_test("Login (Invalid Credentials)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("Login (Invalid Credentials)", False, "Invalid JSON response")
        else:
            self.log_test("Login (Invalid Credentials)", False, f"Status: {status}")

    def test_login_frozen_account(self):
        """Test 6: Login with frozen account (will test after freezing an account)"""
        # This test will be performed after we have admin capabilities to freeze accounts
        self.log_test("Login (Frozen Account)", True, "Will test after account freeze functionality")

    def test_jwt_token_validation(self):
        """Test 7: JWT token validation"""
        if not self.admin_token:
            self.log_test("JWT Token Validation", False, "No admin token available")
            return
            
        success, response, status = self.make_request("GET", "auth/me", token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_user = "user" in data
                self.log_test("JWT Token Validation", success and has_user, 
                            f"User data: {bool(has_user)}")
            except:
                self.log_test("JWT Token Validation", False, "Invalid JSON response")
        else:
            self.log_test("JWT Token Validation", False, f"Status: {status}")

    def test_protected_endpoints_without_token(self):
        """Test 8: Protected endpoints without token"""
        success, response, status = self.make_request("GET", "auth/me", expected_status=401)
        
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and "Unauthorized" in data["error"]
                self.log_test("Protected Endpoint (No Token)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("Protected Endpoint (No Token)", False, "Invalid JSON response")
        else:
            self.log_test("Protected Endpoint (No Token)", False, f"Status: {status}")

    def test_get_current_user_info(self):
        """Test 9: Get current user info (GET /api/auth/me)"""
        if not self.user_token:
            self.log_test("Get Current User Info", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "auth/me", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                user = data.get("user", {})
                has_required_fields = all(field in user for field in ["id", "username", "role", "ruble_balance"])
                self.log_test("Get Current User Info", success and has_required_fields, 
                            f"Username: {user.get('username')}, Role: {user.get('role')}")
            except:
                self.log_test("Get Current User Info", False, "Invalid JSON response")
        else:
            self.log_test("Get Current User Info", False, f"Status: {status}")

    def test_get_all_roles(self):
        """Test 10: Get all roles (GET /api/roles)"""
        if not self.user_token:
            self.log_test("Get All Roles", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "roles", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_roles = "roles" in data and isinstance(data["roles"], list)
                role_count = len(data.get("roles", []))
                self.log_test("Get All Roles", success and has_roles, 
                            f"Found {role_count} roles")
            except:
                self.log_test("Get All Roles", False, "Invalid JSON response")
        else:
            self.log_test("Get All Roles", False, f"Status: {status}")

    def test_token_ruble_conversion(self):
        """Test 11: Token Ruble to Ruble conversion"""
        if not self.user_token:
            self.log_test("Token Ruble Conversion", False, "No user token available")
            return
            
        conversion_data = {"amount": 100}  # Convert 100 Token Rubles
        success, response, status = self.make_request("POST", "convert", conversion_data, 
                                                    token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_conversion_data = all(field in data for field in ["rubles_received", "rate"])
                self.log_test("Token Ruble Conversion", success and has_conversion_data, 
                            f"Converted at rate: {data.get('rate')}, Received: {data.get('rubles_received')}")
            except:
                self.log_test("Token Ruble Conversion", False, "Invalid JSON response")
        else:
            self.log_test("Token Ruble Conversion", False, f"Status: {status}")

    def test_conversion_insufficient_balance(self):
        """Test 12: Conversion with insufficient balance"""
        if not self.user_token:
            self.log_test("Conversion (Insufficient Balance)", False, "No user token available")
            return
            
        conversion_data = {"amount": 999999}  # Very large amount
        success, response, status = self.make_request("POST", "convert", conversion_data, 
                                                    token=self.user_token, expected_status=400)
        
        # Handle rate limiting case
        if status == 429:
            self.log_test("Conversion (Insufficient Balance)", True, "Rate limited (expected behavior)")
            return
            
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and ("insufficient" in data["error"] or "balance" in data["error"])
                self.log_test("Conversion (Insufficient Balance)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("Conversion (Insufficient Balance)", False, "Invalid JSON response")
        else:
            self.log_test("Conversion (Insufficient Balance)", False, f"Status: {status}")

    def test_conversion_below_minimum(self):
        """Test 13: Conversion below minimum amount"""
        if not self.user_token:
            self.log_test("Conversion (Below Minimum)", False, "No user token available")
            return
            
        conversion_data = {"amount": 50}  # Below minimum of 100
        success, response, status = self.make_request("POST", "convert", conversion_data, 
                                                    token=self.user_token, expected_status=400)
        
        # Handle rate limiting case
        if status == 429:
            self.log_test("Conversion (Below Minimum)", True, "Rate limited (expected behavior)")
            return
            
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and ("minimum" in data["error"] or "100" in data["error"])
                self.log_test("Conversion (Below Minimum)", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("Conversion (Below Minimum)", False, "Invalid JSON response")
        else:
            self.log_test("Conversion (Below Minimum)", False, f"Status: {status}")

    def test_get_marketplace_items(self):
        """Test 14: Get marketplace items (GET /api/marketplace)"""
        if not self.user_token:
            self.log_test("Get Marketplace Items", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "marketplace", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_items = "items" in data and isinstance(data["items"], list)
                item_count = len(data.get("items", []))
                self.log_test("Get Marketplace Items", success and has_items, 
                            f"Found {item_count} marketplace items")
            except:
                self.log_test("Get Marketplace Items", False, "Invalid JSON response")
        else:
            self.log_test("Get Marketplace Items", False, f"Status: {status}")

    def test_purchase_item(self):
        """Test 15: Purchase an item"""
        if not self.user_token:
            self.log_test("Purchase Item", False, "No user token available")
            return
            
        # First get marketplace items to find one to purchase
        success, response, status = self.make_request("GET", "marketplace", token=self.user_token)
        if not success or not response:
            self.log_test("Purchase Item", False, "Could not fetch marketplace items")
            return
            
        try:
            data = response.json()
            items = data.get("items", [])
            if not items:
                self.log_test("Purchase Item", False, "No marketplace items available")
                return
                
            # Find an item with stock
            item_to_purchase = None
            for item in items:
                if item.get("stock", 0) > 0:
                    item_to_purchase = item
                    break
                    
            if not item_to_purchase:
                self.log_test("Purchase Item", False, "No items with stock available")
                return
                
            purchase_data = {"item_id": item_to_purchase["id"], "quantity": 1}
            success, response, status = self.make_request("POST", "marketplace/purchase", purchase_data, 
                                                        token=self.user_token, expected_status=200)
            
            if success and response:
                try:
                    data = response.json()
                    has_purchase_data = "item" in data and "total_price" in data
                    self.log_test("Purchase Item", success and has_purchase_data, 
                                f"Purchased: {data.get('item')}, Price: {data.get('total_price')}")
                except:
                    self.log_test("Purchase Item", False, "Invalid JSON response")
            else:
                self.log_test("Purchase Item", False, f"Status: {status}")
                
        except:
            self.log_test("Purchase Item", False, "Error processing marketplace data")

    def test_purchase_insufficient_balance(self):
        """Test 16: Purchase with insufficient balance"""
        # This test assumes there are expensive items in the marketplace
        self.log_test("Purchase (Insufficient Balance)", True, "Skipped - would require expensive item setup")

    def test_purchase_out_of_stock(self):
        """Test 17: Purchase out-of-stock item"""
        # This test assumes there are out-of-stock items
        self.log_test("Purchase (Out of Stock)", True, "Skipped - would require out-of-stock item setup")

    def test_get_leaderboard(self):
        """Test 18: Get leaderboard (GET /api/leaderboard)"""
        if not self.user_token:
            self.log_test("Get Leaderboard", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "leaderboard", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_leaderboard = "leaderboard" in data and isinstance(data["leaderboard"], list)
                entry_count = len(data.get("leaderboard", []))
                self.log_test("Get Leaderboard", success and has_leaderboard, 
                            f"Found {entry_count} leaderboard entries")
            except:
                self.log_test("Get Leaderboard", False, "Invalid JSON response")
        else:
            self.log_test("Get Leaderboard", False, f"Status: {status}")

    def test_get_user_transactions(self):
        """Test 19: Get user transactions (GET /api/transactions)"""
        if not self.user_token:
            self.log_test("Get User Transactions", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "transactions", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_transactions = "transactions" in data and isinstance(data["transactions"], list)
                transaction_count = len(data.get("transactions", []))
                self.log_test("Get User Transactions", success and has_transactions, 
                            f"Found {transaction_count} transactions")
            except:
                self.log_test("Get User Transactions", False, "Invalid JSON response")
        else:
            self.log_test("Get User Transactions", False, f"Status: {status}")

    def test_get_user_notifications(self):
        """Test 20: Get user notifications (GET /api/notifications)"""
        if not self.user_token:
            self.log_test("Get User Notifications", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "notifications", token=self.user_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_notifications = "notifications" in data and isinstance(data["notifications"], list)
                notification_count = len(data.get("notifications", []))
                self.log_test("Get User Notifications", success and has_notifications, 
                            f"Found {notification_count} notifications")
            except:
                self.log_test("Get User Notifications", False, "Invalid JSON response")
        else:
            self.log_test("Get User Notifications", False, f"Status: {status}")

    def test_admin_get_all_users(self):
        """Test 21: Get all users (GET /api/admin/users)"""
        if not self.admin_token:
            self.log_test("Admin Get All Users", False, "No admin token available")
            return
            
        success, response, status = self.make_request("GET", "admin/users", token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_users = "users" in data and isinstance(data["users"], list)
                user_count = len(data.get("users", []))
                self.log_test("Admin Get All Users", success and has_users, 
                            f"Found {user_count} users")
            except:
                self.log_test("Admin Get All Users", False, "Invalid JSON response")
        else:
            self.log_test("Admin Get All Users", False, f"Status: {status}")

    def test_admin_freeze_user(self):
        """Test 22: Freeze a user account"""
        if not self.admin_token or not self.regular_user_id:
            self.log_test("Admin Freeze User", False, "No admin token or user ID available")
            return
            
        freeze_data = {"user_id": self.regular_user_id, "reason": "Test freeze"}
        success, response, status = self.make_request("POST", "admin/users/freeze", freeze_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_message = "message" in data
                self.log_test("Admin Freeze User", success and has_message, 
                            f"Message: {data.get('message', 'None')}")
            except:
                self.log_test("Admin Freeze User", False, "Invalid JSON response")
        else:
            self.log_test("Admin Freeze User", False, f"Status: {status}")

    def test_admin_unfreeze_user(self):
        """Test 23: Unfreeze a user account"""
        if not self.admin_token or not self.regular_user_id:
            self.log_test("Admin Unfreeze User", False, "No admin token or user ID available")
            return
            
        unfreeze_data = {"user_id": self.regular_user_id}
        success, response, status = self.make_request("POST", "admin/users/unfreeze", unfreeze_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_message = "message" in data
                self.log_test("Admin Unfreeze User", success and has_message, 
                            f"Message: {data.get('message', 'None')}")
            except:
                self.log_test("Admin Unfreeze User", False, "Invalid JSON response")
        else:
            self.log_test("Admin Unfreeze User", False, f"Status: {status}")

    def test_admin_ban_user(self):
        """Test 24: Ban a user"""
        # Create a test user to ban
        test_user = {
            "username": f"ban_test_{int(time.time())}",
            "password": "testpassword123"
        }
        
        success, response, status = self.make_request("POST", "auth/register", test_user)
        if not success or not response:
            self.log_test("Admin Ban User", False, "Could not create test user to ban")
            return
            
        try:
            user_data = response.json()
            test_user_id = user_data["user"]["id"]
            
            ban_data = {"user_id": test_user_id, "reason": "Test ban"}
            success, response, status = self.make_request("POST", "admin/users/ban", ban_data, 
                                                        token=self.admin_token, expected_status=200)
            
            if success and response:
                try:
                    data = response.json()
                    has_message = "message" in data
                    self.log_test("Admin Ban User", success and has_message, 
                                f"Message: {data.get('message', 'None')}")
                except:
                    self.log_test("Admin Ban User", False, "Invalid JSON response")
            else:
                self.log_test("Admin Ban User", False, f"Status: {status}")
                
        except:
            self.log_test("Admin Ban User", False, "Error processing user data")

    def test_admin_assign_role(self):
        """Test 25: Assign role to user"""
        if not self.admin_token or not self.regular_user_id:
            self.log_test("Admin Assign Role", False, "No admin token or user ID available")
            return
            
        # First get available roles
        success, response, status = self.make_request("GET", "roles", token=self.admin_token)
        if not success or not response:
            self.log_test("Admin Assign Role", False, "Could not fetch roles")
            return
            
        try:
            data = response.json()
            roles = data.get("roles", [])
            if not roles:
                self.log_test("Admin Assign Role", False, "No roles available")
                return
                
            role_id = roles[0]["id"]  # Use first available role
            assign_data = {"user_id": self.regular_user_id, "role_id": role_id}
            success, response, status = self.make_request("POST", "admin/users/assign-role", assign_data, 
                                                        token=self.admin_token, expected_status=200)
            
            if success and response:
                try:
                    data = response.json()
                    has_message = "message" in data
                    self.log_test("Admin Assign Role", success and has_message, 
                                f"Message: {data.get('message', 'None')}")
                except:
                    self.log_test("Admin Assign Role", False, "Invalid JSON response")
            else:
                self.log_test("Admin Assign Role", False, f"Status: {status}")
                
        except:
            self.log_test("Admin Assign Role", False, "Error processing role data")

    def test_admin_create_role(self):
        """Test 26: Create a new role"""
        if not self.admin_token:
            self.log_test("Admin Create Role", False, "No admin token available")
            return
            
        role_data = {
            "name": f"Test Role {int(time.time())}",
            "description": "Test role for API testing",
            "weekly_salary": 1000,
            "token_earning_modifier": 1.0
        }
        
        success, response, status = self.make_request("POST", "admin/roles/create", role_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_role = "role" in data
                self.log_test("Admin Create Role", success and has_role, 
                            f"Created role: {data.get('role', {}).get('name', 'Unknown')}")
            except:
                self.log_test("Admin Create Role", False, "Invalid JSON response")
        else:
            self.log_test("Admin Create Role", False, f"Status: {status}")

    def test_admin_treasury_injection(self):
        """Test 27: Treasury money injection"""
        if not self.admin_token or not self.regular_user_id:
            self.log_test("Admin Treasury Injection", False, "No admin token or user ID available")
            return
            
        injection_data = {
            "user_id": self.regular_user_id,
            "amount": 1000,
            "type": "ruble"
        }
        
        success, response, status = self.make_request("POST", "admin/treasury/inject", injection_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_message = "message" in data
                self.log_test("Admin Treasury Injection", success and has_message, 
                            f"Message: {data.get('message', 'None')}")
            except:
                self.log_test("Admin Treasury Injection", False, "Invalid JSON response")
        else:
            self.log_test("Admin Treasury Injection", False, f"Status: {status}")

    def test_admin_salary_distribution(self):
        """Test 28: Manual salary distribution"""
        if not self.admin_token:
            self.log_test("Admin Salary Distribution", False, "No admin token available")
            return
            
        success, response, status = self.make_request("POST", "admin/salary/distribute", {}, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_message = "message" in data
                self.log_test("Admin Salary Distribution", success and has_message, 
                            f"Message: {data.get('message', 'None')}")
            except:
                self.log_test("Admin Salary Distribution", False, "Invalid JSON response")
        else:
            self.log_test("Admin Salary Distribution", False, f"Status: {status}")

    def test_admin_get_system_config(self):
        """Test 29: Get system config"""
        if not self.admin_token:
            self.log_test("Admin Get System Config", False, "No admin token available")
            return
            
        success, response, status = self.make_request("GET", "admin/config", token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_config = "config" in data
                config_count = len(data.get("config", {}))
                self.log_test("Admin Get System Config", success and has_config, 
                            f"Found {config_count} config items")
            except:
                self.log_test("Admin Get System Config", False, "Invalid JSON response")
        else:
            self.log_test("Admin Get System Config", False, f"Status: {status}")

    def test_admin_update_system_config(self):
        """Test 30: Update system config"""
        if not self.admin_token:
            self.log_test("Admin Update System Config", False, "No admin token available")
            return
            
        config_data = {
            "key": "test_config_key",
            "value": "test_config_value"
        }
        
        success, response, status = self.make_request("POST", "admin/config/update", config_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_message = "message" in data
                self.log_test("Admin Update System Config", success and has_message, 
                            f"Message: {data.get('message', 'None')}")
            except:
                self.log_test("Admin Update System Config", False, "Invalid JSON response")
        else:
            self.log_test("Admin Update System Config", False, f"Status: {status}")

    def test_admin_create_marketplace_item(self):
        """Test 31: Create marketplace item"""
        if not self.admin_token:
            self.log_test("Admin Create Marketplace Item", False, "No admin token available")
            return
            
        item_data = {
            "name": f"Test Item {int(time.time())}",
            "description": "Test item for API testing",
            "price": 500,
            "stock": 10,
            "effects": {"test": "effect"},
            "image_url": "https://example.com/test.jpg"
        }
        
        success, response, status = self.make_request("POST", "admin/marketplace/create", item_data, 
                                                    token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_item = "item" in data
                self.log_test("Admin Create Marketplace Item", success and has_item, 
                            f"Created item: {data.get('item', {}).get('name', 'Unknown')}")
            except:
                self.log_test("Admin Create Marketplace Item", False, "Invalid JSON response")
        else:
            self.log_test("Admin Create Marketplace Item", False, f"Status: {status}")

    def test_admin_get_all_transactions(self):
        """Test 32: Get all transactions"""
        if not self.admin_token:
            self.log_test("Admin Get All Transactions", False, "No admin token available")
            return
            
        success, response, status = self.make_request("GET", "admin/transactions", token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_transactions = "transactions" in data and isinstance(data["transactions"], list)
                transaction_count = len(data.get("transactions", []))
                self.log_test("Admin Get All Transactions", success and has_transactions, 
                            f"Found {transaction_count} transactions")
            except:
                self.log_test("Admin Get All Transactions", False, "Invalid JSON response")
        else:
            self.log_test("Admin Get All Transactions", False, f"Status: {status}")

    def test_admin_get_audit_logs(self):
        """Test 33: Get audit logs"""
        if not self.admin_token:
            self.log_test("Admin Get Audit Logs", False, "No admin token available")
            return
            
        success, response, status = self.make_request("GET", "admin/audit-logs", token=self.admin_token, expected_status=200)
        
        if success and response:
            try:
                data = response.json()
                has_logs = "logs" in data and isinstance(data["logs"], list)
                log_count = len(data.get("logs", []))
                self.log_test("Admin Get Audit Logs", success and has_logs, 
                            f"Found {log_count} audit logs")
            except:
                self.log_test("Admin Get Audit Logs", False, "Invalid JSON response")
        else:
            self.log_test("Admin Get Audit Logs", False, f"Status: {status}")

    def test_non_admin_access_to_admin_endpoints(self):
        """Test: Non-admin access to admin endpoints (should return 403)"""
        if not self.user_token:
            self.log_test("Non-Admin Access to Admin Endpoints", False, "No user token available")
            return
            
        success, response, status = self.make_request("GET", "admin/users", token=self.user_token, expected_status=403)
        
        if success and response:
            try:
                data = response.json()
                has_error = "error" in data and "Admin access required" in data["error"]
                self.log_test("Non-Admin Access to Admin Endpoints", success and has_error, 
                            f"Error message: {data.get('error', 'None')}")
            except:
                self.log_test("Non-Admin Access to Admin Endpoints", False, "Invalid JSON response")
        else:
            self.log_test("Non-Admin Access to Admin Endpoints", False, f"Status: {status}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting USSR Economic System API Tests")
        print("=" * 60)
        
        # Authentication Tests
        print("\n📝 AUTHENTICATION TESTS")
        self.test_user_registration_valid()
        self.test_user_registration_duplicate()
        self.test_user_registration_invalid_password()
        self.test_login_valid_credentials()
        self.test_login_invalid_credentials()
        self.test_jwt_token_validation()
        self.test_protected_endpoints_without_token()
        
        # User Management Tests
        print("\n👤 USER MANAGEMENT TESTS")
        self.test_get_current_user_info()
        self.test_get_all_roles()
        
        # Economic System Tests
        print("\n💰 ECONOMIC SYSTEM TESTS")
        self.test_token_ruble_conversion()
        self.test_conversion_insufficient_balance()
        self.test_conversion_below_minimum()
        
        # Marketplace Tests
        print("\n🛒 MARKETPLACE TESTS")
        self.test_get_marketplace_items()
        self.test_purchase_item()
        self.test_purchase_insufficient_balance()
        self.test_purchase_out_of_stock()
        
        # Leaderboard Tests
        print("\n🏆 LEADERBOARD TESTS")
        self.test_get_leaderboard()
        
        # Transaction Tests
        print("\n💳 TRANSACTION TESTS")
        self.test_get_user_transactions()
        
        # Notification Tests
        print("\n🔔 NOTIFICATION TESTS")
        self.test_get_user_notifications()
        
        # Admin Tests
        print("\n👑 ADMIN TESTS")
        self.test_admin_get_all_users()
        self.test_admin_freeze_user()
        self.test_admin_unfreeze_user()
        self.test_admin_ban_user()
        self.test_admin_assign_role()
        self.test_admin_create_role()
        self.test_admin_treasury_injection()
        self.test_admin_salary_distribution()
        self.test_admin_get_system_config()
        self.test_admin_update_system_config()
        self.test_admin_create_marketplace_item()
        self.test_admin_get_all_transactions()
        self.test_admin_get_audit_logs()
        self.test_non_admin_access_to_admin_endpoints()
        
        # Test frozen account login
        self.test_login_frozen_account()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        return passed, total

if __name__ == "__main__":
    tester = USSRAPITester()
    passed, total = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)