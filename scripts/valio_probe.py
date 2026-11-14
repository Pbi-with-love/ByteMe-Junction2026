#!/usr/bin/env python3
"""Probe the Valio mock API: ping, download the 3 files, one sample price + availability call.

Usage: python3 scripts/valio_probe.py [--customer ID] [--ids 1,2,3] [--date YYYY-MM-DD]
Reads VALIO_API_BASE_URL, VALIO_API_KEY (and optional VALIO_CUSTOMER_ID) from .env at the
repo root. Everything it receives is saved under data/valio/ (gitignored).
"""
import argparse
import csv
import datetime
import io
import json
import mimetypes
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "valio"
DOWNLOADS = ["products", "delivery-reliability", "carbon-footprint"]
# The auth header format is not known yet: try each, move on at 401/403, report the one that works.
AUTHS = [("x-api-key", "{}"), ("Authorization", "Bearer {}"), ("Ocp-Apim-Subscription-Key", "{}"), (None, "")]
ID_KEY = re.compile(r"(?i)(product|material|item|article)?[_ ]?(id|number|no|code|sku)")


def load_env() -> dict:
    env = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip().strip("'\"")
    return {**env, **os.environ}


ENV = load_env()
BASE = ENV.get("VALIO_API_BASE_URL", "").rstrip("/").removesuffix("/api")
KEY = ENV.get("VALIO_API_KEY", "")
auth_i = 0


def call(method: str, path: str, body=None):
    global auth_i
    while True:
        name, fmt = AUTHS[auth_i]
        headers = {"Accept": "*/*"}
        if name:
            headers[name] = fmt.format(KEY)
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return res.status, res.headers, res.read()
        except urllib.error.HTTPError as err:
            if err.code in (401, 403) and auth_i + 1 < len(AUTHS):
                auth_i += 1
                continue
            return err.code, err.headers, err.read()


def save(stem: str, headers, raw: bytes) -> pathlib.Path:
    name = re.search(r'filename="?([^";]+)', headers.get("Content-Disposition", ""))
    ext = pathlib.Path(name.group(1)).suffix if name else mimetypes.guess_extension(headers.get_content_type())
    path = OUT / f"{stem}{ext or '.bin'}"
    path.write_bytes(raw)
    return path


def rows(raw: bytes) -> list[dict]:
    """Best-effort parse of a downloaded file into dict rows (JSON or delimited text)."""
    if raw[:2] == b"PK":  # xlsx/zip: inspect by hand, pass --ids
        return []
    try:
        data = json.loads(raw)
    except ValueError:
        text = raw.decode("utf-8-sig", "replace")
        try:
            dialect = csv.Sniffer().sniff(text[:4096])
        except csv.Error:
            return []
        return list(csv.DictReader(io.StringIO(text), dialect=dialect))
    while isinstance(data, dict):  # unwrap {"products": [...]}
        data = next((v for v in data.values() if isinstance(v, (list, dict))), None)
    return [r for r in data or [] if isinstance(r, dict)]


def guess_ids(raw: bytes, count: int = 5) -> list[str]:
    parsed = rows(raw)
    if not parsed:
        return []
    print(f"  catalog: {len(parsed)} rows, fields: {list(parsed[0])}")
    key = next((k for k in parsed[0] if ID_KEY.fullmatch(k.strip())), None)
    if not key:
        return []
    print(f"  guessed product id field: {key!r} (override with --ids if wrong)")
    return [str(r[key]).strip() for r in parsed[:count]]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--customer", default=ENV.get("VALIO_CUSTOMER_ID", ""))
    ap.add_argument("--ids", default="", help="comma-separated product ids (default: first 5 from the catalog)")
    ap.add_argument("--date", default=str(datetime.date.today() + datetime.timedelta(days=2)), help="requestedDate")
    args = ap.parse_args()
    if not BASE or not KEY:
        print("Set VALIO_API_BASE_URL and VALIO_API_KEY in .env first.", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)

    status, _, raw = call("GET", "/api/ping")
    print(f"ping: HTTP {status} {raw[:200]!r}")

    catalog = b""
    for name in DOWNLOADS:
        status, headers, raw = call("GET", f"/api/{name}/download")
        if status != 200:
            print(f"{name}: HTTP {status} {raw[:300]!r}")
            continue
        path = save(name, headers, raw)
        print(f"{name}: HTTP 200, {headers.get_content_type()}, {len(raw)} bytes -> {path.relative_to(ROOT)}")
        if name == "products":
            catalog = raw

    ids = [i for i in args.ids.split(",") if i] or guess_ids(catalog)
    if not ids or not args.customer:
        print("Skipping price/availability: need --customer (or VALIO_CUSTOMER_ID) and product ids (--ids).")
    else:
        body = {"customer": args.customer, "requestedDate": args.date, "products": ids}
        print(f"sample body: {body}")
        for name in ("price", "availability"):
            status, headers, raw = call("POST", f"/api/{name}", body)
            path = save(name, headers, raw)
            print(f"{name}: HTTP {status} -> {path.relative_to(ROOT)}\n  {raw[:600].decode('utf-8', 'replace')}")

    print(f"auth header that worked: {AUTHS[auth_i][0] or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
