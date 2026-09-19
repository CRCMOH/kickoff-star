# Kickoff Star — Youth World V5 Integration

This branch keeps the V3.2 match engine as the protected gameplay foundation and builds the full youth-career world around it.

## Implemented systems
- Persistent school and Sunday/grassroots world with player pools.
- Separate school and grassroots career calendars.
- Replacement development football after elimination.
- October Schools League / Development League and three-day youth festival calendar.
- Regional representative camp: 60 -> 35 -> 23 using actual positional competitors.
- National shortlist and final 23 built from regional players.
- Global fictional academy network with recognisable football geography.
- Three-week academy assessment at age 16 in the October window.
- 30% technical / 45% trial match / 15% discipline / 10% consistency assessment weighting.
- 3-6 academy scholarship offers after a passed assessment.
- Parent and paid agent choices plus interactive two-week negotiations.
- U17/U19 academy squads, league, cup and continental youth fixtures.
- Academy role competition, release risk and performance-based professional pathway.
- School scholarships and grassroots contracts.
- Persistent competition player stats and award races.
- Dynamic Youth Gazette story primitives.
- Persistent club grounds/venue identities.
- Energy-driven selection probability, minutes caps and fatigue risk.
- Graduation game-over and career summary.
- Backward-compatible V5 youth save envelope/migration.
- Integrated audits plus multi-career school/grassroots simulations.

## Deliberately unresolved
The exact international qualifying/finals dates are not invented here. The design scope marks them for reconciliation with representative duty and the October academy assessment, so the national pathway is implemented while the final international calendar remains unlocked.

## Validation
The V4 Youth World workflow runs TypeScript checks, youth-world audits, representative and academy audits, remaining-system integration tests, multi-career simulations, and the production build.
