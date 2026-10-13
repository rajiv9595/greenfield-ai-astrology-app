# Risks

| Risk | Status | Mitigation |
|---|---|---|
| Ephemeris licensing | Open | Intended application license is AGPL-3.0-only, subject to upstream verification; do not ship/vendor/integrate Swiss Ephemeris code or data until revision, license text, notices, integrity, and redistribution conditions are verified and recorded. |
| Calculation correctness | Open | Use licensed reference vectors and boundary tests before AI features. |
| Misleading predictions | Open | Use disclosures, evidence citations, and no probability claims. |
| User-data isolation | Open | Apply and test Row Level Security before persistence launches. |
