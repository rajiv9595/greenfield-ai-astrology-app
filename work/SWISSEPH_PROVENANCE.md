# Swiss Ephemeris Provenance (working notes — not a compliance determination)

Scope: license-alignment task only. No provider code has been vendored, unpacked into the build, or integrated. No claim is made that the archive is pinned or that the application is fully license-compliant.

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

## UNVERIFIED blockers (do not proceed with integration until each is checked)

- Upstream commit/revision: UNVERIFIED — local filename is only `master`; no upstream commit hash was recorded with the download.
- Release version: UNVERIFIED — no official release tag was confirmed (incidental in-archive string `libswe-2.10.03.so` under `contrib/android/libs/` is not a verified release identification).
- Ephemeris-data version/release: UNVERIFIED — data-file set (including `.se1` files) has not been matched to an official data release.
- Content match to official upstream revision: UNVERIFIED — local size/hash/entry count have not been compared against an official published artifact or repository revision.
- Redistribution conditions for the intended AGPL-3.0 route: UNVERIFIED — required notices, Corresponding Source handling, and network-source availability have not yet been fully implemented or reviewed.

## Project license intent (subject to the above)

- Intended application license: AGPL-3.0-only (see `LICENSE`, `package.json`, `DECISIONS.md` ADR-003).
- This intent is subject to explicit review of the actual upstream dependency revision, license text, required notices, archive integrity, and applicable redistribution conditions.
- Do not ship, vendor, or use Swiss Ephemeris code or data in a public service until the UNVERIFIED items above are resolved and recorded here.
