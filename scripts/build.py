"""Build and validate the offline static site for a GitHub Pages subdirectory."""
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist'
DEST.mkdir(exist_ok=True)

for name in ('src', 'public'):
    shutil.copytree(ROOT / name, DEST / name, dirs_exist_ok=True)
for name in ('index.html', 'tests.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md'):
    shutil.copy2(ROOT / name, DEST / name)
(DEST / 'scripts').mkdir(exist_ok=True)
for name in ('simulation_checks.mjs', 'semester_checks.mjs'):
    shutil.copy2(ROOT / 'scripts' / name, DEST / 'scripts' / name)
(DEST / '.nojekyll').write_text('', encoding='utf-8')

required = (
    'index.html', 'src/main.js', 'src/world.js', 'src/simulation.js',
    'src/style.css', 'public/vendor/three.module.js',
    'public/vendor/OrbitControls.js', 'public/data/campus.json',
    'src/qa.js', 'scripts/simulation_checks.mjs', 'src/semester.js',
    'src/semester-ui.js', 'src/semester.css', 'scripts/semester_checks.mjs',
)
for name in required:
    path = DEST / name
    assert path.is_file() and path.stat().st_size > 0, f'Missing static asset: {name}'


class LocalLinks(HTMLParser):
    """Reject missing files and root-relative URLs that break project Pages."""
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('href', 'src', 'poster') or not value:
                continue
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            assert not parsed.path.startswith('/'), f'Use a relative URL for Pages: {value}'
            path = (DEST / unquote(parsed.path)).resolve()
            assert path.is_relative_to(DEST), f'URL escapes the static build: {value}'
            assert path.exists(), f'Missing linked static asset: {value}'


for name in ('index.html', 'tests.html'):
    LocalLinks().feed((DEST / name).read_text(encoding='utf-8'))
data = json.loads((DEST / 'public/data/campus.json').read_text(encoding='utf-8'))
assert len(data['buildings']) == 62, 'Expected the full 62-building campus map'
assert data['roads'] and data['terrain']['heights'], 'Campus roads or terrain are missing'

# This integrity record makes local and deployed assets directly comparable.
# Screenshots, raw map data, and local server state are not published.
assets = [p for name in ('src', 'public') for p in (DEST / name).rglob('*') if p.is_file()]
assets += [DEST / name for name in ('index.html', 'tests.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md', '.nojekyll')]
assets += [DEST / 'scripts' / name for name in ('simulation_checks.mjs', 'semester_checks.mjs')]
manifest = {
    'schema': 1,
    'files': {str(p.relative_to(DEST)): sha256(p.read_bytes()).hexdigest() for p in sorted(assets)},
}
(DEST / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
size = sum(p.stat().st_size for p in assets)
print(f'BUILD OK: {DEST} ({len(data["buildings"])} buildings, {len(assets)} files, {size / 1024 / 1024:.2f} MiB)')
print('Relative asset URLs verified; ready for /campus_life/ on GitHub Pages.')
