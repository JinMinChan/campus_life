"""Run real Chrome verification against a running local or GitHub Pages site.

Usage: python3 scripts/verify.py --url http://127.0.0.1:4173
       python3 scripts/verify.py --url https://jinminchan.github.io/campus_life
Uses a temporary Chrome profile; never reads or writes the user's Chrome profile.
The QA page suppresses game saves. These are automated tests, not manual QA or FPS.
"""
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
# Chrome CLI clamps narrow desktop windows to 500px; 390px touch layouts are
# additionally inspected through the in-app browser viewport override.
CASES = {
    'simulation': ('/tests.html', 'results', None, (1440, 960)),
    'gameplay': ('/?qa=1&fresh=1', 'qa-results', 'gameplay-overview.png', (1600, 1000)),
    'closeup': ('/?qa=1&fresh=1&view=close', 'qa-results', 'gameplay-closeup.png', (1600, 1000)),
    'story': ('/?qa=1&fresh=1&view=story', 'qa-results', 'gameplay-story.png', (1600, 1000)),
    'wish': ('/?qa=1&fresh=1&view=wish', 'qa-results', 'observation-wish.png', (1600, 1000)),
    'journal': ('/?qa=1&fresh=1&view=journal', 'qa-results', 'observation-journal.png', (1600, 1000)),
    'semester': ('/?qa=1&fresh=1&view=semester', 'qa-results', 'semester-ending.png', (1600, 1000)),
    'relationships': ('/?qa=1&fresh=1&view=relationships', 'qa-results', 'semester-relationships.png', (1600, 1000)),
    'mobile-wish': ('/?qa=1&fresh=1&view=wish', 'qa-results', 'observation-mobile-wish.png', (500, 844)),
    'mobile-journal': ('/?qa=1&fresh=1&view=journal', 'qa-results', 'observation-mobile-journal.png', (500, 844)),
    'selection': ('/?fresh=1', None, 'campus-selection.png', (1440, 960)),
    'mobile': ('/?qa=1&fresh=1', 'qa-results', 'mobile-layout.png', (500, 932)),
}


class ReportParser(HTMLParser):
    def __init__(self, target):
        super().__init__()
        self.target = target
        self.active = False
        self.text = ''
        self.ready = None
        self.setup_open = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id') == self.target:
            self.active = True
        if tag == 'body':
            self.ready = attrs.get('data-ready')
            self.setup_open = 'is-setting' in attrs.get('class', '').split()

    def handle_endtag(self, tag):
        if tag == 'pre':
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.text += data


def run_case(chrome, base_url, name, output, budget, timeout):
    path, target, screenshot, size = CASES[name]
    started = time.monotonic()
    result = {'case': name, 'url': base_url + path, 'pass': False}
    with tempfile.TemporaryDirectory(prefix='hanyang-qa-') as profile:
        command = [
            chrome, '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
            '--no-first-run', '--disable-background-networking', '--disable-extensions',
            '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            f'--user-data-dir={profile}', f'--window-size={size[0]},{size[1]}',
            '--hide-scrollbars', f'--virtual-time-budget={budget}', '--dump-dom',
        ]
        if screenshot:
            command.append('--screenshot=' + str(output / screenshot))
        command.append(base_url + path)
        try:
            run = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
            (output / f'{name}-dom.html').write_text(run.stdout, encoding='utf-8')
            (output / f'{name}-browser.log').write_text(run.stderr, encoding='utf-8')
            if run.returncode:
                raise RuntimeError(f'Chrome exited with code {run.returncode}')
            parser = ReportParser(target)
            parser.feed(run.stdout)
            if target:
                if not parser.text:
                    raise RuntimeError('Browser returned no test report; the suite did not complete')
                report = json.loads(parser.text)
                (output / f'{name}-results.json').write_text(
                    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                checks = report.get('checks', [])
                result['checks'] = len(checks)
                result['failed'] = [c.get('name', 'Unnamed check') for c in checks if c.get('pass') is not True]
                result['pass'] = (report.get('pass') is True and bool(checks)
                                  and not result['failed'] and not report.get('errors')
                                  and not report.get('error'))
                if report.get('error'):
                    result['error'] = report['error']
            else:
                result['pass'] = parser.ready == 'true' and parser.setup_open
                result['checks'] = 2
                if not result['pass']:
                    result['error'] = f'Expected loaded setup: ready={parser.ready}, setup={parser.setup_open}'
            if screenshot:
                screen = output / screenshot
                if not screen.is_file() or screen.stat().st_size < 1000:
                    result['pass'] = False
                    result['error'] = 'Chrome did not produce a valid screenshot'
                else:
                    result['screenshot'] = screenshot
        except (RuntimeError, subprocess.TimeoutExpired, ValueError) as error:
            result['error'] = str(error)
    result['wall_seconds'] = round(time.monotonic() - started, 2)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4173')
    parser.add_argument('--case', choices=CASES, action='append', help='Run only this case; may repeat')
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts')
    parser.add_argument('--budget-ms', type=int, default=6000, help='Chrome virtual time budget, not FPS measurement')
    parser.add_argument('--timeout', type=int, default=120, help='Real per-case timeout in seconds')
    args = parser.parse_args()
    chrome = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
    if not chrome:
        raise SystemExit('Chrome/Chromium was not found. Browser checks were not run.')
    if not args.url.startswith(('http://', 'https://')):
        parser.error('--url must be an HTTP(S) site, including its /campus_life base path when applicable')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    summary = {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'browser': subprocess.check_output([chrome, '--version'], text=True).strip(),
        'renderer': 'ANGLE SwiftShader (headless software WebGL)',
        'url': args.url.rstrip('/'),
        'cases': [],
    }
    for name in args.case or CASES:
        result = run_case(chrome, summary['url'], name, output, args.budget_ms, args.timeout)
        summary['cases'].append(result)
        print(f"{name}: {'PASS' if result['pass'] else 'FAIL'} ({result.get('checks', 0)} checks, {result['wall_seconds']}s)", flush=True)
        if result.get('failed'):
            print('  Failed: ' + ', '.join(result['failed']), flush=True)
        if result.get('error'):
            print('  ' + result['error'], flush=True)
    summary['pass'] = all(case['pass'] for case in summary['cases'])
    filename = 'verification-summary.json' if not args.case else 'verification-selected-summary.json'
    (output / filename).write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if not summary['pass']:
        raise SystemExit('Verification failed; inspect the JSON reports and browser logs.')
    print('ALL REQUESTED BROWSER CHECKS PASSED')


if __name__ == '__main__':
    main()
