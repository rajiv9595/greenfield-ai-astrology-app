# Risks

| Risk | Status | Mitigation |
|---|---|---|
| Ephemeris licensing | Open | Intended application license is AGPL-3.0-only; upstream revision aacf962 verified and adapter implemented. Do not deploy a public service until Corresponding Source and network-source availability are implemented. |
| Calculation correctness | Open | Pinned adapter anchored to astro.com (<=0.0002"), JPL Horizons DE441 (<=0.2"), and first-principles Lahiri checks (MEAN/TRUE <=0.3", nutation transcription <=0.0002", 5 literature anchors <=0.6"). D1 engine adds frozen Step 1 geometry (tropical <=1", sidereal <=2" vs pinned binary at 3 generic instants) with input time/coordinate uncertainty kept separate. No 100% accuracy claimed. |
| Misleading predictions | Open | Use disclosures, evidence citations, and no probability claims. |
| User-data isolation | Open | Apply and test Row Level Security before persistence launches. |
