"""Publish a fully encoded capture set; preserve the previous release on failure."""
import json
import os
import pathlib
import shutil

FEATURES = ('replay-pack', 'evidence-lab', 'source-workbench', 'model-controls', 'demo-kit')
ASSETS = tuple(f'{feature}.{suffix}' for feature in FEATURES for suffix in ('gif', 'mp4')) + ('recordings.json', 'README.md')


def prepare_release(release, run):
    staged = run / 'derived'
    if release.exists():
        shutil.copytree(release, staged)  # Preserve unrelated files in this directory.
    else:
        staged.mkdir()
    return staged


def promote_release(staged, release, run):
    """Directory renames keep file sets together; retain the prior set for recovery."""
    for name in ASSETS:
        if not (staged / name).is_file():
            raise ValueError(f'Capture export is missing: {name}')
    previous = run / 'previous'
    if previous.exists():
        raise ValueError('This run already has a previous release; do not overwrite it')
    journal = run / 'promotion.json'
    release.parent.mkdir(parents=True, exist_ok=True)
    try:
        preserve_previous(staged, release, run)
        os.replace(staged, release)
    except BaseException:
        if previous.exists() and not release.exists():
            os.replace(previous, release)
        raise
    journal.write_text(json.dumps({'state': 'published', 'release': str(release)}) + '\n')


def preserve_previous(staged, release, run):
    """First promotion phase, also used to exercise recovery with real filesystem operations."""
    previous = run / 'previous'
    if previous.exists():
        raise ValueError('Previous release already preserved')
    (run / 'promotion.json').write_text(json.dumps({'state': 'prepared', 'release': str(release), 'staged': str(staged)}) + '\n')
    if release.exists():
        os.replace(release, previous)


def recover_release(release, run):
    """Recover the rename gap after process termination, without replacing a live set."""
    journal = json.loads((run / 'promotion.json').read_text())
    if journal['state'] != 'prepared' or pathlib.Path(journal['release']) != release:
        raise ValueError('No interrupted promotion for this release')
    if release.exists():
        raise ValueError('A release already exists; inspect it before recovery')
    os.replace(run / 'previous', release)
    (run / 'promotion.json').write_text(json.dumps({'state': 'recovered', 'release': str(release)}) + '\n')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Recover a capture interrupted between directory renames')
    parser.add_argument('--recover', required=True, help='Run directory under tmp/recordings/public-service')
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parent.parent
    run = (root / args.recover).resolve()
    if not run.is_relative_to(root / 'tmp/recordings/public-service'):
        parser.error('Recovery must use a public-service capture run directory')
    recover_release(root / 'demo/public-service', run)
