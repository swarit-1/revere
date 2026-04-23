# taxonomy/housing

Use when classifying items about residential land use, renter protections,
or housing supply.

## In scope

- Residential rezonings (SF-*, MF-*) and mixed-use changes with a
  residential component.
- Affordability policy: SMART Housing, density-bonus programs,
  inclusionary zoning where applicable.
- Renter protections: source-of-income rules, tenant relocation
  assistance, notice-period requirements, right to cure.
- Homelessness response with a housing component (permanent supportive
  housing, rapid re-housing, emergency shelter siting).
- Short-term-rental rules that constrain housing *supply* (licensing caps,
  density caps). STR *operating* rules belong in `commercial-regulation`.
- Displacement mitigation, right-to-return, community land trusts.

## Out of scope

- Commercial-only rezonings → `commercial-regulation`.
- Parkland, historic preservation, citywide setback code → `land-use`.
- Property tax rate setting or homestead exemption votes → `budget`.
- Sidewalk cafés, signage, TABC overlays on commercial sites →
  `commercial-regulation`.

## Signal words

`residential`, `rezoning`, `SF-1`, `SF-2`, `SF-3`, `SF-4`, `SF-5`, `SF-6`,
`MF-1`, `MF-2`, `MF-3`, `MF-4`, `MF-5`, `MF-6`, `density bonus`,
`SMART Housing`, `affordability`, `affordable unit`, `renter`, `tenant`,
`displacement`, `relocation`, `notice period`, `homeless`, `permanent
supportive housing`, `PSH`, `rapid re-housing`, `community land trust`,
`right to return`, `inclusionary`.

## Examples

- "Rezoning 2400 E 5th from SF-3 to MF-4" → `housing` (residential
  upzoning).
- "C14-2025-0080 — 1811 East Cesar Chavez CS-MU-CO-NP to CS-1-CO-NP" →
  `housing` primary (mixed-use change on a residential-adjacent
  corridor) and `commercial-regulation` secondary (CS-1 adds liquor
  sales). Load both.
- "Approve tenant relocation assistance ordinance" → `housing`.
- "Amend FY26 budget to fund PSH beds" → `housing` (the lever being
  pulled) + `budget` (aggregate vote shape).
