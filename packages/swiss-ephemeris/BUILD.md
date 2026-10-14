# Building the pinned swetest binary (Phase 3B)

The adapter (`src/provider.ts`) shells out to the official `swetest`
utility. The binary and ephemeris data are **not** committed; they are
built/extracted from the pinned archive `work/swisseph-master.zip`
(revision `aacf962d19d79f8bc921dbcdaacf306d85be1917`) into a directory
outside the repository, then referenced via `SWEPH_BIN` / `SWEPH_EPHE_PATH`.

## Upstream build support and platforms

- The upstream `Makefile` supports Linux and macOS only (it branches on
  `uname` and links `-ldl` on Linux). There is no upstream MinGW target;
  native Windows builds are served by `windows/` (MSVC project files).
- Upstream `sweodef.h` defines `_WINDOWS` whenever `_WIN32` is defined and
  `swetest.c` then expects a global `FILE *fp` that official Windows builds
  provide via their GUI host. A MinGW console build therefore needs a small
  build-only compatibility shim (below). Upstream sources are unmodified.

## Reproducible MinGW build (used for Phase 3B reference tests)

From the extracted `swisseph-master/` directory:

```sh
gcc -Dfp=swe_console_fp -include<tmp>/winshim-decl.h -g -Wall \
  -o <tmp>/swetest.exe \
  swetest.c swedate.c swehouse.c swejpl.c swemmoon.c swemplan.c \
  sweph.c swephlib.c swecl.c swehel.c <tmp>/winshim.c -lm
```

- `winshim.c` (build directory only, not upstream): defines the
  `FILE *swe_console_fp` global and points it at `stdout` in a constructor.
- `winshim-decl.h`: `extern FILE *swe_console_fp;` so the renamed reference
  in `swetest.c` compiles.
- `-Dfp=swe_console_fp` renames exactly two scopes in `swetest.c`: the
  global use in `do_printf` and one local `FILE *fp` (fixstar reader),
  both of which keep working after renaming.
- Verify with `swetest -h` (reports `Version: 2.10.03`) and the reference
  tests in `tests/unit/swiss-ephemeris-reference.test.ts`.

## Runtime invocation used by the adapter

```
swetest -edir<ephePath> -eswe -sid1 -ut -bj<jdUt, 9 decimals> \
  -p0123456m -fPl -ep -head
```
- `-eswe`: Swiss (compressed DE441) files, the only provider in use.
- `-sid1`: sidereal zodiac, Lahiri/Chitrapaksha (method 1).
- `-ut` with `-bj<jd>`: input Julian Day is Universal Time; swetest adds
  ΔT internally (`te = t + delt` in `swetest.c`), matching the adapter's
  JD(UT) computation. Omitting `-ut` would silently compute in Ephemeris
  Time (≈2.7″ error in 2000), so the flag is mandatory.
- Geocentric output is the swetest default (no `-hel`/`-bary`/`-topo`).
- `m` selects the **mean** lunar node per the V1 conventions; Ketu is
  derived in TypeScript as exactly Rahu + 180°.
- The J2000 comparison mode used only by reference tests is
  `-noaberr -nodefl -nonut -j2000` (geometric light-time-corrected J2000
  ecliptic longitudes, matching JPL Horizons LT vectors on REF_PLANE
  ECLIPTIC). It is not part of the adapter's production path.

## Reproducible live verification in CI (audit finding E1)

The default `verify` CI job intentionally runs the suite without ephemeris
assets, so live-gated tests skip there and the offline fail-closed behavior
stays covered. A separate `live-ephemeris` CI job provisions the exact
pinned sources and data, then runs the full suite with the live
environment so all 17 live-gated tests execute (a green job that still
skips them fails its assertion step).

Provisioning (`scripts/provision-sweph.sh`, no repository writes):

1. Shallow-fetches exactly `SWISS_EPHEMERIS_UPSTREAM_REVISION`
   (`build-info.ts`; a CI step fails if the script's revision or library
   version drifts from that file) from the official upstream repository
   into a runner-temp directory (never committed).
2. Fails unless `git rev-parse HEAD` equals the pinned revision and the
   tree is clean — git content addressing is the revision-identity proof.
3. Fails unless every file under `ephe/` matches `ephe-sha256.txt`
   (`sha256sum -c`). That manifest (262 files) was generated from the
   Phase 3A archive-to-revision verification, which matched all 448
   upstream blobs including all 262 `ephe/` entries, so it is the upstream
   data manifest for the pinned commit.
4. Builds `swetest` with the unmodified upstream Linux Makefile
   (`make swetest`; the MinGW `winshim` documented above is a Windows-only
   build artifact and is not used) and fails unless the binary reports
   the pinned library version (`2.10.03`).
5. Prints `SWEPH_BIN` / `SWEPH_EPHE_PATH`; the workflow passes them as job
   environment — no developer-machine paths anywhere.

The job then runs `npm test -- --reporter=verbose` and asserts the
summary counts (`Test Files` and `Tests` passed equal collected, e.g.
69 passed of 69) with zero occurrences of "skipped". Skip logic, tests,
and expectations are unchanged: the same suite runs offline (skipping
live tests) and live (executing them).
