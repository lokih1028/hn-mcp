import argparse
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(prog="hn-mcp", description="Hacker News MCP server")
    sub = parser.add_subparsers(dest="command")
    sync_p = sub.add_parser("sync", help="download/refresh the local story index")
    sync_p.add_argument("--from", dest="from_month", help="first archive month to fetch, e.g. 2020-01")
    sync_p.add_argument("--workers", type=int, default=4)
    sync_p.add_argument("--no-snapshot", action="store_true",
                        help="on first run, build from the raw archive instead of the prebuilt index")
    mode = sync_p.add_mutually_exclusive_group()
    mode.add_argument("--no-live", action="store_true", help="skip days after the archive")
    mode.add_argument("--live-only", action="store_true",
                      help="only refresh recent days from Algolia (fast; for daily runs)")
    pack_p = sub.add_parser("pack", help="zip the local index into a snapshot for a release")
    pack_p.add_argument("out", nargs="?", default="hn-index.zip")
    sub.add_parser("serve", help="run the MCP server over stdio (default)")
    args = parser.parse_args()

    if args.command == "pack":
        from .index import pack

        print(f"{pack(Path(args.out))} files -> {args.out}")
        return

    if args.command == "sync":
        from .index import download_snapshot, stories_dir, sync, sync_live

        log = lambda msg: print(msg, flush=True)  # noqa: E731
        failed = []
        if not args.live_only:
            if not args.no_snapshot and not any(stories_dir().rglob("*.parquet")):
                try:
                    log(f"[snapshot] {download_snapshot(log=log)} files unpacked")
                except Exception as exc:  # no release yet, offline, ...: build it ourselves
                    log(f"[snapshot] unavailable ({exc}); building from the archive")
            result = sync(from_month=args.from_month, workers=args.workers, log=log)
            print(result)
            failed = result["failed"]
        if not args.no_live:
            print(sync_live(log=log))
        sys.exit(1 if failed else 0)

    from .server import mcp

    mcp.run()
