import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg=window.TAN_SURVEY_CONFIG || {};
const el=id=>document.getElementById(id);
const ready=!!(cfg.supabaseUrl && cfg.supabasePublishableKey);
let db=null,records=[],contacts=[],current=[];
const labelMaps={
  services:{primary:'Primary care',prevention:'Checkups / prevention',pediatric:'Pediatric care',vaccines:'Vaccines',blood_pressure:'Blood pressure',diabetes:'Diabetes',heart_stroke:'Heart / stroke prevention',stroke_rehab:'Stroke recovery',women:'Women’s health',pregnancy:'Pregnancy / postpartum',menopause:'Menopause',mental:'Mental health',substance:'Substance use recovery',chronic:'Chronic condition care',rehab:'Rehabilitation',dental:'Dental',vision:'Vision',other:'Other'},
  specialists:{cardiology:'Cardiology',neurology:'Neurology',endocrinology:'Endocrinology',obgyn:'OB-GYN',dermatology:'Dermatology',psychiatry:'Psychiatry',orthopedics:'Orthopedics',urology:'Urology',pulmonology:'Pulmonology',gastro:'Gastroenterology',nephrology:'Nephrology',rheumatology:'Rheumatology',pain:'Pain management',pediatric_specialty:'Pediatric specialists',other:'Other'},
  barriers:{distance:'Distance',transport:'Transportation',cost:'Cost',no_insurance:'No insurance',insurance_limit:'Insurance limitations',appointments:'Getting appointments',specialists:'Specialist shortage',hours:'Office hours',meds:'Medication access/cost',childcare:'Caregiving support',mobility:'Accessibility',language:'Language/communication',internet:'Internet/technology',none:'No barriers',other:'Other'},
  ideal_features:{evenings:'Evening hours',weekends:'Weekend hours',same_day:'Same-day appointments',walkin:'Walk-in visits',telehealth:'Supported telehealth',lab:'On-site lab',xray:'X-rays',ultrasound:'Ultrasound',pharmacy:'Prescriptions nearby',counseling:'Counseling',therapy:'Rehab/therapy',dental:'Dental',vision:'Vision',affordability:'Affordable care help',transport_help:'Transportation help',other:'Other'},
  priorities:{primary:'Primary care',pediatric:'Pediatric care',specialists:'Specialists',mental:'Mental health',prevention:'Prevention/vaccines',chronic:'Chronic conditions',women:'Women’s health',rehab:'Stroke recovery/rehab',lab:'Lab/diagnostics',imaging:'Imaging',pharmacy:'Pharmacy',after_hours:'After-hours access',cost:'Affordability',transport:'Transportation',dentalvision:'Dental/vision',other:'Other'}
};
function showError(message){el('admin-error').textContent=message;}
function csvValue(value){let s=Array.isArray(value)?value.join(' | '):value==null?'':String(value);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function downloadCsv(filename,rows){if(!rows.length)return alert('There is no data to export.');const cols=Object.keys(rows[0]);const csv='\uFEFF'+cols.map(csvValue).join(',')+'\r\n'+rows.map(r=>cols.map(c=>csvValue(r[c])).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function counts(field){const map=new Map();for(const r of current){for(const s of Array.isArray(r[field])?r[field]:[]){map.set(s,(map.get(s)||0)+1);}}return [...map.entries()].sort((a,b)=>b[1]-a[1]);}
function drawChart(title,items,labels){const card=document.createElement('section');card.className='chart-card';const h=document.createElement('h3');h.textContent=title;card.append(h);const max=items.reduce((n,x)=>Math.max(n,x[1]),1);if(!items.length){const empty=document.createElement('p');empty.textContent='No selections to display yet.';card.append(empty);}for(const [key,count] of items.slice(0,17)){
  const wrap=document.createElement('div');wrap.className='barline';const row=document.createElement('div');row.className='barlabel';const name=document.createElement('span');name.textContent=labels?.[key]||key;const n=document.createElement('b');n.textContent=String(count);row.append(name,n);const track=document.createElement('div');track.className='bartrack';const bar=document.createElement('div');bar.className='barfill';bar.style.width=(100*count/max).toFixed(1)+'%';track.append(bar);wrap.append(row,track);card.append(wrap);
}el('charts').append(card);}
function render(){const zip=el('zip-filter').value;current=zip?records.filter(r=>r.zip_code===zip):records.slice();el('stat-total').textContent=current.length.toLocaleString();el('stat-delayed').textContent=current.filter(r=>r.delayed_care==='yes').length.toLocaleString();el('stat-assisted').textContent=current.filter(r=>r.staff_assisted).length.toLocaleString();el('charts').replaceChildren();
  const zips=new Map();for(const r of current)zips.set(r.zip_code,(zips.get(r.zip_code)||0)+1);
  drawChart('Responses by ZIP code',[...zips.entries()].sort((a,b)=>b[1]-a[1]));
  drawChart('Top three priorities',counts('priorities'),labelMaps.priorities);
  drawChart('Healthcare services needed',counts('services'),labelMaps.services);
  drawChart('Requested specialists',counts('specialists'),labelMaps.specialists);
  drawChart('Barriers to getting healthcare',counts('barriers'),labelMaps.barriers);
  drawChart('Features of an ideal community clinic',counts('ideal_features'),labelMaps.ideal_features);
}
async function fetchAll(table){const all=[];const pageSize=500;for(let i=0;i<40;i++){const {data,error}=await db.from(table).select('*').order('created_at',{ascending:false}).range(i*pageSize,(i+1)*pageSize-1);if(error)throw error;all.push(...data);if(data.length<pageSize)break;}return all;}
async function load(){el('admin-status').textContent='Loading responses…';try{
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)throw new Error('Please sign in again.');
  const {data:access,error:accessError}=await db.from('newton_survey_staff').select('user_id').eq('user_id',user.id).maybeSingle();
  if(accessError||!access)throw new Error('Your account is not yet approved for survey reports. Ask the survey administrator to grant access.');
  [records,contacts]=await Promise.all([fetchAll('newton_survey_responses'),fetchAll('newton_survey_contacts')]);
  el('login-panel').hidden=true;el('dashboard').hidden=false;const prior=el('zip-filter').value;const select=el('zip-filter');select.replaceChildren(new Option('All ZIP codes',''));[...new Set(records.map(r=>r.zip_code))].sort().forEach(z=>select.add(new Option(z,z)));if([...select.options].some(o=>o.value===prior))select.value=prior;
  render();const body=el('contact-body');body.replaceChildren();for(const c of contacts){const tr=document.createElement('tr');for(const value of [new Date(c.created_at).toLocaleDateString(),c.name,c.phone,c.email]){const td=document.createElement('td');td.textContent=value||'—';tr.append(td);}body.append(tr);}if(!contacts.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent='No contact requests yet.';tr.append(td);body.append(tr);}
  el('admin-status').textContent=`Updated ${new Date().toLocaleString()} · ${records.length} total responses`;
}catch(error){showError(error.message||'Unable to load survey data.');el('admin-status').textContent='Could not load responses';}}
const csvFields=['id','created_at','zip_code','age_group','gender','audience','services','services_other','specialists','specialists_other','barriers','barriers_other','care_location','travel_time','delayed_care','ideal_features','ideal_other','telehealth_comfort','priorities','priorities_other','comments','source','staff_assisted'];
el('download-responses').addEventListener('click',()=>downloadCsv('newton-survey-responses.csv',current.map(r=>Object.fromEntries(csvFields.map(k=>[k,r[k]])))));
el('download-summary').addEventListener('click',()=>{const fields=['priorities','services','specialists','barriers','ideal_features'];const rows=[];for(const field of fields){for(const [option,count] of counts(field))rows.push({zip_code:el('zip-filter').value||'all',category:field,option:labelMaps[field][option]||option,number_of_responses:count,total_survey_responses:current.length});}downloadCsv('newton-survey-summary.csv',rows);});
el('download-contacts').addEventListener('click',()=>downloadCsv('newton-survey-contact-requests.csv',contacts.map(c=>({received:c.created_at,name:c.name,phone:c.phone,email:c.email,consent:'yes'}))));
el('zip-filter').addEventListener('change',render);el('reload-btn').addEventListener('click',load);
el('logout-btn').addEventListener('click',async()=>{await db.auth.signOut();records=[];contacts=[];el('dashboard').hidden=true;el('login-panel').hidden=false;el('staff-password').value='';showError('');});
if(!ready){el('admin-setup').hidden=false;el('login-btn').disabled=true;}else{
  db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  el('login-form').addEventListener('submit',async(e)=>{e.preventDefault();showError('');const btn=el('login-btn');btn.disabled=true;btn.textContent='Signing in…';try{const {error}=await db.auth.signInWithPassword({email:el('staff-email').value.trim(),password:el('staff-password').value});if(error)throw error;await load();}catch(err){showError(err.message||'Sign-in failed.');}finally{btn.disabled=false;btn.textContent='Sign in';}});
  db.auth.getSession().then(({data:{session}})=>{if(session)load();});
}
