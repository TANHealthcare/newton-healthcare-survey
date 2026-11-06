# Newton County Community Healthcare Needs Assessment

A TAN Healthcare-branded, responsive community needs assessment designed for outreach on a tablet and independent participation through community links, QR codes, and Facebook. Works on desktop, tablet, and mobile.

**Status: working survey PREVIEW, not a live intake system.** When `config.js` is blank, the eight-step questionnaire works for demonstration but **does not send or save responses**. Do not share it as an active public survey until the collection system, staff access, required notices, and privacy review are complete.

## What's included

- Eight guided steps with English/Spanish switching.
- Required five-digit ZIP code, age group, and gender response (including "prefer not to answer" for gender and age).
- Select-all-that-apply: answering for yourself/children/people you care for, care needs, specialty care, barriers, desired clinic services and conveniences.
- Current care location, typical one-way travel time, delays to care, and comfort with specialist video visits.
- Up to three community healthcare priorities.
- Open-text ideas (750 characters). Explicit warning not to enter medical records or sensitive personal information.
- Optional contact name/phone/email, with affirmative contact permission required if contact details are provided.
- Staff-assisted flag and "How did you hear about this survey?" field for outreach tracking.
- No login required for the public. No answers saved to browser local storage.
- A staff-only reporting dashboard (`admin.html`) with ZIP filters, response counts, charts and downloadable CSVs; *only functional after backend and staff accounts are configured*.
- Database SQL schema and a Supabase Edge Function that accepts public submissions **only after a server-side Cloudflare Turnstile verification**, then writes to private tables.

The survey is a **community planning instrument**, not a patient intake form, appointment request, diagnosis, emergency service, or promise of future services. Emergency rooms, inpatient stays, and overnight hospital services are deliberately excluded.

## 1. Try it first

Extract the ZIP and open `index.html` in a modern browser. Or upload the files to a GitHub Pages repository as described below. The yellow PREVIEW MODE banner means no answers are transmitted or stored. Test the full survey and bilingual labels, including the review step and demo completion message.

## 2. Publish the *preview* to the TAN GitHub organization

GitHub Pages hosts the **public web files**, not the private responses.

1. On GitHub, open your TAN Healthcare **organization** and create a **new public repository** named, for example, `newton-healthcare-survey`. (The organization must be selected as *Owner*, not your personal profile.)
2. Upload the contents of this folder to the **root** of the repo: `index.html`, `styles.css`, `app.js`, `admin.html`, `admin.js`, `config.js`, `assets/`, `.nojekyll`, etc. Keep the same directory structure.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**; choose `main` and `/(root)`; save.
4. When Pages is ready, the URL will typically resemble `https://YOUR-ORGANIZATION.github.io/newton-healthcare-survey/`. Verify the actual address in GitHub Pages settings; don't assume any illustrative URL is live.
5. **Do not publicize this preview as a survey people can complete.** The preview banner intentionally explains that it doesn't collect data.

A separate free GitHub organization can own a repository, but **GitHub Pages alone cannot securely store survey answers or contact details**.

## 3. Obtain TAN's privacy and IT approval before collecting real responses

This survey asks about healthcare needs and contains optional free text and follow-up contact information. Depending on who operates it, how it is used, and the identifiers collected, data may implicate HIPAA, Texas privacy obligations, organizational records policy, or other requirements. **No claim of HIPAA compliance is made by these source files.** Before using them with real participants, have TAN's privacy/IT lead (and counsel, if needed):

- approve the data collection notice and consent language, data retention/deletion plan, and any required vendor agreements (including a BAA if applicable);
- approve hosting, database vendor and any paid/enterprise security terms required for your use;
- designate named authorized staff for access and exports; never use shared logins;
- decide whether to allow open comments and optional contact details in the same initiative, given the possibility of sensitive self-disclosure;
- test with fictitious entries only before release;
- arrange accessibility and translation review of the Spanish wording and the mobile/tablet layout.

Avoid publishing survey exports, API secret keys, contact information, or raw response data to GitHub. Keep copies of data exports secure, with controlled access.

## 4. Connect private data storage (example: Supabase)

The included configuration demonstrates one possible implementation. The public website is static and hosted by GitHub Pages. Private data is written only through a server-side Supabase Edge Function into private tables protected with Row Level Security (RLS). It uses Cloudflare Turnstile to reduce automated spam.

**Review and approve vendor suitability before setting it up with real data.** Vendor free-tier offerings may not meet every healthcare organization's contractual or compliance requirements.

