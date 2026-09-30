# Evaluation playbook — October 1, 2026, 10:00 IST

## The product sentence

“CivicClean turns citizen waste evidence into a reviewed handling task: ordinary waste goes to a compatible collection route, while electronics and household disposal go through a separately recorded receiving-service handoff.”

## What changed after feedback

| Judge concern | Implemented response | What to show |
|---|---|---|
| “Another complaint app” | Separate material handling, duplicate consolidation, compatible capacity planning and evidence-backed completion in one loop | Same nearby incident becomes one task; public electronics stay outside the ordinary route |
| “How do you handle electronic waste?” | E-waste/specialist queue; receiving service, reference, source and photo required before closure | Verified electronic request → handoff form; no generic truck auto-assignment |
| “I have 4–5 old phones at home” | Household mode with item description/quantity, private location and guidance | Select At my home; enter phones and quantity; show absence from the public map |
| “Users can manipulate priority” | One contribution per account per event; uploaded evidence tied to its owner; replay protection; supporting priority added only after operator review and capped | Add supporting evidence; show priority unchanged until operator accepts it |
| “Where is the real location/data?” | GPS accuracy or explicit map pin; validated pilot boundary; persistent records; actual road-service response | Pin/GPS coordinates, saved report ID, refresh, recorded route source |
| “Where are real results?” | Actual closure evidence and receiving-service reference; a citizen can reopen and revoke completion credits | Open completed request, show proof; reopen if unresolved |
| “Your predictions are invented” | Seeded history excluded; forecasts wait for four complete weeks of real history | Show the honest insufficient-history state |

## Government comparison — be precise

**Swachhata-MoHUA already provides geo-tagged photo complaints, location selection, upvotes, status updates, resolution photographs and reopening.** Do not claim any of these alone as CivicClean's invention.

Its official developer listing describes complaints being forwarded to the concerned city's officials and assigned to the relevant ward inspector/engineer. We are not connected to that dispatch network.

| Existing public resource | Documented role | CivicClean relationship |
|---|---|---|
| Swachhata-MoHUA | Citizen sanitation complaints and closure feedback | Acknowledge overlap; focus our prototype demonstration on material-specific operational handling |
| BMC waste-management information | Municipal waste-service and segregation information | Link citizens to official information; do not claim a BMC partnership |
| MPCB electronic-waste resources | Resource pages and recycler lists | Operator checks current receiving-service eligibility; a listed URL is not a CivicClean booking integration |
| CPCB e-waste portal | E-waste registration portal | Reference for checking the regulatory ecosystem; not a citizen pickup booking API |

The comparison supports **our chosen focus**, not a claim that no existing service has similar capabilities. Do not say “India's first,” “government apps cannot do this,” or “we have partnered with authorized recyclers” unless the team has evidence.

Official sources reviewed September 30, 2026:

