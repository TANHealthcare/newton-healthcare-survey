// Public website settings. Enter ONLY public addresses and public/publishable keys here.
// NEVER put a Supabase secret/service-role key or a Cloudflare Turnstile secret in this file.
window.TAN_SURVEY_CONFIG = {
  surveyEndpoint: "", // e.g. https://PROJECT_REF.supabase.co/functions/v1/submit-survey
  supabaseUrl: "",    // e.g. https://PROJECT_REF.supabase.co (for staff dashboard)
  supabasePublishableKey: "", // public publishable/anon key; staff dashboard only
  turnstileSiteKey: "" // Cloudflare Turnstile public site key (required for live submissions)
};
