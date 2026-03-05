#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class VRDesktopAPITester:
    def __init__(self, base_url="https://headset-hub-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_base}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed - Status: {response.status_code}")
                try:
                    resp_json = response.json()
                    print(f"   📝 Response: {json.dumps(resp_json, indent=2)[:200]}...")
                except:
                    print(f"   📝 Response: {response.text[:200]}...")
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   📝 Response: {response.text}")
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text
                })

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'error': str(e)
            })
            return False, {}

    def test_basic_endpoints(self):
        """Test basic API endpoints"""
        print("🚀 Testing Basic Endpoints...")
        
        # Test root API endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Test status check creation
        status_data = {"client_name": "test_client"}
        success, response = self.run_test("Create Status Check", "POST", "status", 200, data=status_data)
        
        # Test status check retrieval
        self.run_test("Get Status Checks", "GET", "status", 200)

    def test_filesystem_endpoints(self):
        """Test file system API endpoints"""
        print("\n🗂️ Testing File System Endpoints...")
        
        # Test home directory
        self.run_test("Get Home Directory", "GET", "filesystem/home", 200)
        
        # Test browse filesystem (root)
        self.run_test("Browse Root Directory", "GET", "filesystem/browse", 200)
        
        # Test browse with specific path
        self.run_test("Browse Home Directory", "GET", "filesystem/browse", 200, params={"path": "/home"})
        
        # Test invalid path
        self.run_test("Browse Invalid Path", "GET", "filesystem/browse", 404, params={"path": "/nonexistent/path"})

    def test_window_management_endpoints(self):
        """Test virtual window management endpoints"""
        print("\n🪟 Testing Window Management Endpoints...")
        
        # Test list windows (should be empty initially)
        self.run_test("List Windows (Empty)", "GET", "windows/list", 200)
        
        # Test create window
        window_data = {
            "title": "Test Window",
            "position": {"x": 0, "y": 1.5, "z": -2},
            "size": {"width": 1.6, "height": 1.2},
            "content_type": "app",
            "content_url": "/test-app"
        }
        success, response = self.run_test("Create Window", "POST", "windows/create", 200, data=window_data)
        
        window_id = None
        if success and isinstance(response, dict):
            window_id = response.get('id')
            print(f"   📝 Created window with ID: {window_id}")
        
        # Test list windows (should have one now)
        self.run_test("List Windows (With Data)", "GET", "windows/list", 200)
        
        if window_id:
            # Test update window
            update_data = {
                "position": {"x": 1, "y": 2, "z": -3},
                "is_active": True
            }
            self.run_test(f"Update Window {window_id}", "PUT", f"windows/{window_id}", 200, data=update_data)
            
            # Test close window
            self.run_test(f"Close Window {window_id}", "DELETE", f"windows/{window_id}", 200)
        
        # Test update non-existent window
        self.run_test("Update Non-existent Window", "PUT", "windows/fake-id", 404, 
                     data={"position": {"x": 0, "y": 0, "z": 0}})

    def test_app_launcher_endpoints(self):
        """Test application launcher endpoints"""
        print("\n🚀 Testing App Launcher Endpoints...")
        
        # Test list applications
        self.run_test("List Applications", "GET", "apps/list", 200)
        
        # Test launch application
        launch_data = {
            "app_path": "/test-app",
            "window_title": "Test Application"
        }
        self.run_test("Launch Application", "POST", "apps/launch", 200, data=launch_data)

    def test_steamvr_endpoints(self):
        """Test SteamVR integration endpoints"""
        print("\n🥽 Testing SteamVR Endpoints...")
        
        # Test SteamVR status
        self.run_test("Get SteamVR Status", "GET", "steamvr/status", 200)
        
        # Test system info
        self.run_test("Get System Info", "GET", "system/info", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting VR Desktop Environment API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        self.test_basic_endpoints()
        self.test_filesystem_endpoints() 
        self.test_window_management_endpoints()
        self.test_app_launcher_endpoints()
        self.test_steamvr_endpoints()
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests ({len(self.failed_tests)}):")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"   {i}. {test['test']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                else:
                    print(f"      Expected: {test['expected']}, Got: {test['actual']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = VRDesktopAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All API tests passed!")
        return 0
    else:
        print(f"\n⚠️ {len(tester.failed_tests)} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())