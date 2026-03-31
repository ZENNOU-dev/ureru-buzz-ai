"""v6マイグレーション: CATSテーブル群作成"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_ACCESS_TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN")
PROJECT_REF = "ozhldqebkxxkctmrfngq"

def run_sql(sql: str) -> dict:
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, json={"query": sql})
    if resp.status_code != 201:
        print(f"Error: {resp.status_code} {resp.text}")
        return {}
    return resp.json()

def main():
    with open("migrations/006_cats_tables.sql") as f:
        sql = f.read()

    print("[1] Running full migration SQL...")
    result = run_sql(sql)
    print(f"  Result: {result}")

    # 確認
    print("\n=== Verification ===")
    for table in ["cats_clients", "cats_partners", "cats_content_groups", "cats_api_integrations", "cats_contents"]:
        result = run_sql(f"SELECT COUNT(*) as cnt FROM {table}")
        print(f"  {table}: {result}")

    result = run_sql("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tracking_codes' AND column_name = 'cats_content_id'")
    print(f"  tracking_codes.cats_content_id: {result}")

if __name__ == "__main__":
    main()
