"""Screenshot the local preview harness with Playwright.

The harness (``scripts/preview``) renders the real plugin client components
against synthetic fixture data, so design work does not need the authenticated
DSH Web GUI (its per-process launch token blocks direct browser access).

Typical use from the repo root:

    python scripts/preview/shot.py                     # baseline shots
    python scripts/preview/shot.py --only overview --width 900
    python scripts/preview/shot.py --prefix dev-after  # after a redesign

The script reuses an already-running dev server on ``--url``; otherwise it
starts ``pnpm exec vite scripts/preview --port 5199 --strictPort`` and stops it
on exit. Output defaults to ``docs/screenshots/<prefix>-<mode>.png``.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "docs" / "screenshots"
PORT = 5199

# mode -> URL query overrides; the capture kind decides full-page vs element.
SHOTS: dict[str, tuple[dict[str, str], str]] = {
    "overview": ({"part": "section", "theme": "dark", "tab": "usage"}, "full"),
    "overview-light": ({"part": "section", "theme": "light", "tab": "usage"}, "full"),
    "plans": ({"part": "section", "theme": "dark", "tab": "plans"}, "full"),
    "settings": ({"part": "section", "theme": "dark", "tab": "settings"}, "full"),
    "health-warning": ({"part": "section", "theme": "dark", "tab": "settings", "health": "warning"}, "full"),
    "health-missing": ({"part": "section", "theme": "dark", "tab": "settings", "health": "missing"}, "full"),
    "no-alerts": ({"part": "section", "theme": "dark", "tab": "usage", "alerts": "0"}, "full"),
    "day-detail": ({"part": "section", "theme": "dark", "tab": "usage", "day": "auto"}, "full"),
    "platform-error": ({"part": "section", "theme": "dark", "tab": "usage", "platform": "error"}, "full"),
    "usd-unpriced": ({"part": "section", "theme": "dark", "tab": "usage", "usd": "unpriced"}, "full"),
    "select-open": ({"part": "section", "theme": "dark", "tab": "settings", "select": "open"}, "full"),
    "custom-plan-errors": ({"part": "section", "theme": "dark", "tab": "settings", "customPlans": "errors"}, "full"),
    "range-90": ({"part": "section", "theme": "dark", "tab": "usage", "range": "90"}, "full"),
    "range-retained": ({"part": "section", "theme": "dark", "tab": "usage", "range": "182", "retain": "45"}, "full"),
    "sparse": ({"part": "section", "theme": "dark", "tab": "usage", "variant": "sparse"}, "full"),
    "strip": ({"part": "strip", "theme": "dark"}, "element"),
    "strip-open": ({"part": "strip", "theme": "dark", "open": "1"}, "element"),
}

DEFAULT_MODES = ["overview", "strip"]
ALL_MODES = list(SHOTS)


def log(message: str) -> None:
    print(f"[shot] {message}", flush=True)


def server_up(url: str, timeout: float = 1.5) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 400
    except (urllib.error.URLError, OSError):
        return False


def wait_server(url: str, timeout: float = 90.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if server_up(url):
            return
        time.sleep(0.4)
    raise SystemExit(f"dev server did not answer on {url} within {timeout:.0f}s")


def start_server(url: str) -> subprocess.Popen[str] | None:
    if server_up(url):
        log(f"reusing dev server at {url}")
        return None
    log(f"starting vite on port {PORT}")
    creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    proc = subprocess.Popen(
        "pnpm exec vite scripts/preview --port 5199 --strictPort",
        cwd=ROOT,
        shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation,
    )
    wait_server(url)
    return proc


def stop_server(proc: subprocess.Popen[str] | None) -> None:
    if proc is None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
            check=False,
        )
    else:
        proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:  # pragma: no cover - defensive
        proc.kill()


def launch(playwright, channel: str):
    """Launch a Chromium build, tolerating a cache that only has system channels."""
    candidates = [channel] if channel else []
    candidates += ["chrome", "msedge", ""]
    errors: list[str] = []
    for candidate in dict.fromkeys(candidates):
        kwargs = {} if candidate in ("", "chromium") else {"channel": candidate}
        try:
            browser = playwright.chromium.launch(args=["--force-color-profile=srgb"], **kwargs)
            log(f"browser: {candidate or 'bundled chromium'} {browser.version}")
            return browser
        except Exception as exc:  # noqa: BLE001 - probe every fallback
            errors.append(f"{candidate or 'bundled chromium'}: {exc.__class__.__name__}")
    raise SystemExit(
        "could not launch any Chromium build ("
        + "; ".join(errors)
        + "). Install one with `python -m playwright install chromium` or pass --channel chrome."
    )


def build_url(base: str, width: int, overrides: dict[str, str]) -> str:
    params = {"w": str(width), **overrides}
    query = "&".join(f"{key}={value}" for key, value in params.items())
    return f"{base.rstrip('/')}/?{query}"


def capture(page, base: str, width: int, mode: str, target: Path) -> float:
    """Capture one mode; returns how long the harness took to become ready (ms)."""
    overrides, kind = SHOTS[mode]
    page.goto(build_url(base, width, overrides), wait_until="load")
    page.wait_for_selector('[data-dsh-plugin="usage"], [data-dsh-plugin="usage-plus"]', timeout=30_000)
    page.wait_for_selector('html[data-preview-ready="1"]', timeout=30_000)
    ready_ms = page.evaluate("performance.now()")
    if mode == "strip-open":
        page.wait_for_selector('[role="dialog"]', timeout=10_000)
    page.evaluate("document.fonts.ready.then(() => true)")
    page.wait_for_timeout(180)
    target.parent.mkdir(parents=True, exist_ok=True)
    if kind == "element":
        page.locator('[data-shot="strip"]').screenshot(path=str(target), animations="disabled")
    else:
        page.screenshot(path=str(target), full_page=True, animations="disabled")
    return ready_ms


def describe(path: Path) -> str:
    try:
        from PIL import Image

        with Image.open(path) as image:
            size = f"{image.width}x{image.height}"
    except Exception:  # noqa: BLE001 - PIL is a nice-to-have
        size = "?"
    try:
        shown = path.relative_to(ROOT)
    except ValueError:
        shown = path
    return f"{shown}  {path.stat().st_size / 1024:.1f} KiB  {size}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default=os.environ.get("PREVIEW_URL", f"http://127.0.0.1:{PORT}"))
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="output directory (default docs/screenshots)")
    parser.add_argument("--prefix", default="dev-baseline", help="output filename prefix")
    parser.add_argument("--width", type=int, default=1232, help="harness container width in CSS px (default 1232)")
    parser.add_argument("--height", type=int, default=1100, help="viewport height in CSS px (default 1100)")
    parser.add_argument("--dpr", type=float, default=2.0, help="device scale factor (default 2)")
    parser.add_argument("--only", default=",".join(DEFAULT_MODES), help=f"comma list of: {', '.join(ALL_MODES)}|all")
    parser.add_argument("--channel", default=os.environ.get("PREVIEW_CHANNEL", "chrome"), help="browser channel")
    parser.add_argument("--no-serve", action="store_true", help="never start vite; use --url as-is")
    args = parser.parse_args()

    modes = ALL_MODES if args.only.strip() == "all" else [m.strip() for m in args.only.split(",") if m.strip()]
    unknown = [m for m in modes if m not in SHOTS]
    if unknown:
        raise SystemExit(f"unknown mode(s): {', '.join(unknown)}; valid: {', '.join(ALL_MODES)}")

    out_dir = Path(args.out)
    if not out_dir.is_absolute():
        out_dir = ROOT / out_dir
    suffix = "" if args.width == 1232 else f"-w{args.width}"

    proc = None if args.no_serve else start_server(args.url)
    try:
        from playwright.sync_api import sync_playwright

        viewport = {"width": args.width + 48, "height": args.height}
        with sync_playwright() as playwright:
            browser = launch(playwright, args.channel)
            context = browser.new_context(viewport=viewport, device_scale_factor=args.dpr, locale="zh-CN")
            page = context.new_page()
            written: list[Path] = []
            for mode in modes:
                target = out_dir / f"{args.prefix}-{mode}{suffix}.png"
                ready_ms = capture(page, args.url, args.width, mode, target)
                written.append(target)
                log(f"wrote {describe(target)}  (harness ready at {ready_ms:.0f} ms)")
            context.close()
            browser.close()
    finally:
        stop_server(proc)

    print("")
    print(f"{len(written)} screenshot(s) in {out_dir}")
    for path in written:
        print("  " + describe(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
