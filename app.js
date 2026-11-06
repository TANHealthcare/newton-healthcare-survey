/**
 * Public submission gateway for the Newton County healthcare needs assessment.
 * Only this server function writes records. Requires ALLOWED_ORIGINS and the
 * original schema plus NEWTON_RATE_LIMITS.sql. No outside CAPTCHA account required.
 * This includes basic abuse controls but is NOT fully bot-proof.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',').map(v => v.trim()).filter(Boolean);
const url = Deno.env.get('SUPABASE_URL') || '';
// New Supabase projects inject a JSON map of secret keys. Older projects also support the legacy service-role key.
const keyMap = (() => { try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); } catch { return {}; } })();
const serverKey = keyMap.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function respond(data: object, status: number, origin = '') {
  const headers: Record<string,string> = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin' };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type';
  }
  return new Response(JSON.stringify(data), {status,headers});
}

const sets = {
  age_group: ['under18','18-24','25-34','35-44','45-54','55-64','65-74','75+','prefer_not'],
  gender: ['woman','man','nonbinary','other','prefer_not'],
  audience: ['self','children','caregiver'],
  services: ['primary','prevention','pediatric','vaccines','blood_pressure','diabetes','heart_stroke','stroke_rehab','women','pregnancy','menopause','mental','substance','chronic','rehab','dental','vision','other'],
  specialists: ['cardiology','neurology','endocrinology','obgyn','dermatology','psychiatry','orthopedics','urology','pulmonology','gastro','nephrology','rheumatology','pain','pediatric_specialty','other'],
  barriers: ['distance','transport','cost','no_insurance','insurance_limit','appointments','specialists','hours','meds','childcare','mobility','language','internet','none','other'],
  care_location: ['','none','newton','jasper','beaumont','louisiana','elsewhere','prefer_not'],
  travel_time: ['','0-15','16-30','31-60','over60','unknown'],
  delayed_care: ['','yes','no','unsure','prefer_not'],
  ideal_features: ['evenings','weekends','same_day','walkin','telehealth','lab','xray','ultrasound','pharmacy','counseling','therapy','dental','vision','affordability','transport_help','other'],
  telehealth_comfort: ['','yes','maybe','no','unsure'],
  priorities: ['primary','pediatric','specialists','mental','prevention','chronic','women','rehab','lab','imaging','pharmacy','after_hours','cost','transport','dentalvision','other'],
  source: ['','facebook','community','tan_staff','senior','partner','friend','other']
} as const;
function choice(value: unknown, choices: readonly string[]) { return typeof value==='string' && choices.includes(value); }
function string(value: unknown, max=160) { return typeof value==='string' && value.length<=max; }
function selections(value: unknown, choices: readonly string[], max=60) {
  return Array.isArray(value) && value.length<=max && new Set(value).size===value.length && value.every(v=>choice(v,choices));
}
function clean(obj: Record<string,unknown>) {
  if (!/^\d{5}$/.test(String(obj.zip_code || ''))) return null;
  if (!choice(obj.age_group, sets.age_group)||!choice(obj.gender,sets.gender)) return null;
  if (!selections(obj.audience,sets.audience,3)||(obj.audience as unknown[]).length<1)return null;
  for(const k of ['services','specialists','barriers','ideal_features','priorities'] as const) {
    if(!selections(obj[k],sets[k])) return null;
  }
  if ((obj.priorities as unknown[]).length<1 || (obj.priorities as unknown[]).length>3)return null;
  if ((obj.barriers as string[]).includes('none') && (obj.barriers as string[]).length>1)return null;
  for(const k of ['care_location','travel_time','delayed_care','telehealth_comfort','source'] as const){
    if(!choice(obj[k], sets[k]))return null;
  }
  for(const k of ['services_other','specialists_other','barriers_other','ideal_other','priorities_other'] as const){if(!string(obj[k],160))return null;}
  if (!string(obj.comments,750)||typeof obj.staff_assisted!=='boolean')return null;
  return {
    zip_code:obj.zip_code,age_group:obj.age_group,gender:obj.gender,audience:obj.audience,
    services:obj.services,services_other:obj.services_other,specialists:obj.specialists,
    specialists_other:obj.specialists_other,barriers:obj.barriers,barriers_other:obj.barriers_other,
    care_location:obj.care_location,travel_time:obj.travel_time,delayed_care:obj.delayed_care,
    ideal_features:obj.ideal_features,ideal_other:obj.ideal_other,
    telehealth_comfort:obj.telehealth_comfort,priorities:obj.priorities,
    priorities_other:obj.priorities_other,comments:obj.comments,source:obj.source,staff_assisted:obj.staff_assisted
  };
}
function cleanContact(value: unknown) {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value))return false;
  const c=value as Record<string,unknown>;
  if(c.consent!==true||!string(c.name,100)||!string(c.phone,35)||!string(c.email,160))return false;
  const phone=(c.phone as string).replace(/\D/g,'');
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email as string);
  if(!validEmail && phone.length<10)return false;
  return {name:c.name,phone:c.phone,email:c.email};
}

Deno.serve(async (req) => {
  const origin=req.headers.get('Origin')||'';
  if(!allowedOrigins.includes(origin))return respond({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'
  }});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405,origin);
  if(!url||!serverKey)return respond({error:'Not configured'},503,origin);
  if(!(req.headers.get('Content-Type')||'').startsWith('application/json'))return respond({error:'Expected JSON'},415,origin);
  if(Number(req.headers.get('Content-Length')||0)>20000)return respond({error:'Payload too large'},413,origin);
  try {
    const raw=await req.text();if(raw.length>20000)return respond({error:'Payload too large'},413,origin);
    const body=JSON.parse(raw);
    if(!body||typeof body!=='object'||Array.isArray(body)||body.honey)return respond({error:'Invalid submission'},400,origin);
    const record=clean(body);
    const contact=cleanContact(body.contact);
    if(!record||contact===false)return respond({error:'Please review your answers'},400,origin);
    // Hash a short-lived network identifier for basic rate limits. Never store raw IPs.
    // Network proxies can mask or alter this value, so this is not foolproof bot prevention.
    const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0,90);
    const day = new Date().toISOString().slice(0,10);
    const bytes = new TextEncoder().encode(day + ':' + ip);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const fingerprint = Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
    const db=createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:status,error}=await db.rpc('store_newton_survey_throttled',{p_response:record,p_contact:contact,p_fingerprint:fingerprint});
    if(error){console.error('Newton survey database write failed',error.code);return respond({error:'Unable to save'},503,origin);}
    if(status==='limited')return respond({error:'Please try again later'},429,origin);
    if(status!=='ok')return respond({error:'Unable to save'},503,origin);
    return respond({ok:true},201,origin);
  }catch(e){console.error('Survey request failed',e instanceof Error?e.name:'error');return respond({error:'Unable to process submission'},400,origin);}
});
