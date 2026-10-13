# Risks

| Risk | Status | Mitigation |
|---|---|---|
| Ephemeris licensing | Open | Intended application license is AGPL-3.0-only; upstream revision aacf962 verified and adapter implemented. Do not deploy a public service until Corresponding Source and network-source availability are implemented. |
| Calculation correctness | Open | Pinned adapter anchored to astro.com (<=0.0002") and JPL Horizons DE441 (<=0.2"); first-principles ayanamsha check still pending. No 100% accuracy claimed. |
| Misleading predictions | Open | Use disclosures, evidence citations, and no probability claims. |
| User-data isolation | Open | Apply and test Row Level Security before persistence launches. |
