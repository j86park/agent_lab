import requests
import sys

BASE_URL = "http://localhost:8000"

def test_tags():
    try:
        # 1. Get first run
        resp = requests.get(f"{BASE_URL}/api/runs?limit=1")
        resp.raise_for_status()
        runs = resp.json().get("runs", [])
        if not runs:
            print("No runs found")
            return
        
        run_id = runs[0]["id"]
        print(f"Testing run: {run_id}")
        
        # 2. Update tags
        resp = requests.patch(f"{BASE_URL}/api/runs/{run_id}/tags", json={"tags": "test-tag-xyz"})
        resp.raise_for_status()
        print(f"Updated tags: {resp.json()['tags']}")
        
        # 3. Filter by tag
        resp = requests.get(f"{BASE_URL}/api/runs?tag=test-tag-xyz")
        resp.raise_for_status()
        filtered = resp.json().get("runs", [])
        if any(r["id"] == run_id for r in filtered):
            print("Filtering by tag: PASS")
        else:
            print("Filtering by tag: FAIL")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_tags()
