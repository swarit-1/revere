// Election fixture data for the demo. Three races with multi-level
// coverage:
//
//   1. Austin City Council, District 3 (municipal, matches Maya + Jason)
//   2. AISD Trustee, District 2 (school, matches Maya's Zavala kid)
//   3. Texas House, HD 51 (state, both personas live in HD 51)
//
// **Important honesty note:** these candidate names + promises are
// PLAUSIBLE FIXTURE DATA created for the hackathon demo, not actual
// statements by real candidates. Source URLs point to plausible
// campaign-page paths but do not resolve. The schema and reasoning
// pipeline are designed to swap in live-scraped data; the demo uses
// the fixture so the rendered UI is reliable.
//
// Authority classifications and specificity are pre-computed against
// the elections SKILL.md taxonomy. The runtime classifier (in
// classify.ts) can re-classify any promise; the demo skips that to
// keep the seed deterministic.

import type {
  ElectionCandidate,
  ElectionPromise,
  ElectionRace,
} from "@revere/shared";
import { jurisdictionId } from "@revere/shared";

export const FIXTURE_RACES: ElectionRace[] = [
  {
    id: "austin-d3-2026",
    jurisdiction_id: jurisdictionId("austin-city-council"),
    level: "municipal",
    office_title: "City Council Member, District 3",
    body: "Austin City Council",
    district_label: "D3",
    district_match: { field: "council_district", value: 3 },
    election_date: "2026-11-03",
    registration_deadline: "2026-10-05",
    early_voting_window: { start: "2026-10-19", end: "2026-10-30" },
    source_url: "https://austintexas.gov/department/city-clerk/elections",
    notes:
      "Fixture for hackathon demo. Plausible candidate framings; not actual quotes.",
  },
  {
    id: "aisd-trustee-d2-2026",
    jurisdiction_id: jurisdictionId("aisd"),
    level: "school",
    office_title: "AISD Board of Trustees, District 2",
    body: "Austin Independent School District Board",
    district_label: "Trustee D2",
    district_match: { field: "isd_trustee_district", value: 2 },
    election_date: "2026-11-03",
    registration_deadline: "2026-10-05",
    early_voting_window: { start: "2026-10-19", end: "2026-10-30" },
    source_url: "https://www.austinisd.org/board",
    notes:
      "Fixture for hackathon demo. Trustee D2 covers Zavala Elementary and surrounding feeders.",
  },
  {
    id: "txhd-51-2026",
    jurisdiction_id: jurisdictionId("texas-lege"),
    level: "state",
    office_title: "Texas House of Representatives, District 51",
    body: "Texas House",
    district_label: "Texas House 51",
    district_match: { field: "state_house_district", value: 51 },
    election_date: "2026-11-03",
    registration_deadline: "2026-10-05",
    early_voting_window: { start: "2026-10-19", end: "2026-10-30" },
    source_url: "https://capitol.texas.gov",
    notes:
      "Fixture for hackathon demo. HD 51 covers the East Austin area both personas live in.",
  },
];

export const FIXTURE_CANDIDATES: ElectionCandidate[] = [
  // Austin D3
  {
    id: "alex-rivera-austin-d3-2026",
    race_id: "austin-d3-2026",
    display_name: "Alex Rivera",
    campaign_url: "https://example.test/alex-rivera-d3",
    status: "filed",
    notes: "fixture: housing + tenant-protection focus",
  },
  {
    id: "morgan-tran-austin-d3-2026",
    race_id: "austin-d3-2026",
    display_name: "Morgan Tran",
    campaign_url: "https://example.test/morgan-tran-d3",
    status: "filed",
    notes: "fixture: small-business + commercial-corridor focus",
  },
  // AISD Trustee D2
  {
    id: "diane-okafor-aisd-d2-2026",
    race_id: "aisd-trustee-d2-2026",
    display_name: "Diane Okafor",
    campaign_url: "https://example.test/diane-okafor-trustee",
    status: "filed",
    notes: "fixture: classroom funding + teacher retention focus",
  },
  {
    id: "raj-patel-aisd-d2-2026",
    race_id: "aisd-trustee-d2-2026",
    display_name: "Raj Patel",
    campaign_url: "https://example.test/raj-patel-trustee",
    status: "filed",
    notes: "fixture: parent-choice + accountability focus",
  },
  // Texas HD 51
  {
    id: "isabel-kim-txhd-51-2026",
    race_id: "txhd-51-2026",
    display_name: "Isabel Kim",
    campaign_url: "https://example.test/isabel-kim-hd51",
    status: "filed",
    notes: "fixture: state housing finance + transit focus",
  },
  {
    id: "luis-mendez-txhd-51-2026",
    race_id: "txhd-51-2026",
    display_name: "Luis Mendez",
    campaign_url: "https://example.test/luis-mendez-hd51",
    status: "filed",
    notes: "fixture: small-business + property-tax focus",
  },
];

