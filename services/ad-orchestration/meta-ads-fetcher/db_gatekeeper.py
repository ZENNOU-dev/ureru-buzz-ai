"""DB Gatekeeper: Database integrity checker for ad-orchestration.

Runs a series of integrity checks and reports findings with severity levels.
Can be run standalone or imported from other scripts.

Usage:
    python db_gatekeeper.py           # Full report
    python db_gatekeeper.py --quiet   # Summary only

Import:
    from db_gatekeeper import run_gatekeeper, preflight_check
"""

import logging
import os
import sys
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

load_dotenv()

from database import get_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_result(name: str, severity: str, status: str, message: str,
                  affected_rows: list | None = None,
                  fix_suggestion: str | None = None) -> dict:
    """Build a standardised check result dict."""
    result = {
        "name": name,
        "severity": severity,
        "status": status,
        "message": message,
    }
    if affected_rows is not None:
        result["affected_rows"] = affected_rows
    if fix_suggestion:
        result["fix_suggestion"] = fix_suggestion
    return result


def _safe_query(client, table: str, select: str, filters: dict | None = None,
                raw_filter: str | None = None) -> list[dict]:
    """Run a Supabase query with basic error handling.

    ``filters`` is a dict of {column: value} for eq() calls.
    ``raw_filter`` is an RPC / raw SQL fallback (unused for now).
    """
    try:
        q = client.table(table).select(select)
        if filters:
            for col, val in filters.items():
                q = q.eq(col, val)
        result = q.execute()
        return result.data or []
    except Exception as e:
        logger.warning("Query failed on %s: %s", table, e)
        return []


def _count_table(client, table: str) -> int:
    """Return approximate row count for *table*."""
    try:
        result = client.table(table).select("*", count="exact").limit(0).execute()
        return result.count if result.count is not None else 0
    except Exception:
        return -1


# ---------------------------------------------------------------------------
# Individual check functions
# ---------------------------------------------------------------------------

# -- CRITICAL checks --------------------------------------------------------

def _check_orphan_fk_simple(client, child_table: str, fk_col: str,
                            parent_table: str, parent_pk: str,
                            child_label_col: str = "id") -> dict:
    """Generic orphan FK check: find rows in child_table whose fk_col
    points to a non-existent row in parent_table.
    Uses client-side set difference (Supabase REST has no LEFT JOIN IS NULL).
    """
    name = f"orphan_fk_{child_table}_{fk_col}"

    # Fetch child FK values (non-null only)
    children = _safe_query(client, child_table, f"id,{fk_col},{child_label_col}")
    if not children:
        return _check_result(name, "CRITICAL", "OK",
                             f"No rows in {child_table} to check")

    child_fk_values = {
        row[fk_col] for row in children
        if row.get(fk_col) is not None
    }
    if not child_fk_values:
        return _check_result(name, "CRITICAL", "OK",
                             f"All {fk_col} in {child_table} are NULL (checked separately)")

    # Fetch parent PKs
    parents = _safe_query(client, parent_table, parent_pk)
    parent_ids = {row[parent_pk] for row in parents}

    orphans = child_fk_values - parent_ids
    if not orphans:
        return _check_result(name, "CRITICAL", "OK",
                             f"All {fk_col} in {child_table} point to valid {parent_table}")

    affected = [
        {k: row[k] for k in row if k in ("id", fk_col, child_label_col)}
        for row in children if row.get(fk_col) in orphans
    ]
    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(affected)} {child_table} have {fk_col} pointing to non-existent {parent_table}",
        affected_rows=affected[:20],
        fix_suggestion=f"Update {child_table} SET {fk_col} = (correct_id) WHERE {fk_col} IN ({', '.join(str(v) for v in list(orphans)[:10])})"
    )


def _check_orphan_fk_projects(client) -> dict:
    return _check_orphan_fk_simple(client, "projects", "client_id",
                                   "clients", "id", "name")


