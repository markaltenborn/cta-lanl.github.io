#!/usr/bin/env python3
"""Fetch top-N recent ADS papers per rostered CTA member.

Reads:
    data/staff/staff_roster.yml
    data/postdocs/postdoc_roster.yml
    data/students/student_roster.yml
    data/emeritus/emeritus_roster.yml

For each entry with an `ads:` URL, parses the q= search expression,
hits the ADS /v1/search/query endpoint for the most recent papers,
and writes:
    data/<section>/papers/<slug>.yml

Token is read from the ADS_API_TOKEN env var. Designed to run inside
GitHub Actions where the secret is injected.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml


ADS_API_URL = "https://api.adsabs.harvard.edu/v1/search/query"

ROSTER_FILES = {
    "staff":    "data/staff/staff_roster.yml",
    "postdoc":  "data/postdocs/postdoc_roster.yml",
    "emeritus": "data/emeritus/emeritus_roster.yml",
}

OUTPUT_DIRS = {
    "staff":    "data/staff/papers",
    "postdoc":  "data/postdocs/papers",
    "emeritus": "data/emeritus/papers",
}

FIELDS = "bibcode,title,author,year,pub,pubdate,doi"
DEFAULT_ROWS = 5
SLEEP_BETWEEN = 0.4


def extract_q(url: str) -> str | None:
    if not url:
        return None
    m = re.search(r'(?:^|[?&#/])q=([^&]+)', url)
    if not m:
        return None
    return urllib.parse.unquote_plus(m.group(1))


def fetch_papers(q: str, token: str, rows: int) -> list[dict]:
    params = urllib.parse.urlencode({
        "q": q,
        "fl": FIELDS,
        "sort": "date desc",
        "rows": str(rows),
    })
    req = urllib.request.Request(
        f"{ADS_API_URL}?{params}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    return data.get("response", {}).get("docs", [])


def normalize_paper(doc: dict) -> dict:
    titles = doc.get("title") or []
    authors = doc.get("author") or []
    bibcode = doc.get("bibcode") or ""
    return {
        "bibcode": bibcode,
        "title": titles[0] if titles else "",
        "authors": authors[:6],
        "author_count": len(authors),
        "year": doc.get("year"),
        "journal": doc.get("pub") or "",
        "url": f"https://ui.adsabs.harvard.edu/abs/{bibcode}/abstract" if bibcode else None,
    }


def write_papers(slug: str, papers: list[dict], out_dir: str) -> None:
    path = Path(out_dir) / f"{slug}.yml"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        _dump_list_with_blank_lines(papers, f)


def _dump_list_with_blank_lines(rows: list, f) -> None:
    """Dump a YAML list with one blank line between top-level entries.
    Round-trip safe: yaml.safe_load ignores the extra newlines."""
    if not rows:
        f.write("[]\n")
        return
    chunks = []
    for entry in rows:
        text = yaml.safe_dump(
            [entry],
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
            width=120,
        )
        chunks.append(text.rstrip())
    f.write("\n\n".join(chunks) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS,
                        help=f"Top-N papers per author (default {DEFAULT_ROWS}).")
    parser.add_argument("--token",
                        default=(os.environ.get("ADS_API_TOKEN")
                                 or os.environ.get("ADS_API_KEY")
                                 or os.environ.get("ADS_DEV_KEY")),
                        help="ADS API token (default: ADS_API_TOKEN, then ADS_API_KEY, then ADS_DEV_KEY env).")
    parser.add_argument("--only-section", choices=list(ROSTER_FILES),
                        help="Restrict to one section.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse rosters and print queries; don't hit the API.")
    parser.add_argument("--print-only", action="store_true",
                        help="Hit the API but print results to stdout instead of writing YAML.")
    args = parser.parse_args(argv)

    if not args.token and not args.dry_run:
        print("ERROR: ADS_API_TOKEN env var not set (and not --dry-run)", file=sys.stderr)
        return 1

    fetched = 0
    skipped = 0
    failed = 0

    for section, roster_path in ROSTER_FILES.items():
        if args.only_section and section != args.only_section:
            continue
        rp = Path(roster_path)
        if not rp.exists():
            print(f"skip {section}: {roster_path} not found", file=sys.stderr)
            continue
        with rp.open() as f:
            roster = yaml.safe_load(f) or []

        for entry in roster:
            if not isinstance(entry, dict):
                continue
            slug = entry.get("slug")
            ads_url = entry.get("ads")
            if not slug or not ads_url:
                skipped += 1
                continue
            q = extract_q(ads_url)
            if not q:
                print(f"skip {section}/{slug}: cannot parse q= from ADS url", file=sys.stderr)
                skipped += 1
                continue

            if args.dry_run:
                print(f"[dry-run] {section}/{slug:<28} q={q}")
                continue

            try:
                docs = fetch_papers(q, args.token, args.rows)
            except urllib.error.HTTPError as e:
                print(f"ERROR {section}/{slug}: HTTP {e.code} {e.reason}", file=sys.stderr)
                failed += 1
                continue
            except urllib.error.URLError as e:
                print(f"ERROR {section}/{slug}: {e}", file=sys.stderr)
                failed += 1
                continue

            papers = [normalize_paper(d) for d in docs]
            if args.print_only:
                print(f"\n=== {section}/{slug} ({len(papers)} papers) ===")
                for i, p in enumerate(papers, 1):
                    authors = ""
                    if p.get("authors"):
                        cap = "; ".join(p["authors"][:3])
                        authors = f"{cap} et al." if p.get("author_count", 0) > 3 else cap
                    meta = " · ".join(filter(None, [
                        authors, str(p.get("year") or ""), p.get("journal") or "",
                    ]))
                    print(f"  {i}. {p.get('title') or p.get('bibcode') or '(untitled)'}")
                    if meta:
                        print(f"     {meta}")
                    if p.get("url"):
                        print(f"     {p['url']}")
            else:
                write_papers(slug, papers, OUTPUT_DIRS[section])
                print(f"{section}/{slug:<28} {len(papers):2d} papers")
            fetched += 1
            time.sleep(SLEEP_BETWEEN)

    print(f"\nFetched: {fetched}  Skipped: {skipped}  Failed: {failed}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
