import {PRICE_POLICY,LOW_MARKUP,atLeast,markupBand,summarizePrices,applyPricePolicy} from './price-policy.js?v=shouren-goods-tax-20261103';
export const MONITORING_VERSION='daily-tax-20261103';
const gap=(a,b)=>a&&b?Math.round((Date.parse(a)-Date.parse(b))/86400000):null;
const pricePrefix=r=>'price:'+r.key+':';
const values=(pack,row)=>Object.entries(pack?.priceValues||{}).filter(([key])=>key.startsWith(pricePrefix(row)));
const activeLink=x=>x?.state==='跟价✔';
const linkKey=x=>[x.platform,x.goods,x.sku,x.url].join('|');
export const markupAbnormal=(price,threshold=LOW_MARKUP)=>atLeast(price,threshold);
function mark(row,pack,module){
 if(module==='limits')return {active:row.limitSkus>0,valid:row.limitSkus>0||!!pack.complete?.limits,date:pack.date};
 if(module==='stock')return {active:row.stockSkus>0,valid:row.mode==='全托'&&(row.stockSkus>0||!!pack.complete?.stock),date:pack.date};
 if(module==='ads'){const a=row.ad,valid=!!a?.covered&&a.roas!=null&&a.target>0;return {active:valid&&a.roas<a.target,valid,date:a?.date||pack.date};}
 const entries=values(pack,row).map(([,p])=>p),valid=entries.length>0&&entries.every(p=>p.markup!=null);
 return {active:row.markupBand?['medium','high'].includes(row.markupBand):entries.some(p=>markupAbnormal(p,pack.threshold)),valid,date:pack.date};
}
export function assessMarkup(pack){
 if(pack.pricePolicy===PRICE_POLICY&&pack.markupAssessment===PRICE_POLICY)return pack;
 pack.legacyMarkupRecalculated=true;pack.pricePolicy=PRICE_POLICY;pack.threshold=LOW_MARKUP;
 for(const row of pack.rows||[])if(!['UDP','EU','GLO'].includes(row.dep))row.dep='';
 for(const [key,p]of Object.entries(pack.priceValues||{})){const parts=key.split(':'),row=(pack.rows||[]).find(r=>r.key===parts.slice(1,4).join(':'));p.site=p.site||parts[5];applyPricePolicy(p,{mode:row?.mode||parts[1],categoryId:row?.categoryId,date:pack.date});}
 for(const p of pack.pendingPrices||[])applyPricePolicy(p,{mode:p.mode||'半托',date:pack.date});
 for(const row of pack.rows||[]){const entries=values(pack,row),high=entries.filter(([,p])=>markupAbnormal(p,pack.threshold)),rates=entries.map(([,p])=>p.markup).filter(v=>v!=null);if(pack.pricePolicy===PRICE_POLICY)summarizePrices(row,entries.map(([,p])=>p));else{row.highCount=high.length;row.maxMarkup=rates.length?Math.max(...rates):null;}
  if(row.monitoring)row.monitoring.price={status:high.length?'首次检出':entries.some(([,p])=>p.markup==null)?'数据待核':'已达标',active:high.length>0,valid:entries.length>0&&entries.every(([,p])=>p.markup!=null),consecutiveDays:high.length?1:0,observedDays:high.length?1:0,dataDate:pack.date,firstSeen:pack.date,ruleChanged:true};
  row.issues=(row.issues||[]).filter(i=>i.module!=='price');
  for(const [key,p] of high){const parts=key.split(':');row.issues.push({key,productKey:row.key,module:'price',sku:parts[4]||'',site:parts[5]||'',source:p.source||'',title:markupBand(p)==='high'?'高加价率':'中加价率',severity:markupBand(p)==='high'?'高':'中',dataDate:pack.date,markup:p.markup,sell:p.sell,supply:p.supply,state:'存在',change:'基线',firstSeen:pack.date,observations:1,continuous:1});}
 }
 for(const field of ['recovered','unverified'])if(pack[field])pack[field]=pack[field].filter(i=>i.module!=='price');
 if(pack.issueIndex)pack.issueIndex=Object.fromEntries(Object.entries(pack.issueIndex).filter(([,i])=>i.module!=='price'));
 if(pack.priceAudit){const prices=[...Object.values(pack.priceValues||{}),...(pack.pendingPrices||[])];pack.priceAudit.calculated=prices.filter(p=>p.markup!=null).length;pack.priceAudit.taxPending=prices.filter(p=>p.taxRate==null).length;}
 pack.markupAssessment=pack.pricePolicy===PRICE_POLICY?PRICE_POLICY:'strict-under-threshold-20261102';return pack;
}
export function buildContinuity(pack,previous){
 const before=new Map((previous?.rows||[]).map(r=>[r.key,r])),after=new Set((pack.rows||[]).map(r=>r.key));
 pack.continuity={version:MONITORING_VERSION,referenceDate:previous?.date||'',gapDays:previous?gap(pack.date,previous.date):null,linkReferenceAvailable:Object.values(previous?.priceValues||{}).some(v=>Array.isArray(v.links)),exited:(previous?.rows||[]).filter(r=>!after.has(r.key)).map(r=>({key:r.key,goods:r.goods,mode:r.mode,dep:r.dep,owner:r.owner,categoryId:r.categoryId,modules:['limits','stock','price','ads'].filter(m=>mark(r,previous,m).active)}))};
 for(const row of pack.rows||[]){const old=before.get(row.key);row.monitoring={};
  for(const module of ['limits','stock','price','ads']){const now=mark(row,pack,module),prior=old?mark(old,previous,module):null,priorState=old?.monitoring?.[module],days=prior?gap(now.date,prior.date):null;
   let status=now.active?(!previous?'首次检出':!old?(pack.monitoringUniverse?'新增检出':'新纳入'):prior.active?'持续':'新增检出'):prior?.active?(now.valid?'已恢复':module==='limits'||module==='stock'?'未再检出':'待核实'):now.valid?'已达标':'数据待核';
   if(!now.active&&module==='stock'&&row.mode!=='全托')status='不适用';
   row.monitoring[module]={status,active:now.active,valid:now.valid,dataDate:now.date,referenceDate:prior?.date||previous?.date||'',firstSeen:now.active?(prior?.active?priorState?.firstSeen||previous.date:now.date):priorState?.firstSeen||'',consecutiveDays:now.active?(prior?.active&&days===0?priorState?.consecutiveDays||1:prior?.active&&days===1?(priorState?.consecutiveDays||1)+1:1):0,observedDays:now.active?(prior?.active?(priorState?.observedDays||1)+(days>0?1:0):1):0,missingDays:prior?.active&&now.active&&days>1?days-1:0,newToPool:!!previous&&!old};
   if(module==='ads'&&now.active&&row.adHistory?.length){const history=row.adHistory.filter(a=>a.date<=now.date).sort((a,b)=>b.date.localeCompare(a.date));let count=0,last=now.date,first=now.date;for(const a of history){if(!a.comparable||!a.alert||(count?gap(last,a.date)!==1:a.date!==now.date))break;count++;last=a.date;first=a.date;}if(count){Object.assign(row.monitoring.ads,{consecutiveDays:count,observedDays:count,firstSeen:first,missingDays:0});}}
  }
  const changes={comparable:0,sellUp:0,sellDown:0,supplyUp:0,supplyDown:0,markupUp:0,markupDown:0,newAbnormal:0,recovered:0,followActive:0,followActivated:0,followStopped:0,followMissing:0};
  for(const [key,p]of values(pack,row)){const oldPrice=previous?.priceValues?.[key];if(oldPrice&&!p.conflict&&!oldPrice.conflict&&(!p.currency||!oldPrice.currency||p.currency===oldPrice.currency)){
    for(const [field,up,down]of [['sell','sellUp','sellDown'],['supply','supplyUp','supplyDown'],['markup','markupUp','markupDown']])if(p[field]!=null&&oldPrice[field]!=null){const delta=p[field]-oldPrice[field];if(delta>1e-10)changes[up]++;if(delta< -1e-10)changes[down]++;}
    if(p.markup!=null&&oldPrice.markup!=null){changes.comparable++;if(!markupAbnormal(oldPrice,previous.threshold)&&markupAbnormal(p,pack.threshold))changes.newAbnormal++;if(markupAbnormal(oldPrice,previous.threshold)&&!markupAbnormal(p,pack.threshold))changes.recovered++;}
   }
   const links=new Map((p.links||[]).map(l=>[linkKey(l),l])),oldLinks=new Map((oldPrice?.links||[]).map(l=>[linkKey(l),l]));
   for(const [id,l]of links){if(activeLink(l))changes.followActive++;if(oldLinks.has(id)&&!activeLink(oldLinks.get(id))&&activeLink(l))changes.followActivated++;if(activeLink(oldLinks.get(id))&&!activeLink(l))changes.followStopped++;}
   for(const [id,l]of oldLinks)if(activeLink(l)&&!links.has(id))changes.followMissing++;
  }
  row.priceChanges=changes;
 }
 return pack;
}
export function continuityCounts(rows,module){const result={active:0,new:0,continuing:0,missing:0,recovered:0,newToPool:0,maxDays:0,unknown:0};for(const r of rows){const m=r.monitoring?.[module];if(!m){result.unknown++;continue;}result.active+=+m.active;result.new+=+(m.status==='新增检出');result.continuing+=+(m.status==='持续');result.missing+=+['未再检出','待核实'].includes(m.status);result.recovered+=+(m.status==='已恢复');result.newToPool+=+(m.status==='新纳入');result.maxDays=Math.max(result.maxDays,m.consecutiveDays||0);result.unknown+=+(m.status==='数据待核');}return result;}
