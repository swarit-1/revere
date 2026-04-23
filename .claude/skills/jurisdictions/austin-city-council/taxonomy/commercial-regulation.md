# taxonomy/commercial-regulation

Use when classifying items about how commercial businesses operate in
public space or under special city permits: alcohol, outdoor dining,
street vendors, signage, STR operators, commercial overlays.

## In scope

- TABC and liquor-license overlays: `CS-1` (adds liquor sales), `CO-A`
  alcohol conditional overlays.
- Sidewalk cafés, outdoor seating, parklets, street-café permits.
- Public Improvement Districts (PIDs): creation, expansion, assessment
  changes.
- Mobile food vendors, food-truck site regulations.
- Signage code: commercial signs, electronic message displays, billboards.
- Short-term rental *operating* rules: permit types, inspection, noise
  at STR properties. (STR supply caps go in `housing`.)
- Commercial-only rezonings (CS, GR, LR district changes with no
  residential component).
- Noise ordinances targeting business operation (Red River, Rainey).

## Out of scope

- Residential zoning or STR supply-cap rules → `housing`.
- Citywide LDC, setbacks, tree ordinance, parkland → `land-use`.
- Alcohol-related public-safety enforcement → `public-safety`.

## Signal words

`TABC`, `liquor`, `CS-1`, `CO-A`, `sidewalk café`, `PID`, `public
improvement district`, `outdoor seating`, `parklet`, `food truck`,
`mobile food vendor`, `signage code`, `electronic message display`,
`short-term rental operator`, `STR permit`, `noise ordinance`, `Red
River`, `Rainey`.

## Examples

- "Approve expansion of Downtown Austin Public Improvement District" →
  `commercial-regulation`.
- "C14-2025-0080 — 1811 East Cesar Chavez CS-MU-CO-NP to CS-1-CO-NP" →
  `commercial-regulation` (CS-1 overlay adds liquor sales) + `housing`
  (mixed-use change on a residential corridor). Load both.
- "Amend noise ordinance hours for Red River Cultural District" →
  `commercial-regulation`.
- "Create STR operator permit with annual inspection requirement" →
  `commercial-regulation`.