- [Swachhata-MoHUA official app listing](https://play.google.com/store/apps/details?hl=en_GB&id=com.ichangemycity.swachhbharat)
- [Swachhata portal](https://www.swachh.city/)
- [BMC waste-management information](https://www.mcgm.gov.in/irj/portal/anonymous/qlcleanover?guest_user=english)
- [MPCB e-waste resources](https://www.mpcb.gov.in/en/node/4297)
- [CPCB e-waste registration portal](https://eprewaste.cpcb.gov.in/)

Verify current acceptance and registration directly before arranging a real handoff. We have not inserted unverified recycler addresses, phone numbers or opening hours.

## Keep the PPT synced with the running build

| PPT claim | Accurate wording / evidence |
|---|---|
| Classification | “Optional image-model suggestion + citizen correction + operator review.” If no provider is connected, say manual category selection is active |
| Different categories | “Wet, dry, residual and specialist handling paths.” Electronic devices never enter an ordinary route |
| Location | “Browser GPS or user-confirmed map pin.” GPS accuracy is displayed; it is not proof the person is on site |
| Prioritization | “Explainable rules; reviewed support capped at 20 points.” No predictive urgency claim |
| Route optimization | “Capacity-aware stop selection and priority-aware road sequencing under a driving budget.” Do not claim global optimality or live traffic |
| Routing evidence | Show returned distance/time and depot; these are estimates from the road service, excluding collection time |
| E-waste collection | “Operator-coordinated, recorded handoff.” Pickup is not booked automatically; eligibility is checked outside the software |
| Identity | “Password login and role checks; operator-reviewed contributions.” No verified-email, unique-person or Aadhaar claim |
| Credits | “Non-monetary contribution ledger.” No cash, points redemption or tamper-proof blockchain claim |
| Forecast | “Activates after enough real history.” Until then show insufficient history; no made-up accuracy percentage |
| Resolution | “Operator-recorded evidence, visible status history and citizen reopening.” A photo alone is not automated proof of disposal |
| Impact | Show only actual recorded counts. Do not claim measured fuel/CO₂/time savings without a baseline study |
| Government integration | “Independent pilot with links to official resources.” No municipal API integration claim |

## Five-minute evaluation flow

1. **0:00–0:30 — Problem and scope.** Give the product sentence. State the limited pilot area and actual operating arrangement.
2. **0:30–1:30 — Citizen simplicity.** Submit an actual photo; confirm category, GPS/map pin and review. Refresh the saved report.
3. **1:30–2:15 — Consolidation and trusted priority.** A second account adds different photographic evidence for the same public incident. Show one waste event. Pending support does not boost urgency until reviewed.
4. **2:15–3:00 — Ordinary collection.** Verify category/weight; select a real configured vehicle; show compatible stops, driving estimates and any capacity/time exclusions. Record assignment only when a crew arrangement exists.
5. **3:00–4:00 — Electronic/household difference.** Show “4 phones at home,” private location, specialist guidance, exclusion from ordinary routing, and the actual handoff record if one exists. Otherwise show the pending handoff honestly.
6. **4:00–4:40 — Accountability.** Show real completion evidence and timeline. Explain reopening and reversal of completion credits. Do not manufacture a receipt to demonstrate completion.
7. **4:40–5:00 — Government overlap and limits.** Acknowledge Swachhata's existing strengths. Explain our focus on category-aware operations and the integrations still required.

## Simple answers to difficult questions

**“Is it unique?”** “Photo complaints themselves are not new. Our focus in this build is the handling decision after a report: consolidated events, reviewed urgency, compatible capacity planning and a separate documented path for specialist and household waste.”

**“Can the same person create more accounts?”** “Yes, email/password alone does not establish a unique person. We limit one contribution per account per incident, bind photos to upload ownership and require operator acceptance before support affects priority. Stronger verified identity is future work.”

**“Who will collect?”** Name the actual arranged crew/service. If none exists: “The coordination software is implemented; a municipal or recycler agreement is still required for public collection.”

**“What happens when AI or routing fails?”** “AI falls back to manual classification. Failed photo upload blocks submission. Routing failure is shown and no invented road route is substituted.”

**“How do you prove correct disposal?”** “We record an operator-confirmed receiving service, receipt/reference and evidence, and allow citizen dispute. We do not currently independently verify recycler receipts or end-to-end processing.”

## Team actions tonight

- **Deployment owner:** configure the new persistent database, Cloudinary, HTTPS origins and first operator; run the readiness check.
- **Field/operations owner:** photograph real incidents/items and confirm any actual receiving service or collection arrangement. Record only outcomes that happened.
- **Testing owner:** run the acceptance checklist on a phone and laptop, including permissions denied, refresh and network failures.
- **Presentation owner:** update the claim table above in every slide and use screenshots from the deployed build.

Freeze feature work after one successful end-to-end rehearsal. Before the 10:00 evaluation, verify health, sign-in, image upload, maps and the current records on the actual network. Keep the last passing branch/deployment available for rollback.
