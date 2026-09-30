"""Run once, manually, from /work/generator's own venv:
    /work/generator/.venv/bin/python /work/workspace-auth/tests/generate_fixtures.py
Regenerate only if the roster payload shape or the pyrage/age-encryption
wire format ever changes -- this is a committed fixture, not built at
test time, so workspace-auth's own test suite has no Python dependency.
"""
from workspace_auth.roster import create_roster

TEST_PASSPHRASE = "test-fixture-passphrase-not-a-real-secret"

ciphertext = create_roster(
    workspace_repo="OpenFASTER-Standard/test-workspace",
    github_token="github_pat_fake_fixture_token",
    passphrase=TEST_PASSPHRASE,
)
with open("/work/workspace-auth/tests/fixtures/test-workspace.age", "wb") as f:
    f.write(ciphertext)
print("wrote", len(ciphertext), "bytes")
