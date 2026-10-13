# Swiss Ephemeris Upstream Verification Report (Phase 3A)

Question: can the local archive `work/swisseph-master.zip` be matched reliably to an exact official upstream revision?

## Final status: VERIFIED

The local archive's complete file set (448 files) is byte-identical to the official upstream repository at commit `aacf962d19d79f8bc921dbcdaacf306d85be1917`.

This verifies the archive-to-revision match only. It is not a determination that the application is fully license-compliant: AGPL Corresponding Source and network-source availability (§13) are still open per `RELEASE_CHECKLIST.md`, and the ephemeris adapter is still unimplemented.

## 1. Official repository and exact revision

- Repository: `https://github.com/aloistr/swisseph`
- HEAD / `refs/heads/master` at time of check: `aacf962d19d79f8bc921dbcdaacf306d85be1917`
- Commit date: 2026-10-01T08:08:04Z (committer Alois Treindl, `alois@astro.ch`)
- Commit message: `Rename contract PDF to secont_e_2609.pdf`
- Verification of HEAD: `git ls-remote` and GitHub commits API agree on the SHA; a `--filter=blob:none --sparse` clone resolves HEAD to the same SHA with the same log line.
- Tags (from `git ls-remote --tags` and tags API, 24 tags): latest release tags are `v2.10.03` (`175e1fcb…`, 2022-08-27) and `v2.10.3final` (`af9823fe…`, 2026-04-14, message `now created with DE441`). HEAD `aacf962` is an untagged post-release master commit, newer than all tags. `git describe --tags HEAD` could not run in the shallow tagless clone (expected; tags were read via ls-remote/API instead).
- In-tree version identifiers (not release tags, recorded here so they are not misused): `sweph.h` defines `SE_VERSION "2.10.03"`; `contrib/android/libs/*` are named `libswe-2.10.03.so`. These are library version strings, not proof of release.
- Official download documentation reviewed: `https://www.astro.com/swisseph/swedownload_e.htm` confirms the GitHub repository as the source-code authority, the `ephe` folder (also mirrored to Dropbox) as the planetary-data location, JPL files as externally sourced with published md5 keys, and asteroid files as a separate large set (29 GB in 2023). The in-archive `readme.md` (last update 14-apr-2026) states all `.se1` planet/asteroid files were rebuilt with JPL ephemeris DE441 as of 14 April 2026 and remain compatible back to release 1.67.

## 2. Source-tree comparison results and methodology

Local archive facts (reconfirmed): 376316445 bytes, SHA-256 `FD9B47F99E7DFF22CC35AFF4141233446C120411EB0F3D07716C4C8CA5D0EBE4`, 469 zip entries = 448 files + 21 directories, `zipfile.testzip()` returns `None`.

Method (all extraction/comparison work done in `Temp\opencode\swisseph-verify`, outside the application source tree; the 376 MB ZIP was never committed and `vendor/` remains empty):

1. `git clone --depth 1 --filter=blob:none --sparse https://github.com/aloistr/swisseph` into the temp dir; confirmed HEAD `aacf962` / 2026-10-01.
2. Manifest comparison: `git ls-files` upstream = 448 tracked files; zip file entries (prefix `swisseph-master/` stripped) = 448 files. Name sets are exactly equal (no extras, no missing).
3. Content comparison, two independent ways:
   - SHA-256 of extracted bytes vs `git show HEAD:<path>` for 23 representative files (all core C sources `sweph.c/.h`, `swephexp.h`, `swedate.c`, `swehouse.c`, `swejpl.c`, `swemmoon.c`, `swemplan.c`, `swecl.c`, `swehel.c`, `swephlib.c`, `Makefile`, `.gitattributes`, `LICENSE`, `LICENSE.TXT`, `agpl-3.0.txt`, plus `ephe/seas_168.se1`, `ephe/seplm18.se1`, `ephe/sefstars.txt`, `ephe/seorbel.txt`, `seleapsec.txt`, `doc/swisseph.htm`, `doc/swephprg.pdf`): 23/23 MATCH.
   - Git blob SHA-1 (`blob <len>\0<bytes>`) computed locally for every zip file vs `git ls-tree -r HEAD` blob SHAs: **448/448 MATCH, 0 diffs**.
4. Expected GitHub-archive vs checkout differences: the only structural difference is 22 symlinks (mode `120000`: `LICENSE.TXT` plus 21 files under `contrib/android/jni/`), which the GitHub archive materializes as small files containing the link-target string. Their contents hash exactly to the upstream symlink blob SHAs, so this is the expected representation difference, not a content difference. There is no `.git` directory in the archive (expected). `.gitattributes` contains one rule (`*.se1 binary`); no text-conversion mismatches were observed (all non-symlink blob hashes match, ruling out CRLF rewriting).

