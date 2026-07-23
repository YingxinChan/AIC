# SmartTrip AI — Project Context

## What this project is
An app that plans travel itineraries according to weather forecasts, then suggests changes (indoor/outdoor activity swaps) if weather changes — with flight recommendations included. MVP scope is **25 European cities** (expanded from the original London-only MVP — see decision note below). Built for a specific competition/grant submission, not a commercial launch (yet).

## Team
4 people total (including the project owner). Roles/skills not yet assigned — to be discussed by the team. Plan is structured so 4 people can work in **parallel tracks** (ML, Backend, Frontend, Proposal), not sequential phases.

## Key dates
- **Now:** 22 June 2026
- **w/c 31 Aug:** finalize proposal + prototype (this is the real deadline for the actual build)
- **w/c 7 Sept:** create video, poster, slides
- **11 Sept:** poster submission
- **16 Sept:** video presentation submission

## Scope (decision updated 23 July 2026)
- MVP expanded from **London only** to **25 European cities**.
- The 25 cities (confirmed via `backend/services/mock_flights.csv`, already seeded by a teammate): Amsterdam, Athens, Barcelona, Berlin, Bruges, Brussels, Budapest, Copenhagen, Dublin, Edinburgh, Florence, Istanbul, Krakow, Lisbon, London, Madrid, Milan, Munich, Oslo, Paris, Prague, Rome, Venice, Vienna, Zurich.
- Impact not yet fully worked through — flagged here so it isn't missed: ML training data (OpenWeatherMap + NASA POWER pulls) needs to cover 25 locations instead of 1, activity/POI seeding data needs per-city coverage, and this may affect the Aug/Sept deadlines. Confirm with the team whether this changes timeline or is being absorbed within it.
- Update this file further as multi-city implementation details (how city selection works in the UI, data seeding approach) get decided.

## Tech stack (FINAL — confirmed in planning conversation)
- **Frontend:** React (regular web app — NOT React Native, NOT mobile. This was changed from the original proposal because mobile app setup was judged too troublesome for the timeline.)
- **Backend:** Python FastAPI + Celery + Redis
- **Database:** PostgreSQL + PostGIS (for geospatial activity radius queries)
- **Notifications:** Email via Gmail SMTP using an App Password (free, no payment required). This replaced the original Firebase push notification plan, since there's no mobile app to push to anymore.
- **Map:** OpenStreetMap / Leaflet.js — lowest priority, explicitly the first thing to cut if time runs short. Original proposal said "maybe in proposal" — treat as optional/stretch goal.

## ML pipeline (scope confirmed, NOT yet built/validated)
- **Data sources:** OpenWeatherMap API (free tier: current weather + 5-day forecast, 60 calls/min, 1,000,000 calls/month, no card needed) + NASA POWER historical archives (free).
- **Feature engineering:** 1-day, 3-day, 7-day lag features. Same-day rain indicators must be DROPPED to prevent data leakage.
- **Split:** 80:20 train-test.
- **Stage 1:** CatBoost Regressor for rain volume prediction. Literature target R² = 0.837 — this is a target from research, NOT a proven/achieved result yet. Report actual achieved numbers honestly in the proposal, do not assume the target is hit.
- **Stage 2:** LightGBM Classifier for flash storm detection. Literature target F1 = 0.752 — same caveat, not yet validated.

## Flights (decision updated 23 June 2026)
- Skyscanner's official API is CLOSED to non-partners — confirmed not viable, application takes weeks.
- Amadeus Self-Service API was the original plan, but their free self-service portal is being **decommissioned on 17 July 2026** — before our prototype deadline. Confirmed unavailable.
- **Decision: use mock flight data only for the prototype.** Flights are not the core feature (the weather-adaptive itinerary is), and a well-crafted mock is more reliable for a live demo than a live API.
- The mock should look realistic: return a few plausible London flight options with airline, price, times, and duration — enough to demonstrate the concept clearly in the demo.
- Real flight API integration (e.g. Skyscanner affiliate, or whatever replaces Amadeus) is explicitly future work / post-MVP. Mention in the proposal's roadmap section.

## Working style / philosophy agreed in planning
- **Parallel tracks, not sequential phases.** ML, Backend, Frontend, and Proposal writing all start in Week 1, not waiting on each other. The only required sync point early on is agreeing on the **API contract** (what endpoints exist, what data they take/return) — once that's written down, frontend and backend can each build independently against it.
- **Skeleton-first approach:** the project owner wants to build the full skeleton (folder structure, all screens, all API routes, basic clean/neutral styling) THEMSELVES first, with all real features stubbed out using safe placeholders (e.g. "Flight results will appear here" rather than fake data or crashes). Teammates then fill in the real logic into an already-structured project, rather than starting from a blank repo. This was a deliberate choice to reduce setup friction for teammates with mixed skill levels.
- **Styling:** keep it minimal/neutral/clean for the skeleton. Visual design and branding (colors, fonts, full look) is intentionally left for the team to decide together later — don't over-design the skeleton.
- **Placeholder content standard:** unbuilt features should clearly label what's supposed to go there (plain, honest placeholder text), not fake-but-realistic data and not broken/crashing behavior.

## Things explicitly cut or de-scoped for MVP (mention as "future work" in proposal, don't apologize for them)
- Mobile app (React Native) — replaced with web app entirely.
- Firebase push notifications — replaced with email notifications.
- Real flight API integration — Skyscanner is closed to non-partners, Amadeus self-service is shutting down July 2026. Using mock flight data for the prototype instead.
- Map view — lowest priority, may be cut if time is short.
- Global expansion beyond Europe — the 25-city scope is Europe-only; further expansion is future work.

## Research already completed (use as-is in proposal, don't redo)
- 100-person survey: 81% Gen Z/Millennial respondents, 83% had a holiday ruined by bad weather, 88% change destinations based on forecasts, 85% want dynamic indoor/outdoor swapping, 73% willing to pay directly (reject free model), 49% prefer pay-as-you-go per-trip pricing.
- Competitor gap: booking platforms (Booking.com, Trip.com) are static pre-trip only; weather apps (AccuWeather) give raw data with zero travel decisions. SmartTrip AI's positioning is "context-aware middleware" connecting the two.
- Financials: prototype CapEx estimate £40,000–£60,000; lean OpEx £100–£900/month for 1,000–10,000 active users (note: actual prototype build should cost £0 since everything is on free tiers).

## Notes for Claude Code
- This file should be kept up to date as decisions change during the build.
- When in doubt about scope, check this file before assuming the original research-summary proposal is still 100% accurate — several things have already been deliberately changed from it (see "things explicitly cut" above).
