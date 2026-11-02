import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(prog="hn-mcp", description="Hacker News MCP server")
    sub = parser.add_subparsers(dest="command")
    sync_p = sub.add_parser("sync", help="download/refresh the local story index")
    sync_p.add_argument("--from", dest="from_month", help="first month to fetch, e.g. 2020-01")
    sync_p.add_argument("--workers", type=int, default=4)
    sub.add_parser("serve", help="run the MCP server over stdio (default)")
    args = parser.parse_args()

    if args.command == "sync":
        from .index import sync

        result = sync(from_month=args.from_month, workers=args.workers,
                      log=lambda msg: print(msg, flush=True))
        print(result)
        sys.exit(1 if result["failed"] else 0)

    from .server import mcp

    mcp.run()