def _check_orphan_fk_ad_accounts(client) -> dict:
    """ad_accounts uses account_id as PK (no 'id' column)."""
    name = "orphan_fk_ad_accounts_project_id"
    rows = _safe_query(client, "ad_accounts", "account_id,project_id,account_name")
    if not rows:
        return _check_result(name, "CRITICAL", "OK", "No ad_accounts to check")
    child_fk_values = {r["project_id"] for r in rows if r.get("project_id") is not None}
    if not child_fk_values:
        return _check_result(name, "CRITICAL", "OK", "All project_id in ad_accounts are NULL (checked separately)")
    parents = _safe_query(client, "projects", "id")
    parent_ids = {r["id"] for r in parents}
    orphans = child_fk_values - parent_ids
    if not orphans:
        return _check_result(name, "CRITICAL", "OK", "All project_id in ad_accounts point to valid projects")
    affected = [{"account_id": r["account_id"], "project_id": r["project_id"], "account_name": r.get("account_name")}
                for r in rows if r.get("project_id") in orphans]
    return _check_result(name, "CRITICAL", "FAIL",
        f"{len(affected)} ad_accounts have project_id pointing to non-existent projects",
        affected_rows=affected[:20],
        fix_suggestion=f"Update ad_accounts SET project_id = (correct_id) WHERE project_id IN ({', '.join(str(v) for v in list(orphans)[:10])})"
    )


def _check_orphan_fk_creatives(client) -> dict:
    return _check_orphan_fk_simple(client, "creatives", "project_id",
                                   "projects", "id", "creative_name")


def _check_orphan_cats_contents_article_lp(client) -> dict:
    """Check cats_contents.article_lp_id points to article_lps (not the deprecated lp_base_urls)."""
    name = "orphan_cats_contents_article_lp_id"

    contents = _safe_query(client, "cats_contents",
                           "cats_content_id,name,article_lp_id")
    with_lp = [r for r in contents if r.get("article_lp_id") is not None]
    if not with_lp:
        return _check_result(name, "CRITICAL", "OK",
                             "No cats_contents with article_lp_id set")

    # Check against article_lps (correct table)
    article_lps = _safe_query(client, "article_lps", "id")
    valid_ids = {r["id"] for r in article_lps}

    orphans = [r for r in with_lp if r["article_lp_id"] not in valid_ids]
    if not orphans:
        return _check_result(name, "CRITICAL", "OK",
                             "All cats_contents.article_lp_id point to valid article_lps")

    # Check if they accidentally point to lp_base_urls
    lp_base = _safe_query(client, "lp_base_urls", "id")
    lp_base_ids = {r["id"] for r in lp_base}
    stale = [r for r in orphans if r["article_lp_id"] in lp_base_ids]

    msg = f"{len(orphans)} cats_contents have article_lp_id pointing to non-existent article_lps"
    if stale:
        msg += f" ({len(stale)} point to deprecated lp_base_urls instead)"

    return _check_result(
        name, "CRITICAL", "FAIL", msg,
        affected_rows=orphans[:20],
        fix_suggestion="Remap article_lp_id from lp_base_urls IDs to article_lps IDs"
    )


def _check_orphan_cats_contents_client_code(client) -> dict:
    """Check cats_contents.client_code_id points to client_codes (not lp_base_urls)."""
    name = "orphan_cats_contents_client_code_id"

    contents = _safe_query(client, "cats_contents",
                           "cats_content_id,name,client_code_id")
    with_code = [r for r in contents if r.get("client_code_id") is not None]
    if not with_code:
        return _check_result(name, "CRITICAL", "OK",
                             "No cats_contents with client_code_id set")

    codes = _safe_query(client, "client_codes", "id")
    valid_ids = {r["id"] for r in codes}

    orphans = [r for r in with_code if r["client_code_id"] not in valid_ids]
    if not orphans:
        return _check_result(name, "CRITICAL", "OK",
                             "All cats_contents.client_code_id point to valid client_codes")

    lp_base = _safe_query(client, "lp_base_urls", "id")
    lp_base_ids = {r["id"] for r in lp_base}
    stale = [r for r in orphans if r["client_code_id"] in lp_base_ids]

    msg = f"{len(orphans)} cats_contents have client_code_id pointing to non-existent client_codes"
    if stale:
        msg += f" ({len(stale)} point to deprecated lp_base_urls instead)"

    return _check_result(
        name, "CRITICAL", "FAIL", msg,
        affected_rows=orphans[:20],
        fix_suggestion="Remap client_code_id from lp_base_urls IDs to client_codes IDs"
    )


