
# Proposal

## MVP
- create synthetic data to augment provided spreadsheet info
- add proposed keys and synthetic values to codify a master schema for PoC
- conform our current map project to read from test schema
- research and implement adaptation of portal event google map for use in new project, with synthetic locations for testing
- develop Locations index tab schema
- deploy working private sample for testing by portal team for test event
- provide schema template that conforms to recommendations to adapt future projects to a working standard

### PLUS features
- adapt portal fork of project to use relevant department / role / category filters and search
- implement roll gated feature scope
- Auth for users / vendors
- Admin Dashboard for configuring roles
- Contacts Directory, personal view
- calendar .ics implementation and sync 

this aims to get us to a place where the delivered schema template can reproduce a functional app if followed with a new data set from a future event. 


initial scope would include two rounds of revisions after providing working test case, including minor RFEs after client feedback.
4


Ok team,

We've had a chance to revisit this, and have put together a proposal for what we think is a very reasonable exploration and achievable time frame to achieve a working proof of concept for you, with the goal of deploying a working demo based on your test data, and providing a schema template that preserves the way you are already working, with a few extra fields to make your spreadsheets plug and play for future events.

We have two tiers to offer here: 

Option A — MVP Proof of Concept ($2,500, ~10 days)  
We build a private demo that loads your run-of-show and map data into a single shared view: an interactive map and a filterable schedule. No logins, no per-team views — just proof that your existing spreadsheet and google map preparation can power a real app.

Option B — Operational PoC ($5,000, ~20 days)  
Everything in Option A, plus what makes this useful for production: role-based views for admins, leads, vendors, and guests; an admin dashboard to scope what each team sees;  calendar subscription; and the reusable schema template so future events plug in without a from-scratch build.

We recommend Option B if The Portal wants this to become a standing capability. Option A is the right choice if you only need to validate the concept before committing further.