#!/usr/bin/env python3
"""Make one file you can share: dist/manamon-helper.html

It puts the page, the style, the game data and the program into a single
HTML file. Send that file to anyone; they open it in a web browser.

Run it after tools/build_data.py:

    python3 tools/build_single_file.py
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "dist", "manamon-helper.html")


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def inline_script(code):
    # "</script" inside the code would end the script tag early.
    return "<script>\n" + re.sub(r"</(script)", r"<\\/\1", code, flags=re.I) + "\n</script>"


def main():
    page = read("index.html")
    parts = {
        '<link rel="stylesheet" href="app.css">': "<style>\n" + read("app.css") + "\n</style>",
        '<script src="data/manamon-data.js"></script>': inline_script(read("data/manamon-data.js")),
        '<script src="app.js"></script>': inline_script(read("app.js")),
    }
    for tag, inline in parts.items():
        if page.count(tag) != 1:
            raise SystemExit(f"index.html should contain {tag} exactly once")
        page = page.replace(tag, inline)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