def _check_orphan_cats_project_config(client) -> dict:
    """Check cats_project_config default_article_lp_id / default_client_code_id."""
    name = "orphan_cats_project_config_defaults"

    configs = _safe_query(client, "cats_project_config",
                          "id,project_id,platform,default_article_lp_id,default_client_code_id")
    if not configs:
        return _check_result(name, "CRITICAL", "OK", "No cats_project_config rows")

    # These FKs historically point to lp_base_urls; check if they should now
    # point to article_lps / client_codes respectively.
    lp_base = _safe_query(client, "lp_base_urls", "id")
    lp_base_ids = {r["id"] for r in lp_base}

    article_lps = _safe_query(client, "article_lps", "id")
    article_lp_ids = {r["id"] for r in article_lps}

    client_codes = _safe_query(client, "client_codes", "id")
    client_code_ids = {r["id"] for r in client_codes}

    issues = []
    for cfg in configs:
        alp_id = cfg.get("default_article_lp_id")
        cc_id = cfg.get("default_client_code_id")
        if alp_id is not None:
            if alp_id in lp_base_ids and alp_id not in article_lp_ids:
                issues.append({**cfg, "issue": f"default_article_lp_id={alp_id} points to lp_base_urls (deprecated)"})
            elif alp_id not in lp_base_ids and alp_id not in article_lp_ids:
                issues.append({**cfg, "issue": f"default_article_lp_id={alp_id} points to nothing"})
        if cc_id is not None:
            if cc_id in lp_base_ids and cc_id not in client_code_ids:
                issues.append({**cfg, "issue": f"default_client_code_id={cc_id} points to lp_base_urls (deprecated)"})
            elif cc_id not in lp_base_ids and cc_id not in client_code_ids:
                issues.append({**cfg, "issue": f"default_client_code_id={cc_id} points to nothing"})

    if not issues:
        return _check_result(name, "CRITICAL", "OK",
                             "All cats_project_config default IDs are valid")

    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(issues)} cats_project_config rows have stale default IDs",
        affected_rows=issues[:20],
        fix_suggestion="Remap default_article_lp_id to article_lps and default_client_code_id to client_codes"
    )


def _check_null_fk(client, table: str, fk_col: str,
                   label_col: str = "id") -> dict:
    """Check for NULL values in an important FK column."""
    name = f"null_fk_{table}_{fk_col}"

    rows = _safe_query(client, table, f"id,{fk_col},{label_col}")
    nulls = [r for r in rows if r.get(fk_col) is None]
    if not nulls:
        return _check_result(name, "CRITICAL", "OK",
                             f"No NULL {fk_col} in {table}")

    affected = [
        {k: row[k] for k in row if k in ("id", fk_col, label_col)}
        for row in nulls
    ]
    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(nulls)} {table} have NULL {fk_col}",
        affected_rows=affected[:20],
        fix_suggestion=f"Assign correct {fk_col} or delete orphan rows in {table}"
    )


def _check_null_fk_ad_accounts_project(client) -> dict:
    """ad_accounts uses account_id as PK (no 'id' column)."""
    name = "null_fk_ad_accounts_project_id"
    rows = _safe_query(client, "ad_accounts", "account_id,project_id,account_name")
    nulls = [r for r in rows if r.get("project_id") is None]
    if not nulls:
        return _check_result(name, "CRITICAL", "OK", "No NULL project_id in ad_accounts")
    affected = [{"account_id": r["account_id"], "account_name": r.get("account_name")} for r in nulls]
    return _check_result(name, "CRITICAL", "FAIL",
        f"{len(nulls)} ad_accounts have NULL project_id",
        affected_rows=affected[:20],
        fix_suggestion="Assign correct project_id or delete orphan ad_accounts")


