"""Fetch public Oracle's Elixir mirrors and cache Worlds-only source rows.

The original publisher is https://oracleselixir.com/tools/downloads .
Mirrors are used because the publisher's legacy S3 files return HTTP 403.
This script makes no changes to the Naruto demo.
"""
import concurrent.futures
import csv
import io
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    2021: 'gregvoigts/bachelor-arbeit',
    2022: 'stvngo/LoL-Statistical-Analysis',
    2023: 'Ashalo/LOLAnalysis',
    2024: 'JianyunYe/League-of-Legends-data-analysis',
}

def fetch(item):
    year, repo = item
    target = ROOT / 'work' / f'worlds-{year}-raw.json'
    if target.exists() and json.loads(target.read_text(encoding='utf8')):
        return year, 'cached'
    url = f'https://raw.githubusercontent.com/{repo}/main/{year}_LoL_esports_match_data_from_OraclesElixir.csv'
    reader = csv.DictReader(io.TextIOWrapper(urllib.request.urlopen(url, timeout=90), encoding='utf-8-sig'))
    rows = [row for row in reader if row['league'] in {'WCS', 'WLDs', 'Worlds', 'WC'}]
    if not rows:
        raise ValueError(f'No Worlds rows in {year} source')
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf8')
    return year, len(rows), len({row['gameid'] for row in rows})

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for result in executor.map(fetch, SOURCES.items()):
            print(result, flush=True)
