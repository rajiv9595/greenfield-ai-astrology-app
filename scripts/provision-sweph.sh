#!/usr/bin/env bash
#
# Provision the pinned Swiss Ephemeris sources and ephemeris data for live
# verification (CI hardening for audit finding E1).
#
# Usage:
#   bash scripts/provision-sweph.sh <checkout-dir> <manifest-file>
#
# What it does, in order (fails closed at every step):
#   1. Fetches exactly the pinned upstream revision
#      (PINNED_REVISION, must match SWISS_EPHEMERIS_UPSTREAM_REVISION in
#      packages/swiss-ephemeris/src/build-info.ts — enforced by a CI step)
#      from the official upstream repository into <checkout-dir>.
#   2. Verifies the checked-out revision identity
#      (`git rev-parse HEAD` must equal the pinned revision) and that the
#      working tree is clean.
#   3. Verifies every file under ephe/ against the SHA-256 manifest
#      (packages/swiss-ephemeris/ephe-sha256.txt), which was generated from
#      the Phase 3A archive-to-revision verification (448/448 blob match).
#   4. Builds swetest with the upstream Linux Makefile (unmodified sources)
#      and smoke-checks the reported library version.
#
# On success it prints the two environment paths to stdout:
#   SWEPH_BIN=<absolute path to the built swetest binary>
#   SWEPH_EPHE_PATH=<absolute path to the verified ephe/ directory>
#
# It never writes into the application repository, commits anything, uses
# secrets, or substitutes another revision or mock data. License note: the
# checkout is built and used for verification only; redistribution and
# public-service readiness remain governed by work/SWISSEPH_PROVENANCE.md
# and RELEASE_CHECKLIST.md.
set -euo pipefail

# Must match SWISS_EPHEMERIS_UPSTREAM_REVISION in
# packages/swiss-ephemeris/src/build-info.ts (CI checks this).
PINNED_REVISION="aacf962d19d79f8bc921dbcdaacf306d85be1917"
# Must match SWISS_EPHEMERIS_LIBRARY_VERSION in the same file (CI checks).
EXPECTED_VERSION="2.10.03"
UPSTREAM_REPO="https://github.com/aloistr/swisseph"

if [ "$#" -ne 2 ]; then
  echo "usage: bash scripts/provision-sweph.sh <checkout-dir> <manifest-file>" >&2
  exit 2
fi
CHECKOUT_DIR="$1"
MANIFEST_FILE="$2"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "provision-sweph: manifest not found: $MANIFEST_FILE" >&2
  exit 1
fi
# Absolute manifest path (the verification runs from the checkout root).
MANIFEST_ABS="$(cd "$(dirname "$MANIFEST_FILE")" && pwd)/$(basename "$MANIFEST_FILE")"

if [ ! -d "$CHECKOUT_DIR/.git" ]; then
  if [ -e "$CHECKOUT_DIR" ]; then
    echo "provision-sweph: refusing to use non-git path: $CHECKOUT_DIR" >&2
    exit 1
  fi
  git init -q "$CHECKOUT_DIR"
  git -C "$CHECKOUT_DIR" remote add origin "$UPSTREAM_REPO"
fi
git -C "$CHECKOUT_DIR" fetch --depth 1 origin "$PINNED_REVISION"
git -C "$CHECKOUT_DIR" checkout --force --quiet "$PINNED_REVISION"

actual_revision="$(git -C "$CHECKOUT_DIR" rev-parse HEAD)"
if [ "$actual_revision" != "$PINNED_REVISION" ]; then
  echo "provision-sweph: revision mismatch: $actual_revision != $PINNED_REVISION" >&2
  exit 1
fi
if [ -n "$(git -C "$CHECKOUT_DIR" status --porcelain)" ]; then
  echo "provision-sweph: checkout tree is not clean" >&2
  exit 1
fi
echo "provision-sweph: checked out upstream revision $actual_revision"

(cd "$CHECKOUT_DIR" && sha256sum -c "$MANIFEST_ABS")
echo "provision-sweph: ephemeris data integrity verified against manifest"

make -C "$CHECKOUT_DIR" swetest
if [ ! -x "$CHECKOUT_DIR/swetest" ]; then
  echo "provision-sweph: built swetest binary missing: $CHECKOUT_DIR/swetest" >&2
  exit 1
fi
reported_version="$("$CHECKOUT_DIR/swetest" -h | grep -oE 'Version: [0-9.]+' | head -n 1)"
if [ "$reported_version" != "Version: $EXPECTED_VERSION" ]; then
  echo "provision-sweph: unexpected swetest version: $reported_version" >&2
  exit 1
fi
echo "provision-sweph: built swetest reports $reported_version"

echo "SWEPH_BIN=$CHECKOUT_DIR/swetest"
echo "SWEPH_EPHE_PATH=$CHECKOUT_DIR/ephe"