def _check_null_fk_cats_contents(client) -> dict:
    """cats_contents uses cats_content_id as PK, not id."""
    name = "null_fk_cats_contents_project_id"
    rows = _safe_query(client, "cats_contents", "cats_content_id,name,project_id")
    nulls = [r for r in rows if r.get("project_id") is None]
    if not nulls:
        return _check_result(name, "CRITICAL", "OK",
                             "No NULL project_id in cats_contents")
    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(nulls)} cats_contents have NULL project_id",
        affected_rows=nulls[:20],
        fix_suggestion="Assign correct project_id to cats_contents"
    )


def _check_duplicate_creatives(client) -> dict:
    """Find creatives with same creative_name across different projects (unusual)."""
    name = "duplicate_creatives_cross_project"

    rows = _safe_query(client, "creatives", "id,creative_name,project_id")
    # creative_name has UNIQUE constraint, so true duplicates can't exist.
    # Instead, look for names that appear with different project_ids (shouldn't happen
    # with UNIQUE, but project_id could differ if NULL vs set).
    from collections import defaultdict
    by_name = defaultdict(list)
    for r in rows:
        by_name[r["creative_name"]].append(r)

    dupes = {k: v for k, v in by_name.items() if len(v) > 1}
    if not dupes:
        return _check_result(name, "CRITICAL", "OK",
                             "No duplicate creative names found")

    affected = []
    for cname, entries in list(dupes.items())[:10]:
        for e in entries:
            affected.append({"creative_name": cname, "id": e["id"], "project_id": e.get("project_id")})

    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(dupes)} creative names appear multiple times",
        affected_rows=affected[:20],
        fix_suggestion="Deduplicate creatives or verify project_id assignments"
    )


def _check_duplicate_cats_contents(client) -> dict:
    """Find active cats_contents with the same name (potential double registration)."""
    name = "duplicate_cats_contents_name"

    try:
        result = client.table("cats_contents").select(
            "cats_content_id,name"
        ).eq("is_active", True).execute()
        rows = result.data or []
    except Exception:
        rows = _safe_query(client, "cats_contents", "cats_content_id,name")
    from collections import Counter
    counts = Counter(r["name"] for r in rows)
    dupes = {n: c for n, c in counts.items() if c > 1}

    if not dupes:
        return _check_result(name, "CRITICAL", "OK",
                             "No duplicate cats_contents names found")

    affected = [{"name": n, "count": c} for n, c in dupes.items()]
    return _check_result(
        name, "CRITICAL", "FAIL",
        f"{len(dupes)} cats_contents names appear multiple times",
        affected_rows=affected[:20],
        fix_suggestion="Check CATS for double-registered contents and deactivate duplicates"
    )


# -- WARNING checks ---------------------------------------------------------

def _check_stale_ad_accounts(client) -> dict:
    """ad_accounts with is_target=true but no ad_daily_metrics in last 30 days."""
    name = "stale_target_ad_accounts"

    accounts = _safe_query(client, "ad_accounts", "account_id,account_name,project_id")
    # Filter to is_target=true
    target_accs = []
    try:
        result = client.table("ad_accounts").select(
            "account_id,account_name,project_id"
        ).eq("is_target", True).execute()
        target_accs = result.data or []
    except Exception as e:
        logger.warning("Failed to query target accounts: %s", e)
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not target_accs:
        return _check_result(name, "WARNING", "OK", "No target ad_accounts")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    stale = []

    for acc in target_accs:
        aid = acc["account_id"]
        try:
            # Check if any ad under this account has recent metrics
            # ads -> adsets -> campaigns -> account_id
            # Simpler: check ad_daily_metrics joined through ads hierarchy
            # Since we can't do joins in Supabase REST easily, use a simpler heuristic:
            # check last_fetched_at on the account itself
            result = client.table("ad_accounts").select(
                "last_fetched_at"
            ).eq("account_id", aid).execute()
            row = result.data[0] if result.data else {}
            last_fetch = row.get("last_fetched_at")
            if not last_fetch or last_fetch < cutoff:
                stale.append({
                    "account_id": aid,
                    "account_name": acc.get("account_name", ""),
                    "last_fetched_at": last_fetch,
                })
        except Exception:
            pass

    if not stale:
        return _check_result(name, "WARNING", "OK",
                             "All target accounts have recent data")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(stale)} target ad_accounts have no data in last 30 days",
        affected_rows=stale[:20],
        fix_suggestion="Check if these accounts are still active, or set is_target=false"
    )


