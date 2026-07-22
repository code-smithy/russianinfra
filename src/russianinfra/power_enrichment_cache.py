"""Shared helpers for cached power-enrichment source commands."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


SUPPORTED_CACHE_SUFFIXES = {".csv", ".json"}
DEFAULT_USER_AGENT = "russianinfra-power-enrichment/0.8"


def cache_source_main(
    cache_dir: Path,
    source_label: str,
    argv: list[str] | None = None,
    default_urls: list[str] | None = None,
    env_url_names: list[str] | None = None,
) -> int:
    parser = argparse.ArgumentParser(description=f"Prepare cached {source_label} power-enrichment files.")
    parser.add_argument(
        "--input",
        action="append",
        type=Path,
        default=[],
        help="Local CSV or JSON file to copy into this source cache. Repeat to add multiple files.",
    )
    parser.add_argument("--refresh", action="store_true", help="Download configured remote source files into this source cache.")
    parser.add_argument(
        "--url",
        action="append",
        default=[],
        help="Remote CSV, JSON, or ZIP URL to download into this source cache. Repeat to add multiple URLs.",
    )
    parser.add_argument(
        "--output-name",
        help="Filename to use for a single downloaded URL. Ignored when multiple URLs are downloaded.",
    )
    parser.add_argument("--header", action="append", default=[], help="Extra HTTP header as 'Name: value'. Repeat as needed.")
    parser.add_argument("--timeout", type=int, default=180, help="Download timeout in seconds.")
    args = parser.parse_args(argv)

    cache_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for input_path in args.input:
        if not input_path.exists() or not input_path.is_file():
            raise FileNotFoundError(f"Missing cache input file: {input_path}")
        if input_path.suffix.casefold() not in SUPPORTED_CACHE_SUFFIXES:
            raise ValueError(f"Unsupported cache input extension for {input_path}; expected .csv or .json")
        target = cache_dir / input_path.name
        if input_path.resolve() != target.resolve():
            shutil.copy2(input_path, target)
        copied += 1

    urls = configured_urls(args.url, default_urls or [], env_url_names or [], args.refresh)
    downloaded: list[Path] = []
    if urls:
        headers = parse_headers(args.header)
        for index, url in enumerate(urls):
            output_name = args.output_name if len(urls) == 1 else None
            downloaded.extend(download_url_to_cache(url, cache_dir, output_name=output_name, headers=headers, timeout=args.timeout))

    if copied:
        print(f"Cached {copied:,} {source_label} file(s) under {cache_dir}")
    if downloaded:
        print(f"Downloaded {len(downloaded):,} {source_label} file(s) under {cache_dir}")
    elif args.refresh and not urls:
        print(f"{source_label} refresh needs --url or a configured source URL; preserving existing cached files.")
    else:
        print(f"{source_label} cache directory ready: {cache_dir}")
    return 0


def configured_urls(cli_urls: list[str], default_urls: list[str], env_url_names: list[str], refresh: bool) -> list[str]:
    urls = list(cli_urls)
    for name in env_url_names:
        raw = os.environ.get(name, "")
        if raw:
            urls.extend(part.strip() for part in raw.split(";") if part.strip())
    if refresh and not urls:
        urls.extend(default_urls)
    return list(dict.fromkeys(urls))


def parse_headers(items: list[str]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for item in items:
        if ":" not in item:
            raise ValueError(f"Invalid header {item!r}; expected 'Name: value'")
        key, val = item.split(":", 1)
        key = key.strip()
        if not key:
            raise ValueError(f"Invalid header {item!r}; expected a non-empty header name")
        headers[key] = val.strip()
    headers.setdefault("User-Agent", DEFAULT_USER_AGENT)
    return headers


def download_url_to_cache(
    url: str,
    cache_dir: Path,
    output_name: str | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 180,
) -> list[Path]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    headers = headers or {"User-Agent": DEFAULT_USER_AGENT}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
        content_type = response.headers.get("Content-Type", "")

    filename = output_name or filename_from_url(url, content_type)
    suffix = Path(filename).suffix.casefold()
    target = cache_dir / filename

    with tempfile.NamedTemporaryFile(delete=False, dir=cache_dir, suffix=".download") as handle:
        handle.write(payload)
        temp_path = Path(handle.name)
    temp_path.replace(target)

    if suffix == ".zip":
        return [target, *extract_supported_zip_members(target, cache_dir)]
    if suffix not in SUPPORTED_CACHE_SUFFIXES:
        target.unlink(missing_ok=True)
        raise ValueError(f"Downloaded unsupported file extension {suffix or '(none)'} from {url}; expected .csv, .json, or .zip")
    return [target]


def filename_from_url(url: str, content_type: str = "") -> str:
    path = urllib.parse.urlparse(url).path
    name = Path(path).name
    if name and Path(name).suffix:
        return name
    if "json" in content_type.casefold():
        return "download.json"
    return "download.csv"


def extract_supported_zip_members(path: Path, cache_dir: Path) -> list[Path]:
    extracted: list[Path] = []
    with zipfile.ZipFile(path) as archive:
        for member in archive.infolist():
            member_name = Path(member.filename).name
            if not member_name or Path(member_name).suffix.casefold() not in SUPPORTED_CACHE_SUFFIXES:
                continue
            target = cache_dir / member_name
            with archive.open(member) as source, tempfile.NamedTemporaryFile(delete=False, dir=cache_dir, suffix=".download") as handle:
                shutil.copyfileobj(source, handle)
                temp_path = Path(handle.name)
            temp_path.replace(target)
            extracted.append(target)
    if not extracted:
        raise ValueError(f"Downloaded ZIP {path} did not contain CSV or JSON files")
    return extracted


def main() -> int:
    print("Use a source-specific command such as russianinfra-extract-iaea-pris.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
