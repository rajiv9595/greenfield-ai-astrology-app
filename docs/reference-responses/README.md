# Raw reference responses (Phase 3B golden set)

Raw, unmodified responses fetched live on 2026-10-13 to build the embedded
golden vectors in `tests/unit/swiss-ephemeris-golden.ts`. Kept so every
reference vector is traceable to its source bytes.

- `astro_{A,B,C}.txt` — astro.com hosted swetest (`/cgi/swetest.cgi`,
  server version 2.10.03) for the three golden instants with
  `arg='-sid1 -ut -bj<jdUt>'`. Golden instants:
  A = 2000-01-01T12:00:00Z (JD 2451545.0),
  B = 1990-04-21T09:00:00Z (JD 2448002.875),
  C = 2024-02-29T18:30:00Z (JD 2460370.2708333335).
- `horizons_{instant}_{body}.txt` — JPL Horizons API vectors
  (`EPHEM_TYPE=VECTORS`, `CENTER='500@399'` geocentric,
  `TIME_TYPE=UT`, `REF_PLANE=ECLIPTIC`, `VEC_TABLE=1`, `VEC_CORR=LT`,
  CSV). Instant A covers Sun/Moon/Mercury/Venus/Mars/Jupiter/Saturn;
  instants B and C cover Sun/Moon/Saturn.
- `golden.json` — machine-readable manifest produced by the fetch script,
  including per-value source mapping and request URLs.

Retrieval: standalone stdlib-only Python run from the build machine (no
repository dependency, no paid API). Values embedded in tests are exact
transcriptions/parses of these files; tolerances are documented in
`tests/unit/swiss-ephemeris-golden.ts`.