def _check_stale_cats_contents(client) -> dict:
    """cats_contents with is_active=true but no matching ads.cats_content_id."""
    name = "stale_active_cats_contents"

    try:
        contents = client.table("cats_contents").select(
            "cats_content_id,name"
        ).eq("is_active", True).execute()
        active = contents.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not active:
        return _check_result(name, "WARNING", "OK", "No active cats_contents")

    # Get all cats_content_ids referenced by ads
    try:
        ads = client.table("ads").select("cats_content_id").not_.is_("cats_content_id", "null").execute()
        used_ids = {r["cats_content_id"] for r in (ads.data or [])}
    except Exception:
        used_ids = set()

    unused = [r for r in active if r["cats_content_id"] not in used_ids]
    if not unused:
        return _check_result(name, "WARNING", "OK",
                             "All active cats_contents are referenced by at least one ad")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(unused)} active cats_contents have no ads referencing them",
        affected_rows=unused[:20],
        fix_suggestion="Verify these CATS contents are still needed or set is_active=false"
    )


def _check_status_consistency_projects(client) -> dict:
    """projects with status='進行中' but all ad_accounts are '停止'."""
    name = "status_consistency_projects"

    try:
        projects = client.table("projects").select("id,name,status").eq("status", "進行中").execute()
        active_projects = projects.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not active_projects:
        return _check_result(name, "WARNING", "OK", "No active projects")

    inconsistent = []
    for proj in active_projects:
        try:
            accs = client.table("ad_accounts").select(
                "account_id,status,is_target"
            ).eq("project_id", proj["id"]).execute()
            acc_list = accs.data or []
            if not acc_list:
                continue
            # All accounts stopped?
            all_stopped = all(
                a.get("status") in ("停止", "DISABLED", "UNSETTLED")
                and not a.get("is_target", False)
                for a in acc_list
            )
            if all_stopped:
                inconsistent.append({
                    "project_id": proj["id"],
                    "project_name": proj["name"],
                    "account_count": len(acc_list),
                })
        except Exception:
            pass

    if not inconsistent:
        return _check_result(name, "WARNING", "OK",
                             "All active projects have at least one active account")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(inconsistent)} projects are '進行中' but all accounts are stopped",
        affected_rows=inconsistent[:20],
        fix_suggestion="Update project status to '停止中' or reactivate accounts"
    )


def _check_status_consistency_accounts(client) -> dict:
    """ad_accounts marked is_target but linked project is '停止中'."""
    name = "status_consistency_target_accounts"

    try:
        accs = client.table("ad_accounts").select(
            "account_id,account_name,project_id"
        ).eq("is_target", True).execute()
        target_accs = accs.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not target_accs:
        return _check_result(name, "WARNING", "OK", "No target accounts")

    # Get project statuses
    try:
        projects = client.table("projects").select("id,name,status").execute()
        proj_map = {p["id"]: p for p in (projects.data or [])}
    except Exception:
        proj_map = {}

    mismatched = []
    for acc in target_accs:
        pid = acc.get("project_id")
        if pid and pid in proj_map:
            proj = proj_map[pid]
            if proj.get("status") == "停止中":
                mismatched.append({
                    "account_id": acc["account_id"],
                    "account_name": acc.get("account_name", ""),
                    "project_id": pid,
                    "project_name": proj.get("name", ""),
                    "project_status": proj["status"],
                })

    if not mismatched:
        return _check_result(name, "WARNING", "OK",
                             "No target accounts linked to stopped projects")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(mismatched)} target accounts have project status '停止中'",
        affected_rows=mismatched[:20],
        fix_suggestion="Set is_target=false for these accounts or reactivate the project"
    )


