# Attribution Notice — Swiss Ephemeris usage

This package calls the Swiss Ephemeris orthodox calculation engine as an
external binary. The engine's copyright and license notices are preserved
unmodified in the pinned upstream source archive and are summarized here
without alteration of their meaning:

- Copyright (C) 1997 - 2021 Astrodienst AG, Switzerland. All rights reserved.
- Authors: Dieter Koch and Alois Treindl.
- Upstream repository: https://github.com/aloistr/swisseph
- Pinned revision: `aacf962d19d79f8bc921dbcdaacf306d85be1917`
  (verified in docs/SWISSEPH_VERIFICATION.md).
- License: dual-licensed under either the GNU Affero General Public License
  (AGPL; full text in the upstream archive as `agpl-3.0.txt`) or the Swiss
  Ephemeris Professional License. This project has selected the AGPL route:
  the application license is AGPL-3.0-only (see LICENSE, package.json).
- The names of the authors and of Astrodienst must not be used to promote
  software, products, or services using the Swiss Ephemeris without their
  written permission.

No Swiss Ephemeris source code, binaries, or ephemeris data files are
committed to this repository. The compiled binary and `.se1` data files
used at runtime come exclusively from the pinned revision above.
