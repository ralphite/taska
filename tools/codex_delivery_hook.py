"""Retired receiver: harmless for sessions that cached the old hook command.

New sessions need no delivery hook. This entry point performs no reads, writes,
network requests or model continuation while existing sessions release it.
"""

if __name__ == "__main__":
    print("{}")
