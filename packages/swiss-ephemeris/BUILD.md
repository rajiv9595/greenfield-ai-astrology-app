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
