"""
extract_crs.py

Reads Google Sheets MCP tool-result files (already fetched ranges test!A837:E2100,
test!A2100:E3400, test!A3400:E4321) and extracts unique CR名 (col D) + CR URL (col E)
for rows where 案件名 (col A) is "ローコスト" or "REDEN".

Output: JSON printed to stdout with keys "ローコスト" and "REDEN".
Each value is a list of {"cr_name": ..., "cr_url": ...} dicts, deduplicated and sorted.
"""

import json
import os

TOOL_RESULT_FILES = [
    "/Users/yumhahada/.claude/projects/-Users-yumhahada-ad-orchestration/22327e94-f0a7-4a65-b554-7c7ad0940c28/tool-results/mcp-google-workspace-sheets_read-1773733779623.txt",
    "/Users/yumhahada/.claude/projects/-Users-yumhahada-ad-orchestration/22327e94-f0a7-4a65-b554-7c7ad0940c28/tool-results/mcp-google-workspace-sheets_read-1773733780661.txt",
    "/Users/yumhahada/.claude/projects/-Users-yumhahada-ad-orchestration/22327e94-f0a7-4a65-b554-7c7ad0940c28/tool-results/mcp-google-workspace-sheets_read-1773733781422.txt",
]

TARGET_NAMES = {"ローコスト", "REDEN"}

# cr_name -> cr_url, keyed by 案件名
results: dict[str, dict[str, str]] = {name: {} for name in TARGET_NAMES}


def parse_file(path: str) -> list[list[str]]:
    """Parse a MCP tool-result file and return rows as list-of-lists."""
    with open(path, encoding="utf-8") as fh:
        outer = json.load(fh)  # list with one element: {type, text}
    inner_text = outer[0]["text"]
    rows = json.loads(inner_text)  # list of lists
    return rows


for file_path in TOOL_RESULT_FILES:
    if not os.path.exists(file_path):
        print(f"WARNING: file not found: {file_path}")
        continue

    rows = parse_file(file_path)
    for row in rows:
        if not row:
            continue
        col_a = row[0].strip() if len(row) > 0 else ""
        if col_a not in TARGET_NAMES:
            continue
        col_d = row[3].strip() if len(row) > 3 else ""
        col_e = row[4].strip() if len(row) > 4 else ""
        if col_d:  # only store rows that have a CR名
            # Last-write wins for URL (all rows for same CR name should have same URL)
            results[col_a][col_d] = col_e


# Build final sorted output
output: dict[str, list[dict[str, str]]] = {}
for name in TARGET_NAMES:
    output[name] = [
        {"cr_name": cr_name, "cr_url": cr_url}
        for cr_name, cr_url in sorted(results[name].items())
    ]

# Print summary counts
for name in TARGET_NAMES:
    print(f"{name}: {len(output[name])} unique CR名 found")

print()
print(json.dumps(output, ensure_ascii=False, indent=2))