An initial full-clone attempt (`git clone --depth 1` with all blobs) exceeded the 120 s tool timeout and was abandoned; the `blob:none` + `ls-tree` blob-hash method above is complete and does not depend on it. A 263-file sequential `git show` loop also timed out and was superseded by the single-pass blob-hash comparison.

## 3. Ephemeris-data provenance and remaining uncertainty

- Separated from software source as required: the archive holds 262 files under `ephe/` (185 `.se1` binaries plus text/metadata and `ephe/ep4/`, `ephe/sat/` subtrees).
- All 262 `ephe/` entries are in the 448/448 name match, and all 448 blob hashes match HEAD — so the bundled data files are exactly the data files tracked at upstream commit `aacf962`, not merely co-located. Two sampled `.se1` binaries (`seas_168.se1`, `seplm18.se1`) also matched via direct SHA-256 vs `git show`.
- Documented generation: in-archive `readme.md` ties the `.se1` set to the JPL DE441 rebuild of 14 April 2026 (consistent with tag `v2.10.3final` message `now created with DE441`). `swephexp.h` references `SE_TIDAL_DE441`.
- Residual uncertainty (not blockers for the revision match, recorded for later tasks): there is no separate ephemeris-data version file or data-only tag upstream — data is versioned only by repository commit; numerical correctness of the data (positional accuracy) has not been validated here — that requires reference-vector tests in a later task; external sets outside this archive (JPL `.eph` files, full asteroid collection, Dropbox mirrors) were not compared and are out of scope.

## 4. License and notice review findings

- Archive contains `LICENSE` (dual-license header, see `work/SWISSEPH_PROVENANCE.md`), `LICENSE.TXT` (symlink to `LICENSE`), `agpl-3.0.txt`, and `doc/secont_e_2609.pdf` (professional-license contract document matching the HEAD commit subject). Source headers inspected (`sweph.c`, `swephexp.h`, `sweph.h`) carry the `Copyright (C) 1997 - 2021 Astrodienst AG` dual-license header naming Dieter Koch and Alois Treindl. Upstream texts were not modified.
- Obligations still needing review before any public service (unchanged by this task): preserve all copyright/license notices; keep the whole project under AGPL-3.0-only or a confirmed-compatible license; implement AGPL Corresponding Source delivery and remote network-source availability (§13, already on `RELEASE_CHECKLIST.md`); do not use author/copyright-holder names for promotion without written permission.
- No planetary-calculation code was added and no provider adapter was implemented in this task; the calculation core and its conventions are unchanged.

## 5. Commands executed and outcomes

- `git status`, `git branch --show-current`, `git log --oneline -3` — clean tree, `master`, `aeb8238` on top. Outcome: baseline preserved.
- `git ls-remote https://github.com/aloistr/swisseph HEAD` — `aacf962…`. Outcome: HEAD established.
- `git ls-remote --tags …` — 24 tags through `v2.10.3final`. Outcome: tag landscape established.
- GitHub API `commits/aacf962`, `tags?per_page=100`, `commits/af9823`, `commits/175e1fc` — dates/messages as in §1. Outcome: metadata confirmed.
- WebFetch of `https://www.astro.com/swisseph/swedownload_e.htm` — confirmed repo/ephe/JPL/asteroid sources. Outcome: download authority documented.
- `git clone --depth 1 …` (full) — timed out at 120 s, abandoned without side effects on the repo. Outcome: documented failure, superseded.
- `git clone --depth 1 --filter=blob:none --sparse …` — success, HEAD `aacf962`, log line matches API. Outcome: upstream reference obtained.
- Zip manifest/name-set/blob-hash comparisons (Python `zipfile` + `hashlib` + `git ls-files`/`ls-tree`/`show`) — 448/448 names, 448/448 blob hashes, 23/23 sampled SHA-256. Outcome: match proven.
- `git describe --tags HEAD` — failed (`No names found`, shallow clone has no tags). Outcome: expected limitation; tags sourced from ls-remote/API instead.

## 6. Recommended smallest safe next action

Archive-to-revision match is VERIFIED, so the provenance gate in `STATUS.md` is satisfied for this archive. The smallest safe next action is a separately approved task to implement the provider adapter against pinned commit `aacf962` plus reference-vector tests — still no database, AI, deployment, or production-service changes.
