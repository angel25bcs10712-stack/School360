# School360 Voice — Pitch deck content

## 1. Project and tagline

**School360 Voice**  
**Speak. Discover. Report. Improve.**  
A Hindi-first voice interface for school information and civic issue reporting.
Hackathon: Wispr Flow × Scaler Hackathon 2026. Pilot concept: Kanpur district,
Uttar Pradesh.

## 2. Problem

Citizens may face language, literacy, and navigation barriers when trying to learn
about school facilities or report a problem. The prototype focuses on this access
barrier; claims about prevalence or impact require field research and credible
district-level sources.

## 3. Solution

A conversational Hindi-first interface for discovering schools, asking about
recorded infrastructure, submitting a report, and checking status. Browser speech
is optional where unavailable; a text fallback keeps the workflow usable.

## 4. Target users and potential scale

Primary users: parents, caregivers, community members, and school staff. Initial
pilot concept: Kanpur. Expansion to additional districts is possible after obtaining
authoritative school data and local administrative partners. Do not state a market
size without sourcing UDISE+ school counts and validating the relevant user groups.

## 5. Product workflow

Speak or type → deterministic intent recognition → school selection → read only
recorded facility data → confirm report → persist to PostgreSQL → track report ID →
authorized admin updates status. A report is not claimed submitted until the API
confirms the database write.

## 6. Technical architecture

Browser UI and Web Speech APIs → Node.js API → PostgreSQL/PostGIS. The schema
tracks schools, facility observations, reports, and append-only status history.
Docker Compose starts the app and database. Optional location fields remain empty
unless authoritative coordinates are supplied.

## 7. Voice and AI dependencies

Hindi/English intent handling is deterministic and local; no LLM or speech provider
API key is required. Speech recognition and speech output are browser features and
depend on browser/OS support, microphone permission, and installed Hindi voices.
Typing is the fallback.

## 8. Cost management and fallback strategy

The prototype has no paid AI inference or third-party speech API dependency. It
uses the local browser for speech and a lightweight Node/PostgreSQL deployment.
Production hosting, backups, operations, data verification, and support costs need
quotes and load testing; no cost estimate is asserted here.

## 9. Launch plan

1. Partner with district education officials and parent/community representatives.
2. Import and validate an authoritative school directory.
3. Define roles, authentication, report triage, verification, and response SLAs.
4. Pilot with consent and privacy review; measure task completion and accessibility.
5. Publish supported languages, data provenance, escalation channels, and service
   availability before scaling.

## 10. Expected social impact and roadmap

Expected benefit to validate: lower interaction barriers and more traceable
infrastructure reporting. Measure completion rate, time to submit, verified-data
coverage, acknowledgement time, and resolution outcomes. Roadmap: real school data,
secure role-based administration, verification evidence, multilingual support,
notifications, and a map only where verified coordinates are available.

### Sources needed before making scale claims

- UDISE+ official school directory / published school counts and access date.
- Kanpur district education department records and documented data permissions.
- User research with parents, schools, and community organizations.
- District response/repair records for baseline and outcome measurement.

No external statistics are claimed in this deck.