def _check_lp_code_consistency(client) -> dict:
    """article_lps without any cats_contents referencing them."""
    name = "unused_article_lps"

    try:
        lps = client.table("article_lps").select("id,lp_name,project_id").execute()
        all_lps = lps.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not all_lps:
        return _check_result(name, "WARNING", "OK", "No article_lps")

    try:
        contents = client.table("cats_contents").select("article_lp_id").not_.is_("article_lp_id", "null").execute()
        used_ids = {r["article_lp_id"] for r in (contents.data or [])}
    except Exception:
        used_ids = set()

    unused = [lp for lp in all_lps if lp["id"] not in used_ids]
    if not unused:
        return _check_result(name, "WARNING", "OK",
                             "All article_lps are referenced by cats_contents")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(unused)} article_lps have no cats_contents referencing them",
        affected_rows=unused[:20],
        fix_suggestion="Register CATS contents for these article_lps or verify they are needed"
    )


def _check_unused_client_codes(client) -> dict:
    """client_codes without any article_lps referencing them."""
    name = "unused_client_codes"

    try:
        codes = client.table("client_codes").select("id,code_name,project_id").execute()
        all_codes = codes.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    if not all_codes:
        return _check_result(name, "WARNING", "OK", "No client_codes")

    try:
        lps = client.table("article_lps").select("client_code_id").not_.is_("client_code_id", "null").execute()
        used_ids = {r["client_code_id"] for r in (lps.data or [])}
    except Exception:
        used_ids = set()

    unused = [c for c in all_codes if c["id"] not in used_ids]
    if not unused:
        return _check_result(name, "WARNING", "OK",
                             "All client_codes are referenced by article_lps")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(unused)} client_codes have no article_lps referencing them",
        affected_rows=unused[:20],
        fix_suggestion="Map article_lps to these client_codes or verify they are needed"
    )


def _check_orphan_article_lp_client_code(client) -> dict:
    """article_lps.client_code_id pointing to non-existent client_codes."""
    name = "orphan_article_lps_client_code_id"

    try:
        lps = client.table("article_lps").select("id,lp_name,client_code_id").execute()
        all_lps = lps.data or []
    except Exception as e:
        return _check_result(name, "WARNING", "SKIP", f"Query failed: {e}")

    with_code = [lp for lp in all_lps if lp.get("client_code_id") is not None]
    if not with_code:
        return _check_result(name, "WARNING", "OK",
                             "No article_lps with client_code_id set")

    try:
        codes = client.table("client_codes").select("id").execute()
        valid_ids = {r["id"] for r in (codes.data or [])}
    except Exception:
        valid_ids = set()

    orphans = [lp for lp in with_code if lp["client_code_id"] not in valid_ids]
    if not orphans:
        return _check_result(name, "WARNING", "OK",
                             "All article_lps.client_code_id point to valid client_codes")

    return _check_result(
        name, "WARNING", "FAIL",
        f"{len(orphans)} article_lps have client_code_id pointing to non-existent client_codes",
        affected_rows=orphans[:20],
        fix_suggestion="Fix client_code_id in article_lps or create missing client_codes"
    )


# -- INFO checks ------------------------------------------------------------

def _check_table_stats(client) -> dict:
    """Row counts for all tables."""
    name = "table_stats"

    tables = [
        "clients", "projects", "ad_accounts",
        "account_conversion_events", "account_assets", "account_rules",
        "creatives", "campaigns", "adsets", "ads",
        "ad_daily_metrics", "ad_action_stats",
        "custom_audiences", "custom_audience_sets",
        "placement_presets", "geo_targeting_presets",
        "submission_presets", "ad_submissions",
        "submission_campaigns", "submission_adsets", "submission_ads",
        "link_urls", "tracking_codes",
        "cats_clients", "cats_partners", "cats_content_groups",
        "cats_api_integrations", "cats_contents", "cats_project_config",
        "article_lps", "client_codes", "members",
        "lp_base_urls", "lp_param_codes",
        "fetch_log", "agent_operations",
    ]

    counts = {}
    for t in tables:
        counts[t] = _count_table(client, t)

    return _check_result(
        name, "INFO", "OK",
        f"Row counts for {len(tables)} tables",
        affected_rows=[{"table": t, "count": c} for t, c in counts.items()]
    )


