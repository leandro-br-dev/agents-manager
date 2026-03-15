#!/usr/bin/env python3
"""
Test script to verify the agents-context feature.
"""
import sys
import subprocess
import time

def check_api_running():
    """Check if the API is running."""
    try:
        result = subprocess.run(
            ['curl', '-s', 'http://localhost:3000/api/ping'],
            timeout=2,
            capture_output=True
        )
        return result.returncode == 0
    except:
        return False

def get_auth_token():
    """Get auth token from environment or use default."""
    import os
    return os.getenv('DAEMON_TOKEN', 'dev-token-change-in-production')

def test_agents_context():
    """Test the /api/projects/:id/agents-context endpoint."""
    token = get_auth_token()

    print("1. Checking if API is running...")
    if not check_api_running():
        print("   ❌ API is not running. Start it with: cd api && npm run dev")
        return False
    print("   ✅ API is running")

    print("\n2. Getting list of projects...")
    result = subprocess.run([
        'curl', '-s',
        '-H', f'Authorization: Bearer {token}',
        'http://localhost:3000/api/projects'
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"   ❌ Failed to get projects: {result.stderr}")
        return False

    import json
    try:
        data = json.loads(result.stdout)
        projects = data.get('data', [])
        if not projects:
            print("   ⚠️  No projects found. Create a project first.")
            return False
        print(f"   ✅ Found {len(projects)} project(s)")
    except json.JSONDecodeError as e:
        print(f"   ❌ Failed to parse projects: {e}")
        return False

    project_id = projects[0]['id']
    project_name = projects[0]['name']
    print(f"   Using project: {project_name} (ID: {project_id})")

    print(f"\n3. Testing GET /api/projects/{project_id}/agents-context...")
    result = subprocess.run([
        'curl', '-s',
        '-H', f'Authorization: Bearer {token}',
        f'http://localhost:3000/api/projects/{project_id}/agents-context'
    ], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"   ❌ Request failed: {result.stderr}")
        return False

    try:
        data = json.loads(result.stdout)
        if data.get('error'):
            print(f"   ❌ API returned error: {data['error']}")
            return False

        agents = data.get('data', [])
        print(f"   ✅ Success! Found {len(agents)} agent(s)")
        if agents:
            print("\n   Agents:")
            for agent in agents:
                print(f"      - {agent['name']} (role: {agent['role']})")
                print(f"        workspace: {agent['workspace_path']}")
        else:
            print("   ℹ️  No agents linked to this project yet")
            print("   Link agents using POST /api/projects/:id/agents")

    except json.JSONDecodeError as e:
        print(f"   ❌ Failed to parse response: {e}")
        print(f"   Response: {result.stdout}")
        return False

    return True

if __name__ == '__main__':
    print("Testing agents-context feature\n" + "="*50)
    success = test_agents_context()
    print("\n" + "="*50)
    if success:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)
