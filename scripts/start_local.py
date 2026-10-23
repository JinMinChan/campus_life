#!/usr/bin/env python3
"""Start the existing loopback server independently of this terminal session."""
from pathlib import Path
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.run'
URL = 'http://127.0.0.1:4173/'
PID_FILE = STATE / 'server.pid'

def response():
    try:
        with urllib.request.urlopen(URL, timeout=2) as r:
            body = r.read().decode('utf-8')
            return r.status, '한양의 하루' in body
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return None, False

status, ours = response()
if status is not None:
    if not ours:
        raise SystemExit('Port 4173 is used by a different service; it was left untouched.')
    print(json.dumps({'status': 'already_running', 'url': URL, 'http': status}, ensure_ascii=False))
    raise SystemExit(0)

STATE.mkdir(exist_ok=True)
with (STATE / 'server.log').open('ab', buffering=0) as log:
    child = subprocess.Popen(
        [sys.executable, str(ROOT / 'run.py'), '--port', '4173'],
        cwd=ROOT,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        close_fds=True,
        start_new_session=True,
    )
PID_FILE.write_text(str(child.pid) + '\n')
for attempt in range(20):
    if child.poll() is not None:
        raise SystemExit(f'Server exited: see {STATE / "server.log"}')
    status, ours = response()
    if status == 200 and ours:
        print(json.dumps({'status': 'started', 'pid': child.pid, 'url': URL,
                          'http': status, 'log': str(STATE / 'server.log'),
                          'detached_session': os.getsid(child.pid)}, ensure_ascii=False))
        break
    time.sleep(.15)
else:
    raise SystemExit(f'Server did not respond yet: inspect {STATE / "server.log"} before retrying.')
