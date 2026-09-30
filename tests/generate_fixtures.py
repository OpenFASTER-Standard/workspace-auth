"""Run once, manually, from a `generator` checkout's own venv:
    <generator-checkout>/.venv/bin/python <this-repo>/tests/generate_fixtures.py
Regenerate only if the roster payload shape or the pyrage/age-encryption
wire format ever changes -- these are committed fixtures, not built at
test time, so workspace-auth's own test suite has no Python dependency.
"""
import json
from pathlib import Path

from pyrage import passphrase as age_passphrase
from workspace_auth.roster import create_roster

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
ROSTERS_DIR = REPO_ROOT / "rosters"

TEST_PASSPHRASE = "test-fixture-passphrase-not-a-real-secret"


def _write(path: Path, data: bytes) -> None:
    path.write_bytes(data)
    print("wrote", len(data), "bytes to", path)


# The main, well-formed fixture used by most tests via page.route mocking.
_write(
    FIXTURES_DIR / "test-workspace.age",
    create_roster(
        workspace_repo="OpenFASTER-Standard/test-workspace",
        github_token="github_pat_fake_fixture_token",
        passphrase=TEST_PASSPHRASE,
    ),
)

# Decrypts fine under TEST_PASSPHRASE, but the plaintext is missing
# github_token -- proves the page's own shape validation, independent of
# generator's server-side read_roster (which this file never calls).
_write(
    FIXTURES_DIR / "incomplete-workspace.age",
    age_passphrase.encrypt(
        json.dumps({"workspace_repo": "owner/repo"}).encode("utf-8"), TEST_PASSPHRASE
    ),
)

# Committed into the real rosters/ directory (not tests/fixtures/) so one
# test can prove the whole path end to end with no page.route mock at all.
_write(
    ROSTERS_DIR / "test-workspace-real.age",
    create_roster(
        workspace_repo="OpenFASTER-Standard/test-workspace-real",
        github_token="github_pat_fake_fixture_token",
        passphrase=TEST_PASSPHRASE,
    ),
)
