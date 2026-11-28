#!/usr/bin/env python3
"""Einstieg für `npm run art`: Fische (fishgen + pack) und danach Welt 1, Figuren, HUD (see_world).

Aufruf:  python3 tools/art/build_all.py [pfad/zu/fish_db.json]
"""
from __future__ import annotations

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ["fishgen.py", "pack.py", "see_world.py"]


def main(argv):
    extra = argv[1:]
    for step in STEPS:
        args = [sys.executable, os.path.join(HERE, step)] + (extra if step != "see_world.py" else [])
        print(f"== {step}", flush=True)
        r = subprocess.run(args)
        if r.returncode:
            print(f"FEHLER in {step} (Exit {r.returncode})", file=sys.stderr)
            return r.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