// Promises — 5 per candidate, mixed authority levels so the demo's
// "Can they actually do that?" badge has variety. Each promise has a
// fixture source-excerpt that is plausible but invented.
export const FIXTURE_PROMISES: ElectionPromise[] = [
  // Alex Rivera (Austin D3) — housing + tenant focus
  {
    id: "alex-rivera-mu-overlay-cesar-chavez",
    candidate_id: "alex-rivera-austin-d3-2026",
    topic: "housing_cost",
    text:
      "Pass a mixed-use overlay along East Cesar Chavez to require ground-floor commercial with housing above on parcels rezoned to CS-1.",
    source: {
      type: "campaign_site",
      url: "https://example.test/alex-rivera-d3/issues/housing",
      excerpt:
        "I will introduce a District 3 mixed-use overlay so any new CS-1 zoning on East Cesar Chavez has to include housing above the ground floor.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Council members can author ordinance amendments creating conditional overlays in their districts; CO authority is in City Code §25-2-284.",
    specificity: "specific",
    topics: ["housing", "land-use"],
  },
  {
    id: "alex-rivera-tenant-displacement-fund",
    candidate_id: "alex-rivera-austin-d3-2026",
    topic: "housing_cost",
    text:
      "Reauthorize and grow the Tenant Stabilization Fund so District 3 households facing displacement get up to 6 months of rental assistance.",
    source: {
      type: "campaign_site",
      url: "https://example.test/alex-rivera-d3/issues/tenants",
      excerpt:
        "I'll reauthorize the Tenant Stabilization Fund and double its allocation so D3 families don't lose their homes to a sudden rent spike.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Council can re-appropriate the fund and set guidelines, but actual disbursement runs through Austin Housing Finance Corp; outcomes depend on staffing.",
    specificity: "specific",
    topics: ["housing"],
  },
  {
    id: "alex-rivera-stop-rezoning",
    candidate_id: "alex-rivera-austin-d3-2026",
    topic: "housing_cost",
    text:
      "Vote no on any CS-1 rezoning where the abutting parcel is single-family residential without a tailored conditional overlay.",
    source: {
      type: "campaign_site",
      url: "https://example.test/alex-rivera-d3/issues/zoning",
      excerpt:
        "If a rezone case puts a CS-1 use against a residential back fence with no buffer CO, my vote is no. Period.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Council members vote directly on zoning cases under §25-2; one vote is binding on the case before them.",
    specificity: "specific",
    topics: ["land-use"],
  },
  {
    id: "alex-rivera-bus-frequency",
    candidate_id: "alex-rivera-austin-d3-2026",
    topic: "transit_reliability",
    text:
      "Push CapMetro to bring 15-minute headways back to MetroRapid 4 along East 7th and Cesar Chavez during peak hours.",
    source: {
      type: "questionnaire",
      url: "https://example.test/alex-rivera-d3/issues/transit",
      excerpt:
        "Council appoints CapMetro board seats and writes the joint operating commitments. I will use both to restore peak frequencies on the Eastside.",
    },
    authority: "indirect_influence",
    authority_rationale:
      "CapMetro is a separate authority; council appoints some board seats but does not vote on schedules. Influence is real but not direct.",
    specificity: "specific",
    topics: ["transportation"],
  },
  {
    id: "alex-rivera-fight-for-families",
    candidate_id: "alex-rivera-austin-d3-2026",
    topic: "housing_cost",
    text: "Fight every day for working families.",
    source: {
      type: "social_post",
      url: "https://example.test/alex-rivera-d3/posts/launch",
      excerpt:
        "I'm running because Austin's working families deserve a council member who shows up and fights for them.",
    },
    authority: "too_vague_to_assess",
    authority_rationale:
      "No mechanism described — no statute, ordinance, vote, or appointment named. Captured for completeness; flagged as vague.",
    specificity: "vague",
    topics: ["housing"],
  },

  // Morgan Tran (Austin D3) — small business + commercial corridor focus
  {
    id: "morgan-tran-permit-stop",
    candidate_id: "morgan-tran-austin-d3-2026",
    topic: "small_business_permitting",
    text:
      "Stand up a single Eastside small-business permit window so a new restaurant on East 6th gets every city sign-off in one room.",
    source: {
      type: "campaign_site",
      url: "https://example.test/morgan-tran-d3/issues/small-business",
      excerpt:
        "I will direct the City Manager to consolidate Health, ABC, signage, and CO permits at a single Eastside small-business window.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Council can pass a directive resolution and fund the staffing, but actual workflow consolidation is City Manager's office; outcomes depend on execution.",
    specificity: "specific",
    topics: ["commercial-regulation"],
  },
  {
    id: "morgan-tran-tabc-buffer",
    candidate_id: "morgan-tran-austin-d3-2026",
    topic: "tabc_rules",
    text:
      "Loosen the 300-foot school buffer on TABC late-hour licenses for restaurants that already serve food past 10pm.",
    source: {
      type: "interview",
      url: "https://example.test/morgan-tran-d3/interviews/austin-monthly",
      excerpt:
        "The TABC buffer rule is a state thing, but Austin's enforcement is a local choice — and we should soften it for restaurants that pass food checks.",
    },
    authority: "outside_office_scope",
    authority_rationale:
      "TABC licensing is state law (Texas Alcoholic Beverage Code Ch. 11); city council does not write or modify TABC rules. Local enforcement is also TABC's.",
    specificity: "general",
    topics: ["commercial-regulation"],
  },
  {
    id: "morgan-tran-side-walk-cafes",
    candidate_id: "morgan-tran-austin-d3-2026",
    topic: "small_business_permitting",
    text:
      "Make the temporary sidewalk-cafe permit permanent on East 6th and East Cesar Chavez at zero fee for businesses under 10 employees.",
    source: {
      type: "campaign_site",
      url: "https://example.test/morgan-tran-d3/issues/cafe",
      excerpt:
        "Sidewalk dining is a quality-of-life and a small-business issue. I will push to make the temporary cafe permit permanent and fee-free for our smallest businesses.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Sidewalk-cafe permits are governed by City Code §14-9 and are unilaterally amendable by council ordinance.",
    specificity: "specific",
    topics: ["commercial-regulation"],
  },
  {
    id: "morgan-tran-property-tax",
    candidate_id: "morgan-tran-austin-d3-2026",
    topic: "property_taxes",
    text:
      "Cut Austin's portion of the property tax rate by 5 cents over the next two budgets.",
    source: {
      type: "press_release",
      url: "https://example.test/morgan-tran-d3/press/2026-budget",
      excerpt:
        "Property taxes are squeezing District 3 small businesses. I will fight for a 5-cent reduction in Austin's portion of the rate over two budgets.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Council sets the city's portion of the property tax rate annually. Cutting it requires majority + adopting a balanced budget at the lower revenue.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "morgan-tran-downtown-safety",
    candidate_id: "morgan-tran-austin-d3-2026",
    topic: "downtown_safety",
    text:
      "Restore APD's downtown patrol staffing to 2019 levels and fund expanded ambassador-program coverage on East 6th.",
    source: {
      type: "questionnaire",
      url: "https://example.test/morgan-tran-d3/q/downtown",
      excerpt:
        "I will vote in budget season for APD downtown patrol to return to 2019 staffing and a doubled DAA Ambassador footprint on East 6th.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Council adopts the APD budget annually under §2-3; staffing levels are a budget line. Ambassador program funding flows through DAA contract council approves.",
    specificity: "specific",
    topics: ["public-safety"],
  },

  // Diane Okafor (AISD Trustee D2) — classroom funding + teacher retention
  {
    id: "diane-okafor-zavala-funding",
    candidate_id: "diane-okafor-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Restore the per-pupil funding floor at Zavala Elementary even when enrollment dips, by adopting a hold-harmless on Title I campuses.",
    source: {
      type: "campaign_site",
      url: "https://example.test/diane-okafor/issues/funding",
      excerpt:
        "I'll adopt a board policy holding Title I campuses harmless on per-pupil funding. Zavala shouldn't lose teachers because enrollment dipped during a renovation.",
    },
    authority: "direct_authority",
    authority_rationale:
      "AISD board sets allocation policy at adoption and amendments. Hold-harmless is a board-policy decision under TEC §11.158.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "diane-okafor-teacher-pay",
    candidate_id: "diane-okafor-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Vote yes on a 5% teacher pay scale lift in the next compensation cycle, prioritized for high-need campuses.",
    source: {
      type: "questionnaire",
      url: "https://example.test/diane-okafor/q/compensation",
      excerpt:
        "I will vote for a 5% teacher pay scale increase and prioritize the lift on Title I and DELL campuses where retention is hardest.",
    },
    authority: "direct_authority",
    authority_rationale:
      "AISD board ratifies the compensation plan annually; a board majority can move the scale. Funding source is the local + state allocation.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "diane-okafor-childcare",
    candidate_id: "diane-okafor-aisd-d2-2026",
    topic: "childcare_access",
    text:
      "Pilot extended-hours after-school programming at three District 2 elementaries, including Zavala, by fall 2027.",
    source: {
      type: "campaign_site",
      url: "https://example.test/diane-okafor/issues/childcare",
      excerpt:
        "Working parents need real after-school options. I'll pilot 5pm-to-6:30pm programming at Zavala, Sanchez, and Ortega by fall 2027.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Board approves campus-level programming pilots and budget; staffing depends on Education Service Center, partners, and grant timing.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "diane-okafor-property-tax",
    candidate_id: "diane-okafor-aisd-d2-2026",
    topic: "property_taxes",
    text:
      "Lower the AISD M&O tax rate by 1 cent in the next budget and offset with state recapture relief.",
    source: {
      type: "press_release",
      url: "https://example.test/diane-okafor/press/budget",
      excerpt:
        "I'll push the board to lower our M&O rate by a penny, with the offset coming from negotiated recapture relief at the Capitol.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Board sets the M&O rate annually under TEC §45.003. State recapture relief depends on the Legislature; local lift partial without state action.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "diane-okafor-vouchers",
    candidate_id: "diane-okafor-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Resist any state push for school vouchers and protect AISD funding.",
    source: {
      type: "social_post",
      url: "https://example.test/diane-okafor/posts/vouchers",
      excerpt:
        "Public dollars should fund public schools. I'll resist any voucher push and defend our students' allocation.",
    },
    authority: "outside_office_scope",
    authority_rationale:
      "Voucher policy is set by the Legislature; AISD board can lobby + organize but cannot block state law from outside its scope.",
    specificity: "general",
    topics: ["budget"],
  },

  // Raj Patel (AISD Trustee D2) — parent-choice + accountability
  {
    id: "raj-patel-reading",
    candidate_id: "raj-patel-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Adopt a structured-literacy reading curriculum across all District 2 elementaries by the 2027 school year.",
    source: {
      type: "campaign_site",
      url: "https://example.test/raj-patel/issues/reading",
      excerpt:
        "Every D2 elementary will be on a structured-literacy curriculum aligned to the science of reading by August 2027. I'll vote yes on the contract.",
    },
    authority: "direct_authority",
    authority_rationale:
      "AISD board approves district-wide curriculum adoptions and the associated vendor contracts under TEC §11.151.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "raj-patel-school-choice",
    candidate_id: "raj-patel-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Expand AISD's transfer policy so any D2 family can transfer to a higher-performing AISD campus without lottery.",
    source: {
      type: "interview",
      url: "https://example.test/raj-patel/interviews/austin-monthly",
      excerpt:
        "Parents in District 2 should have the same options other parents have. I'll vote to scrap the lottery for in-district transfers.",
    },
    authority: "partial_authority",
    authority_rationale:
      "Board sets transfer policy under TEC §25.034. Capacity and busing constraints are operational; full no-lottery may be limited by physical capacity.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "raj-patel-transparency",
    candidate_id: "raj-patel-aisd-d2-2026",
    topic: "school_quality",
    text:
      "Publish a per-school monthly outcomes dashboard covering attendance, behavior, and reading levels.",
    source: {
      type: "questionnaire",
      url: "https://example.test/raj-patel/q/transparency",
      excerpt:
        "Parents deserve a monthly per-school dashboard. I will direct the superintendent to publish it within 90 days of taking office.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Board can direct administrative reporting under §11.151. Implementation is operational but a board majority binds the superintendent.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "raj-patel-tabc-buffer",
    candidate_id: "raj-patel-aisd-d2-2026",
    topic: "tabc_rules",
    text:
      "Tighten enforcement of the 300-foot TABC buffer near AISD campuses.",
    source: {
      type: "campaign_site",
      url: "https://example.test/raj-patel/issues/safety",
      excerpt:
        "I'll work with the city to tighten 300-foot TABC buffer enforcement around our schools.",
    },
    authority: "outside_office_scope",
    authority_rationale:
      "TABC enforcement is state-agency; AISD board can request coordination but has no charter authority over alcohol licensing.",
    specificity: "general",
    topics: ["public-safety"],
  },
  {
    id: "raj-patel-listen",
    candidate_id: "raj-patel-aisd-d2-2026",
    topic: "school_quality",
    text: "Listen to parents and teachers.",
    source: {
      type: "social_post",
      url: "https://example.test/raj-patel/posts/launch",
      excerpt:
        "I'll listen to parents and teachers and bring their voice to the board.",
    },
    authority: "too_vague_to_assess",
    authority_rationale:
      "No mechanism described. Captured because it's on the campaign site; flagged as vague.",
    specificity: "vague",
    topics: ["budget"],
  },

  // Isabel Kim (TX HD 51) — state housing finance + transit
  {
    id: "isabel-kim-hfc",
    candidate_id: "isabel-kim-txhd-51-2026",
    topic: "housing_cost",
    text:
      "Vote yes on increasing the Texas State Affordable Housing Corporation's bond authority by $1B for income-restricted units.",
    source: {
      type: "campaign_site",
      url: "https://example.test/isabel-kim/issues/housing",
      excerpt:
        "I will be a yes on a $1B TSAHC bond authority increase for income-restricted units in HD 51 and similar high-cost districts.",
    },
    authority: "direct_authority",
    authority_rationale:
      "TSAHC bond authority is set by Texas Government Code §2306; House members vote directly on increases.",
    specificity: "specific",
    topics: ["housing"],
  },
  {
    id: "isabel-kim-i35-cap",
    candidate_id: "isabel-kim-txhd-51-2026",
    topic: "transit_reliability",
    text:
      "Co-sponsor an appropriation for TxDOT's I-35 cap-and-stitch deck park between Cesar Chavez and 7th Street.",
    source: {
      type: "press_release",
      url: "https://example.test/isabel-kim/press/i35",
      excerpt:
        "The I-35 deck park is the difference between a highway that splits East Austin and one that knits it back. I'll co-sponsor the appropriation.",
    },
    authority: "partial_authority",
    authority_rationale:
      "House appropriations vote is direct, but final dollars depend on Senate concurrence + comptroller revenue estimate + TxDOT engineering.",
    specificity: "specific",
    topics: ["transportation"],
  },
  {
    id: "isabel-kim-tenant",
    candidate_id: "isabel-kim-txhd-51-2026",
    topic: "housing_cost",
    text:
      "File legislation to repeal the state preemption that blocks Texas cities from passing local rent stabilization.",
    source: {
      type: "questionnaire",
      url: "https://example.test/isabel-kim/q/preemption",
      excerpt:
        "Cities like Austin should be able to write their own tenant protections. I will file a bill repealing the state preemption.",
    },
    authority: "direct_authority",
    authority_rationale:
      "House members file bills directly. Passage requires majorities + Senate + governor; filing itself is the office's authority.",
    specificity: "specific",
    topics: ["housing"],
  },
  {
    id: "isabel-kim-vouchers",
    candidate_id: "isabel-kim-txhd-51-2026",
    topic: "school_quality",
    text:
      "Vote no on any bill creating a school voucher program funded from the Foundation School Program.",
    source: {
      type: "campaign_site",
      url: "https://example.test/isabel-kim/issues/schools",
      excerpt:
        "Public dollars belong in public schools. I will be a no on every voucher bill that draws from the FSP.",
    },
    authority: "direct_authority",
    authority_rationale:
      "House members vote directly on Foundation School Program structure (TEC §42).",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "isabel-kim-fight",
    candidate_id: "isabel-kim-txhd-51-2026",
    topic: "housing_cost",
    text: "Fight gentrification in HD 51.",
    source: {
      type: "social_post",
      url: "https://example.test/isabel-kim/posts/launch",
      excerpt: "I'm in this race to fight gentrification in HD 51.",
    },
    authority: "too_vague_to_assess",
    authority_rationale:
      "No mechanism, bill, or appropriation named. Captured because it's a stated commitment; flagged as vague.",
    specificity: "vague",
    topics: ["housing"],
  },

  // Luis Mendez (TX HD 51) — small business + property tax
  {
    id: "luis-mendez-homestead",
    candidate_id: "luis-mendez-txhd-51-2026",
    topic: "property_taxes",
    text:
      "Vote yes on raising the Texas homestead exemption from $100K to $150K for owner-occupied properties.",
    source: {
      type: "press_release",
      url: "https://example.test/luis-mendez/press/homestead",
      excerpt:
        "Texas homeowners need real relief. I'll vote yes on a $150K homestead exemption — a $50K bump that lands at the kitchen table.",
    },
    authority: "direct_authority",
    authority_rationale:
      "Texas Constitution Art. VIII §1-b sets the exemption; House members vote directly on the constitutional amendment + enabling statute.",
    specificity: "specific",
    topics: ["budget"],
  },
  {
    id: "luis-mendez-tabc",
    candidate_id: "luis-mendez-txhd-51-2026",
    topic: "tabc_rules",
    text:
      "File a bill modernizing TABC's late-hour permit so a restaurant on East 6th doesn't lose its food sales after 10pm.",
    source: {
      type: "campaign_site",
      url: "https://example.test/luis-mendez/issues/small-business",
      excerpt:
        "TABC's late-hour rules were written for a different city. I'll file a bill that lets East 6th restaurants keep serving food past 10 without losing the permit.",
    },
    authority: "direct_authority",
    authority_rationale:
      "House members file TABC code amendments directly (Texas ABC Code, ch. 105). Passage requires Senate + governor; filing is sole office authority.",
    specificity: "specific",
    topics: ["commercial-regulation"],
  },
  {
    id: "luis-mendez-permits",
    candidate_id: "luis-mendez-txhd-51-2026",
    topic: "small_business_permitting",
    text:
      "Pass a state law forcing cities to issue or deny a small-business permit within 21 days or it auto-approves.",
    source: {
      type: "questionnaire",
      url: "https://example.test/luis-mendez/q/permits",
      excerpt:
        "Austin's permit office is killing East 6th. I'll pass a state shot-clock — 21 days to decide or it auto-approves.",
    },
    authority: "partial_authority",
    authority_rationale:
      "House can pass preemption bills; passage requires Senate + governor. State preemption of local zoning is contested; legal challenge likely.",
    specificity: "specific",
    topics: ["commercial-regulation"],
  },
  {
    id: "luis-mendez-rezone",
    candidate_id: "luis-mendez-txhd-51-2026",
    topic: "land-use",
    text:
      "Stop Austin from imposing CO restrictions on small commercial properties.",
    source: {
      type: "interview",
      url: "https://example.test/luis-mendez/interviews/chronicle",
      excerpt:
        "Austin's CO process strangles small business. I'll fight to stop the city from layering CO restrictions on small commercial parcels.",
    },
    authority: "outside_office_scope",
    authority_rationale:
      "City CO process is local zoning under §25-2; state preemption of zoning is contested + slow-moving. Direct state intervention is rare.",
    specificity: "general",
    topics: ["land-use"],
  },
  {
    id: "luis-mendez-fight",
    candidate_id: "luis-mendez-txhd-51-2026",
    topic: "small_business_permitting",
    text: "Stand up for HD 51 small business.",
    source: {
      type: "social_post",
      url: "https://example.test/luis-mendez/posts/launch",
      excerpt:
        "I'm in this race to stand up for HD 51 small business.",
    },
    authority: "too_vague_to_assess",
    authority_rationale:
      "No mechanism, bill, or appropriation named. Captured because it's a stated commitment; flagged as vague.",
    specificity: "vague",
    topics: ["commercial-regulation"],
  },
];
