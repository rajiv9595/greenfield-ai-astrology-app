# Architecture

The initial product is a single Next.js and TypeScript web application. Server routes will own privileged integrations. Future calculation code will live in a separately testable package, with AI receiving only structured, validated evidence.

Database/auth, ephemeris, and OpenAI integrations are deliberately not configured in this phase.

## Calculation-core boundary

`packages/astrology-core` contains provider-neutral types, input validation, configuration, and exact angular-boundary utilities. It contains no planetary position algorithm or ephemeris data. A licensed ephemeris adapter will be introduced only after the provider licence gate in ADR-003 is met.
