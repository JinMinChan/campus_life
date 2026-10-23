#!/usr/bin/env python3
"""Run the game locally without Node, accounts or package installation."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse,functools
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4173);args=p.parse_args()
root=Path(__file__).resolve().parent
directory=root/'dist' if (root/'dist/index.html').exists() else root
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(directory))
server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
print(f'한양의 하루: http://127.0.0.1:{args.port}\nServing {directory}\nCtrl+C to stop.',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
