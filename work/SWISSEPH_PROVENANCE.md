# Swiss Ephemeris Provenance (working notes — not a compliance determination)

Scope: license alignment plus Phase 3A upstream verification plus Phase 3B provider adapter. The adapter calls the pinned revision below; no provider code, binary, or data is committed to this repository. Full application license compliance (Corresponding Source, network-source availability) is still open.

## Local archive observed

- Filename: `work/swisseph-master.zip`
- Size: 376316445 bytes
- SHA-256: `FD9B47F99E7DFF22CC35AFF4141233446C120411EB0F3D07716C4C8CA5D0EBE4`
- Zip entry count: 469
- Integrity check: Python `zipfile.testzip()` returned `None` (no CRC failure detected in the local file). This checks local readability only; it does not verify authenticity or completeness against upstream.
- `vendor/` status at time of writing: empty (no dependency vendored in this task).
- Commit status: the 376 MB ZIP is intentionally untracked and must not be committed.

## Licensing information observed inside the archive (verbatim summary, not altered)

- `swisseph-master/LICENSE` header states: `Copyright (C) 1997 - 2021 Astrodienst AG, Switzerland. All rights reserved.`
- Same header states Swiss Ephemeris is made available under a dual licensing system: `a) GNU Affero General Public License (AGPL)` or `b) Swiss Ephemeris Professional License`, with the choice to be made before distributing software containing parts of Swiss Ephemeris or activating any public service using the developed software.
- Same header states the AGPL choice includes the obligation to place the whole software project under the AGPL or a compatible license, and points to `https://www.gnu.org/licenses/agpl-3.0.html`.
- Same header lists authors as Dieter Koch and Alois Treindl, and states author/copyright-holder names must not be used for promotion except where written permission was given. Copyright and license notices must be preserved on copies.
- `swisseph-master/agpl-3.0.txt` is present in the archive.
- `swisseph-master/LICENSE.TXT` content observed: `LICENSE` (single word plus newline).
- Upstream license texts were not modified in this task. Official copyright and license notices are preserved in their original form in the archive.

## Upstream match: VERIFIED (archive-to-revision)

- Official repository: `https://github.com/aloistr/swisseph`
- Exact revision: `aacf962d19d79f8bc921dbcdaacf306d85be1917` (master HEAD, committed 2026-10-01T08:08:04Z by Alois Treindl, message `Rename contract PDF to secont_e_2609.pdf`). `git ls-remote` and the GitHub commits API agree on this SHA.
- Evidence: all 448 archive files match upstream by name (no extras, no missing), and all 448 match upstream by Git blob SHA-1 (`git ls-tree -r HEAD` vs locally computed blob hashes, 448/448, 0 diffs). A 23-file SHA-256 sample via `git show HEAD:<path>` also matched. The only structural difference is the expected GitHub-archive representation of 22 symlinks (mode `120000`, including `LICENSE.TXT` and 21 files under `contrib/android/jni/`) as files containing the link-target string; their contents hash to the upstream symlink blobs. Full methodology in `docs/SWISSEPH_VERIFICATION.md`.
- Release context: HEAD is an untagged post-release master commit, newer than tags `v2.10.03` (2022-08-27) and `v2.10.3final` (2026-04-14, `now created with DE441`). In-tree `sweph.h` defines `SE_VERSION "2.10.03"` (a library version string, not a release identification). Bundled `.se1` data files match this commit; their documented generation is the JPL DE441 rebuild of 14 April 2026 per the in-archive `readme.md`. There is no separate ephemeris-data version tag upstream; data is versioned by repository commit.
- Local archive SHA-256 (unchanged): `FD9B47F99E7DFF22CC35AFF4141233446C120411EB0F3D07716C4C8CA5D0EBE4`.

## Status of former blockers

- Upstream commit/revision: VERIFIED — `aacf962d19d79f8bc921dbcdaacf306d85be1917`.
- Release version: CLARIFIED — untagged post-release HEAD; latest tags `v2.10.03` / `v2.10.3final` recorded in `docs/SWISSEPH_VERIFICATION.md`. Do not cite `libswe-2.10.03.so` filenames or `SE_VERSION` as a release.
- Ephemeris-data version/release: BUNDLED DATA VERIFIED TO COMMIT — all 262 `ephe/` entries match HEAD; generation documented as DE441 rebuild (2026-04-14). Residual: numerical accuracy still requires reference-vector tests in a later task; external JPL/asteroid sets were not compared.
- Content match to official upstream revision: VERIFIED — 448/448 files, see above.
- Redistribution conditions for the intended AGPL-3.0 route: STILL OPEN — required notices are preserved in the archive, but Corresponding Source handling and network-source availability (§13) are not yet implemented; see `RELEASE_CHECKLIST.md`. No provider code is integrated yet.

## Phase 3B adapter (implemented, pinned to the revision above)

- Adapter: `packages/swiss-ephemeris` (`SwissEphemerisProvider` behind the
  provider-neutral `EphemerisProvider` contract). Single provider, no mixing.
- Runtime inputs: one batched official `swetest` call per `positionAt`
  (`-eswe -sid1 -ut -bj<jdUt> -p0123456m -fPl -ep -head`); Ketu derived as
  exactly Rahu + 180° in integer microarcseconds; provenance records
  provider `swiss-ephemeris 2.10.03 (upstream aacf962d)`, data
  `DE441-2026-04-14 (upstream commit aacf962d...)`, and calculation settings.
- Build: upstream sources unmodified; MinGW console build of official
  `swetest.c` with build-only flags (`-Dfp=swe_console_fp`,
  `-include winshim-decl.h`) plus a 3-line stdout shim (`winshim.c`) because
  upstream's `_WINDOWS` path expects its GUI host's `fp` global. Full recipe
  in `packages/swiss-ephemeris/BUILD.md`. Binary and `.se1` data live outside
  the repository (`SWEPH_BIN` / `SWEPH_EPHE_PATH`).
- Reference anchors (raw responses in `docs/reference-responses/`, goldens in
  `tests/unit/swiss-ephemeris-golden.ts`): astro.com hosted swetest v2.10.03
  worst difference 4.98e-8 deg (0.00018 arcsec) over 3 instants x 8 bodies;
  JPL Horizons DE441 LT vectors worst difference 0.17 arcsec (Moon; all
  others <= 0.06 arcsec). First-principles Lahiri ayanamsha check from a
  different lineage is recorded as a pending test, not claimed.

## Project license intent (subject to the above)

- Intended application license: AGPL-3.0-only (see `LICENSE`, `package.json`, `DECISIONS.md` ADR-003).
- The upstream revision above is verified and the adapter is implemented, but redistribution readiness is not: do not ship or use Swiss Ephemeris code or data in a public service until Corresponding Source and network-source availability are implemented.
