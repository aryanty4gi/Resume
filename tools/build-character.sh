#!/bin/sh
# Rebuilds assets/character/pose-N.webp from tools/source/pose-N.webp.
# Needs the local server running (python3 -m http.server 5173) and Google Chrome installed.
set -e
cd "$(dirname "$0")/.."
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=60000 --dump-dom "http://localhost:5173/tools/matte.html" 2>/dev/null \
| python3 -I -c '
import sys, re, json, base64, html
dom = sys.stdin.read()
m = re.search(r"<pre id=\"out\"[^>]*>(.*?)</pre>", dom, re.S)
data = json.loads(html.unescape(m.group(1)))
for n, url in data.items():
    raw = base64.b64decode(url.split(",", 1)[1])
    open(f"assets/character/pose-{n}.webp", "wb").write(raw)
    print(f"pose-{n}.webp", len(raw) // 1024, "KB")
'