def _check_sync_freshness(client) -> dict:
    """Last updated_at for key tables."""
    name = "sync_freshness"

    key_tables = [
        "clients", "projects", "ad_accounts", "creatives",
        "cats_contents", "cats_project_config",
        "article_lps", "client_codes",
        "ad_daily_metrics",
    ]

    freshness = []
    for t in key_tables:
        try:
            result = client.table(t).select("updated_at").order(
                "updated_at", desc=True
            ).limit(1).execute()
            last = result.data[0]["updated_at"] if result.data else None
            freshness.append({"table": t, "last_updated_at": last})
        except Exception:
            freshness.append({"table": t, "last_updated_at": "ERROR"})

    return _check_result(
        name, "INFO", "OK",
        f"Sync freshness for {len(key_tables)} key tables",
        affected_rows=freshness
    )


def _check_agent_operations(client) -> dict:
    """Check recent agent operations for errors or anomalies."""
    name = "agent_operations_health"

    try:
        result = client.table("agent_operations").select(
            "id,operation_type,target_table,status,error_message,created_at"
        ).order("created_at", desc=True).limit(50).execute()
        ops = result.data or []
    except Exception:
        # Table may not exist yet (pre-migration 012)
        return _check_result(name, "INFO", "OK",
                             "agent_operations table not found (pre-v12)")

    if not ops:
        return _check_result(name, "INFO", "OK",
                             "No agent operations logged yet")

    errors = [o for o in ops if o.get("status") == "error"]
    rolled_back = [o for o in ops if o.get("status") == "rolled_back"]

    if errors:
        return _check_result(
            name, "WARNING", "FAIL",
            f"{len(errors)} agent operations failed in recent history",
            affected_rows=errors[:10],
            fix_suggestion="Review failed agent operations and fix underlying issues"
        )

    total = len(ops)
    return _check_result(name, "INFO", "OK",
                         f"{total} recent agent operations (0 errors, {len(rolled_back)} rolled back)")


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

ALL_CHECKS = [
    # CRITICAL
    _check_orphan_fk_projects,
    _check_orphan_fk_ad_accounts,
    _check_orphan_fk_creatives,
    _check_orphan_cats_contents_article_lp,
    _check_orphan_cats_contents_client_code,
    _check_orphan_cats_project_config,
    lambda c: _check_null_fk(c, "projects", "client_id", "name"),
    lambda c: _check_null_fk_ad_accounts_project(c),
    lambda c: _check_null_fk(c, "creatives", "project_id", "creative_name"),
    _check_null_fk_cats_contents,
    _check_duplicate_creatives,
    _check_duplicate_cats_contents,
    # WARNING
    _check_stale_ad_accounts,
    _check_stale_cats_contents,
    _check_status_consistency_projects,
    _check_status_consistency_accounts,
    _check_lp_code_consistency,
    _check_unused_client_codes,
    _check_orphan_article_lp_client_code,
    # INFO
    _check_table_stats,
    _check_sync_freshness,
    _check_agent_operations,
]


