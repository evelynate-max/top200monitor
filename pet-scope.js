import {markupAbnormal} from './continuity.js?v=shouren-20261102';
import {STAFF_RULES,SCOPE_VERSION,STAFF_META} from './scope-rules.js?v=shouren-20261102';
const id=v=>v==null?'':String(v).trim().replace(/\.0$/,'');
export {STAFF_RULES,SCOPE_VERSION,STAFF_META};
export function scopeOwners(mode='全部',staff=STAFF_RULES){
 const fields=mode==='半托'?['half']:mode==='全托'?['full']:['half','full'];
 return [...new Set(Object.values(staff).flatMap(r=>fields.map(field=>r[field])).filter(v=>v&&v!=='待分配'))].sort((a,b)=>a.localeCompare(b,'zh'));
}
export function categoryCatalog(sheets,options={}){
 const facts=new Map,cutoff=options.date||'',snapshotDate=cutoff||'9999-12-31';
 const sourceDate=v=>{if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10);if(v instanceof Date)return v.toISOString().slice(0,10);const text=id(v);return /^\d{4}-\d\d-\d\d/.test(text)?text.slice(0,10):'';};
 const add=(g,c,name='',date='',explicit=false,basis='')=>{g=id(g);c=id(c);if(!/^\d+$/.test(g)||!/^\d+$/.test(c)||(cutoff&&date>cutoff))return;if(!facts.has(g))facts.set(g,[]);facts.get(g).push({categoryId:c,category:name||STAFF_RULES[c]?.category||'',date,explicit,basis});};
 for(const [name,all]of Object.entries(sheets))for(const r of all.slice(1)){
  if(name.includes('限流'))add(r[0],r[5],r[6],snapshotDate,false,name);
  if(name.includes('广告月数据')){const date=sourceDate(r[0]);if(date)add(r[4],r[14],r[15],date,false,name);}
  if(name.includes('售罄'))add(r[7],r[2],'',snapshotDate,false,name);
  if(['商品类目映射','商品基础信息'].includes(name)){const h=all[0].map(id),gi=h.findIndex(x=>/^(goods.?id|商品id)$/i.test(x)),ci=h.findIndex(x=>/叶子类目.?id/i.test(x));if(gi>=0&&ci>=0)add(r[gi],r[ci],'',snapshotDate,true,name);}
 }
 return Object.fromEntries([...facts].map(([g,records])=>{const explicit=records.filter(r=>r.explicit),latest=records.map(r=>r.date).sort().at(-1),selected=explicit.length?explicit:records.filter(r=>r.date===latest),byId=new Map(selected.map(r=>[r.categoryId,r]));const evidence={categoryDate:latest===snapshotDate?cutoff:latest,categoryBasis:explicit.length?'商品类目映射或基础信息':'最新有效日期的类目记录',categoryCandidates:[...new Set(records.map(r=>r.categoryId))]};return[g,byId.size===1?{...byId.values().next().value,...evidence}:{conflict:[...byId.keys()],...evidence}];}));
}
export function petStats(pack){
 const rs=pack.rows,unique=new Map;for(const r of rs)if(r.stockSkus)unique.set(r.goods,Math.max(unique.get(r.goods)||0,r.stockLoss||0));
 return {pool:rs.length,goods:new Set(rs.map(r=>r.goods)).size,priceGoods:rs.filter(r=>r.priceCount).length,lowGoods:rs.filter(r=>r.lowCount).length,limitGoods:rs.filter(r=>r.limitSkus).length,stockGoods:unique.size,stockLoss:[...unique.values()].reduce((a,b)=>a+b,0),adsGoods:rs.filter(r=>r.ad?.covered).length,adsAlerts:rs.filter(r=>r.issues.some(i=>i.module==='ads')).length,newGoods:rs.filter(r=>r.newCount).length,recovered:new Set((pack.recovered||[]).map(i=>i.key)).size,unverified:(pack.unverified||[]).length,unmatched:rs.filter(r=>r.identity!=='已核验').length,unassigned:rs.filter(r=>!r.owner||r.owner==='待分配').length};
}
export function applyPetScope(pack,catalog={},staff=STAFF_RULES){
 const original=pack.rows||[],audit={original:original.length,inScope:0,unknown:0,conflict:0,outside:0,excluded:[]};
 pack.rows=original.filter(r=>{
  const fact=catalog[r.goods]||{categoryId:r.categoryId},cat=staff[fact.categoryId];let reason='';
  if(fact.conflict)reason='类目冲突';else if(!fact.categoryId)reason='缺少商品类目';else if(!cat)reason='非本组类目';
  if(reason){audit[reason==='类目冲突'?'conflict':reason==='缺少商品类目'?'unknown':'outside']++;audit.excluded.push({key:r.key,goods:r.goods,mode:r.mode,dep:r.dep,categoryId:fact.categoryId||'',reason});return false;}
  Object.assign(r,{categoryId:fact.categoryId,category:cat.category,owner:r.mode==='半托'?cat.half:cat.full,leader:cat.leader,categoryGroup:cat.group,categoryFamily:cat.family,ownerBasis:'叶子类目ID＋经营模式',scope:'守仁组'});
  r.warnings=(r.warnings||[]).filter(x=>x!=='负责人待分配');audit.inScope++;return true;
 });
 const keys=new Set(pack.rows.map(r=>r.key)),goods=new Set(pack.rows.map(r=>r.goods));
 pack.warnings=(pack.warnings||[]).filter(w=>!(w.message.match(/\d{13,}/g)||[]).some(g=>!goods.has(g)));
 for(const field of ['recovered','unverified'])if(pack[field])pack[field]=pack[field].filter(i=>keys.has(i.productKey));
 if(pack.details)pack.details=Object.fromEntries(Object.entries(pack.details).filter(([k])=>keys.has(k)));
 if(pack.issueIndex)pack.issueIndex=Object.fromEntries(Object.entries(pack.issueIndex).filter(([,i])=>keys.has(i.productKey)));
 if(pack.priceValues){const allowed=new Set(pack.rows.flatMap(r=>pack.details?.[r.key]?.prices?.map(x=>x.key)||[]));pack.priceValues=Object.fromEntries(Object.entries(pack.priceValues).filter(([k])=>allowed.size?allowed.has(k):pack.rows.some(r=>k.startsWith('price:'+r.key+':'))));}
 pack.scopeVersion=SCOPE_VERSION;pack.staffMeta=STAFF_META;pack.staffRules=staff;pack.scopeAudit=pack.scopeAudit?.original>audit.original?pack.scopeAudit:audit;pack.stats=petStats(pack);pack.stats.highGoods=pack.rows.filter(r=>r.highCount>0).length;return pack;
}
export function enrichReadings(pack,details){
 for(const r of pack.rows){const d=details[r.key];if(!d)continue;const days=new Map;for(const a of d.ads||[]){if(!days.has(a.date))days.set(a.date,[]);days.get(a.date).push(a);}
  r.adHistory=[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>{const a=values.length===1?values[0]:null,comparable=!!a&&a.roas!=null&&a.target>0;return{date,covered:true,comparable,alert:comparable&&a.roas<a.target};});
  const prices=(d.prices||[]).filter(p=>p.markup!=null);r.priceBands=[prices.filter(p=>p.markup<0).length,prices.filter(p=>p.markup>=0&&!markupAbnormal(p,pack.threshold)).length,prices.filter(p=>markupAbnormal(p,pack.threshold)).length,(d.prices||[]).length-prices.length];
 }
 return pack;
}