1. Create an approved Supabase project. In the **SQL Editor**, run `supabase/schema.sql` *once*. Confirm tables `newton_survey_responses`, `newton_survey_contacts`, and `newton_survey_staff` exist with RLS enabled.
2. Create a Cloudflare Turnstile widget for the exact future GitHub Pages hostname (e.g. `YOUR-ORGANIZATION.github.io`). Obtain its **public site key** and **private secret key**.
3. Use Supabase's Edge Functions facility (Dashboard or CLI) to deploy `supabase/functions/submit-survey/index.ts` under the name `submit-survey`. Set `verify_jwt = false` for that function using `supabase/config.toml` or the corresponding dashboard setting. This function is protected by origin checks, server validation and mandatory Turnstile, not by a public user JWT.
4. In **Supabase Edge Function Secrets** (not GitHub), set:
   - `TURNSTILE_SECRET` = your private Cloudflare Turnstile secret
   - `ALLOWED_ORIGINS` = your exact public site origin, such as `https://YOUR-ORGANIZATION.github.io` (no final slash, no path). Comma-separate additional allowed development origins if approved.
   Supabase provides `SUPABASE_URL` and secret server API keys to the function. Do **not** place any secret key in `config.js`.
5. Edit only `config.js` on the website:
   - `surveyEndpoint` = `https://PROJECT_REF.supabase.co/functions/v1/submit-survey`
   - `supabaseUrl` = `https://PROJECT_REF.supabase.co`
   - `supabasePublishableKey` = the public **publishable/anon** key from Supabase
   - `turnstileSiteKey` = the **public** Turnstile site key
6. Republish the edited `config.js` on GitHub Pages. The yellow preview banner will disappear only when both `surveyEndpoint` and `turnstileSiteKey` are configured. Test submissions with dummy data first, then independently confirm records appear in the private database.

Publicly accessible frontend keys must be **publishable/anon only**. Never paste `service_role`, secret keys, database passwords, or Turnstile secrets into a public repository, an HTML page, or a screenshot.

## 5. Authorize staff and view reports

The dashboard is available at `/admin.html`. It does not permit open registration. Staff authenticate with Supabase Auth and **also** must be added to the allow-list table.

1. As a Supabase project owner, create or invite each staff account in **Authentication → Users**.
2. In SQL Editor, insert each permitted user's actual UUID into `newton_survey_staff`:

   ```sql
   insert into public.newton_survey_staff (user_id)
   values ('USER-UUID-HERE');
   ```

3. Sign into `/admin.html` using that staff member's own account. Results are available only to allow-listed authenticated staff. Filter by ZIP, view counts and charts, export raw survey responses, export summary counts, or separately export follow-up contact requests.
4. When a staff member leaves or loses access, remove their allow-list record and revoke/delete their Auth account/sessions according to TAN policy.

**Important:** The dashboard's results are a voluntary response sample, not a statistically representative estimate of all Newton County residents. The page labels this limitation. Small ZIP/age groups may also create re-identification risk; limit disclosure of small groups in any public report.

## 6. Notes / limitations

- GitHub Pages serves only HTML/CSS/JS/assets; the backend must be configured independently.
- The public form does not save partial responses on shared devices, a deliberate privacy choice. Interrupted users may need to begin again. Tablet staff should have a reliable network connection for submitting responses.
- Spanish is included as a working draft and should be reviewed by a qualified Spanish-language reviewer before public release.
- The form provides broad outpatient options only, not a promise that all the suggested specialties or diagnostics will be offered.
- There is no patient scheduling, diagnosis, clinical triage, or emergency/overnight care functionality.
- Cloudflare Turnstile adds spam protection but cannot guarantee no duplicate or malicious responses; monitor volume and quality, and consider stronger rate controls if needed.
- GitHub Pages domains use the **repository owner's organization name**, not your personal account, when the repository is created under the organization.

## Project files

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | Public responsive, bilingual survey |
| `assets/tan-logo.jpg` | Supplied TAN Healthcare logo |
| `config.js` | Public configuration fields (blank = preview mode) |
| `admin.html`, `admin.js` | Authorized staff reporting view |
| `supabase/schema.sql` | Private response/contact tables, staff authorization, RLS and server write function |
| `supabase/functions/submit-survey/index.ts` | Server-side validated, Turnstile-protected submission |
| `supabase/config.toml` | Edge Function authentication gateway configuration |
| `SURVEY-QUESTIONS.md` | Survey overview for review and sign-off |

Prepared as an initial project build for TAN Healthcare. The copy, survey scope, privacy language, and infrastructure remain subject to organizational approval before live use.