def run_gatekeeper(client=None, verbose: bool = True) -> dict:
    """Run all integrity checks. Returns results dict."""
    if client is None:
        client = get_client()

    timestamp = datetime.now(timezone.utc).isoformat()
    checks = []

    for check_fn in ALL_CHECKS:
        try:
            result = check_fn(client)
            checks.append(result)
            if verbose:
                _print_check(result)
        except Exception as e:
            logger.error("Check %s failed: %s", getattr(check_fn, "__name__", "lambda"), e)
            checks.append(_check_result(
                getattr(check_fn, "__name__", "unknown"),
                "CRITICAL", "ERROR", f"Check failed with exception: {e}"
            ))

    summary = {
        "critical": sum(1 for c in checks if c["severity"] == "CRITICAL" and c["status"] == "FAIL"),
        "warning": sum(1 for c in checks if c["severity"] == "WARNING" and c["status"] == "FAIL"),
        "info": sum(1 for c in checks if c["severity"] == "INFO"),
        "ok": sum(1 for c in checks if c["status"] == "OK"),
    }

    overall = "OK"
    if summary["warning"] > 0:
        overall = "WARNING"
    if summary["critical"] > 0:
        overall = "CRITICAL"

    report = {
        "timestamp": timestamp,
        "status": overall,
        "checks": checks,
        "summary": summary,
    }

    if verbose:
        _print_summary(report)

    return report


def preflight_check(client=None) -> bool:
    """Quick check before operations. Returns True if no CRITICAL issues."""
    if client is None:
        client = get_client()

    critical_checks = [fn for fn in ALL_CHECKS
                       if not getattr(fn, "_severity_hint", None)
                       or getattr(fn, "_severity_hint", None) == "CRITICAL"]

    # Run only CRITICAL-severity checks
    for check_fn in ALL_CHECKS:
        try:
            result = check_fn(client)
            if result["severity"] == "CRITICAL" and result["status"] == "FAIL":
                logger.warning("Preflight FAIL: %s — %s", result["name"], result["message"])
                return False
            # Skip INFO checks for speed
            if result["severity"] == "INFO":
                continue
        except Exception as e:
            logger.error("Preflight check error: %s", e)
            return False

    logger.info("Preflight check passed: no CRITICAL issues")
    return True


# ---------------------------------------------------------------------------
# CLI output formatting
# ---------------------------------------------------------------------------

_SEVERITY_ICONS = {
    "CRITICAL": "\U0001f534",  # red circle
    "WARNING": "\U0001f7e1",   # yellow circle
    "INFO": "\U0001f535",      # blue circle
}

_STATUS_ICONS = {
    "OK": "\u2705",     # green check
    "FAIL": "",         # severity icon used instead
    "SKIP": "\u23ed",   # skip
    "ERROR": "\u274c",  # red x
}


def _print_check(check: dict) -> None:
    """Print a single check result to stdout."""
    sev = check["severity"]
    status = check["status"]

    if status == "OK":
        icon = _STATUS_ICONS["OK"]
        label = "OK"
    elif status in ("SKIP", "ERROR"):
        icon = _STATUS_ICONS[status]
        label = status
    else:
        icon = _SEVERITY_ICONS.get(sev, "")
        label = sev

    print(f"{icon} {label}: {check['message']}")

    if check["status"] == "FAIL" and check.get("affected_rows"):
        for row in check["affected_rows"][:5]:
            parts = []
            for k, v in row.items():
                parts.append(f"{k}={v}")
            print(f"   -> {', '.join(parts)}")
        remaining = len(check["affected_rows"]) - 5
        if remaining > 0:
            print(f"   ... and {remaining} more")

    if check.get("fix_suggestion") and check["status"] == "FAIL":
        print(f"   Fix: {check['fix_suggestion']}")


def _print_summary(report: dict) -> None:
    """Print the final summary."""
    s = report["summary"]
    ts = report["timestamp"][:19].replace("T", " ")

    print()
    print("=" * 50)
    print(f"DB Gatekeeper Report  |  {ts} UTC")
    print("=" * 50)
    print(f"Status: {report['status']}")
    print(f"  Critical: {s['critical']}")
    print(f"  Warning:  {s['warning']}")
    print(f"  Info:     {s['info']}")
    print(f"  OK:       {s['ok']}")
    print("=" * 50)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    quiet = "--quiet" in sys.argv

    print()
    print("=== DB Gatekeeper Report ===")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print()

    report = run_gatekeeper(verbose=not quiet)

    if quiet:
        _print_summary(report)

    sys.exit(1 if report["status"] == "CRITICAL" else 0)
