export const MODES=['半托','全托'];
export const DEPS=['UDP','EU','GLO'];
export const MODULES={price:'价格与加价率',limits:'限流',stock:'售罄',ads:'广告'};
export const ident=v=>v==null?'':String(v).trim().replace(/\.0$/,'');
export const num=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(v==null||/^\s*[-—–\s]*$/.test(String(v)))return null;const n=Number(String(v).replace(/[^0-9.\-]/g,''));return Number.isFinite(n)&&String(v).match(/\d/)?n:null;};
export const site=v=>{const t=ident(v).replace(/站$/,'');return ({'沙特':'沙特阿拉伯','波斯尼亚和黑塞哥维那':'波黑','多米尼加共和国':'多米尼加'}[t]||t)+'站';};
export const productKey=(m,d,g)=>[m,d,g].join(':');
export const dayGap=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
const uniq=a=>[...new Set(a)];
const issueKey=(mod,m,d,g,sku='',st='',source='')=>[mod,m,d,g,sku,st,source].join(':');
const groups=(a,key)=>{const m=new Map;for(const r of a){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
const maxDate=a=>a.filter(Boolean).sort().at(-1)||null;
const dateOf=v=>v instanceof Date?v.toISOString().slice(0,10):/^\d{4}-\d\d-\d\d/.test(String(v))?String(v).slice(0,10):null;
const hashText=t=>{let n=2166136261;for(const x of t){n^=x.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(16);};

export function normalizeWorkbook(sheets,siteRules,opts={}){
 const date=opts.date||new Date().toISOString().slice(0,10),threshold=opts.threshold??.13;
 const complete={limits:false,stock:false,...opts.complete};
 const warnings=[],pools=new Map,details={},byGoods=new Map,ownCats=new Map,shopMap=new Map,shopGlobal=new Map;
 const rawCounts={},rules=new Map(siteRules.map(r=>[r.mode+'|'+r.site,r]));
 const valid=r=>/^\d+$/.test(ident(r[0]));
 const rows=n=>(sheets[n]||[]).slice(1);
 const addWarn=(type,message)=>warnings.push({type,message});
 for(const r of rows('人员映射'))if(ident(r[8]))ownCats.set(ident(r[8]),{category:ident(r[10])||ident(r[9]),group:ident(r[12]),leader:ident(r[14]),half:ident(r[16]),full:ident(r[17])});
 for(const r of rows('店铺映射')){
  const shop=ident(r[4]),seller=ident(r[0]),dep=ident(r[2]);if(!shop||!seller)continue;
  const item={sellerId:seller,seller:ident(r[1]),shop,dep,status:ident(r[6]),subject:ident(r[3])};
  if(DEPS.includes(dep)){const k=dep+'|'+shop;if(!shopMap.has(k))shopMap.set(k,new Map);shopMap.get(k).set(seller,item);}
  if(!shopGlobal.has(shop))shopGlobal.set(shop,new Map);shopGlobal.get(shop).set(seller,item);
 }
 for(const mode of MODES)for(const dep of DEPS){
  const n=mode+(dep==='UDP'?'美国':dep==='EU'?'欧洲':'glo'),source=rows(n),data=source.map(r=>{const combined=ident(r[0]).match(/^(\d+)\s*[|｜]\s*(.+)$/);return combined?[combined[1],r[1]||combined[2]]:r;}).filter(valid),seen=new Set;
  const splitCount=source.filter(r=>/[|｜]/.test(ident(r[0]))).length;if(splitCount)addWarn('名单分列',`${n}的${splitCount}条合并字段已拆成Goods ID与站点。`);
  for(const r of data){const g=ident(r[0]),key=productKey(mode,dep,g);if(seen.has(g)){const p=pools.get(key);p.salesSites=uniq([...p.salesSites,...ident(r[1]).split(/[,，]/).filter(Boolean).map(site)]);p.membershipRows++;continue;}seen.add(g);
   pools.set(key,{key,mode,dep,goods:g,membershipRows:1,name:'',shop:'',shopName:'',sourceSeller:'',categoryId:'',category:'',owner:'待分配',seller:'待匹配',sellerId:'',identity:'未匹配',salesSites:ident(r[1]).split(/[,，]/).filter(Boolean).map(site),priceCount:0,lowCount:0,minMarkup:null,limitSkus:0,limitSites:0,blocked:0,stockSkus:0,stockLoss:0,stockDays:0,ad:null,issues:[],warnings:[]});
   details[key]={prices:[],limits:[],stock:[],ads:[]};if(!byGoods.has(mode+'|'+g))byGoods.set(mode+'|'+g,[]);byGoods.get(mode+'|'+g).push(key);
  }
  rawCounts[n]=data.length;if(seen.size!==200)addWarn('名单数量',`${n}名单为${seen.size}个不同Goods，请核对本批名单。`);
 }
 if(!pools.size)throw Error('没有找到六份Top200名单，请导入包含“半托美国／欧洲／glo、全托美国／欧洲／glo”的底表。');
 function metadata(p,fields){for(const [k,v]of Object.entries(fields))if(v&&!p[k])p[k]=v;}
 function problem(p,module,sku,st,source,title,severity,extra={}){
  const key=issueKey(module,p.mode,module==='stock'?'共享':p.dep,p.goods,sku,st,source);
  if(!p.issues.some(x=>x.key===key))p.issues.push({key,productKey:p.key,module,sku,site:st,source,title,severity,dataDate:module==='ads'?p.ad?.date||date:date,...extra});
 }
 let duplicateLimits=0,outsideLimits=0;
 for(const [n,all]of Object.entries(sheets))if(n.includes('限流')){
  const mode=n.startsWith('半托')?'半托':'全托',dep=n.includes('美国')?'UDP':n.includes('欧洲')?'EU':'GLO',seen=new Set;
  for(let i=1;i<all.length;i++){
   const r=all[i];if(!valid(r))continue;const sig=JSON.stringify(r.slice(0,20));if(seen.has(sig)){duplicateLimits++;continue;}seen.add(sig);
   const p=pools.get(productKey(mode,dep,ident(r[0])));if(!p){outsideLimits++;continue;}
   const rec={goods:p.goods,skc:ident(r[1]),sku:ident(r[2]),shop:ident(r[3]),shopName:ident(r[4]),categoryId:ident(r[5]),category:ident(r[6]),reason:ident(r[7]),site:site(r[8]),spec:ident(r[9]),price:ident(r[10]),activityPrice:ident(r[11]),activityInfo:ident(r[12]),suggested:ident(r[13]),suggestedActivity:ident(r[14]),link:ident(r[15]),state:ident(r[16]),internalLink:ident(r[17]),stock:num(r[18]),suggestedStock:num(r[19]),source:n+'!'+(i+1)};
   const delta=(a,b)=>num(a)!=null&&num(b)!=null?num(a)-num(b):null;
   rec.priceDelta=delta(rec.price,rec.suggested);rec.activityDelta=delta(rec.activityPrice,rec.suggestedActivity);
   details[p.key].limits.push(rec);metadata(p,{shop:rec.shop,shopName:rec.shopName,categoryId:rec.categoryId,category:rec.category});
   problem(p,'limits',rec.sku,rec.site,'',rec.reason,rec.state.includes('屏蔽')?'高':'中',{reason:rec.reason,state:rec.state});
  }
 }
 const priceRows=rows('半托加价率').filter(r=>/^\d+$/.test(ident(r[1]))),priceGroups=new Map;
 for(let i=0;i<priceRows.length;i++){
  const r=priceRows[i],g=ident(r[1]),st=site(r[4]),source=ident(r[5]),possible=byGoods.get('半托|'+g)||[];if(!possible.length)continue;
  const rule=rules.get('半托|'+st),bySite=possible.filter(k=>pools.get(k).salesSites.includes(st));
  const dep=rule?.deployment||rule?.candidate;
  let chosen=bySite.length===1?bySite:possible.filter(k=>pools.get(k).dep===dep);
  if(chosen.length!==1){addWarn('价格部署区',`${g} ${st}无法唯一关联Top200池`);continue;}
  const key=chosen[0],p=pools.get(key);metadata(p,{sourceSeller:ident(r[8]),sourceSellerId:ident(r[9])});
  const pk=[key,ident(r[2]),st,source].join('|');
  if(!priceGroups.has(pk))priceGroups.set(pk,{goods:g,sku:ident(r[2]),skc:ident(r[3]),site:st,source,spec:ident(r[0]),pairs:new Map,links:[],productKey:key,basis:rule?.deployment?'业务数据确认':bySite.length===1?'Top200名单站点确认':'部署区参考待核',seller:ident(r[8]),sellerId:ident(r[9]),sourceRow:'半托加价率!'+(i+2)});
  const item=priceGroups.get(pk);item.pairs.set(JSON.stringify([r[6],r[7]]),[r[6],r[7]]);
  const link={state:ident(r[10]),followPrice:ident(r[11]),discountPrice:ident(r[12]),platform:ident(r[13]),goods:ident(r[14]),sku:ident(r[15]),url:ident(r[16])};
  if(!item.links.some(x=>JSON.stringify(x)===JSON.stringify(link)))item.links.push(link);
 }
 for(const r of priceGroups.values()){
  const p=pools.get(r.productKey),pair=[...r.pairs.values()][0];r.sellRaw=ident(pair[0]);r.supplyRaw=ident(pair[1]);r.sell=num(pair[0]);r.supply=num(pair[1]);r.conflict=r.pairs.size>1;
  r.markup=!r.conflict&&r.sell!=null&&r.supply>0?r.sell/r.supply-1:null;r.key=issueKey('price',p.mode,p.dep,p.goods,r.sku,r.site,r.source);delete r.pairs;
  details[p.key].prices.push(r);
  if(r.markup!=null&&r.markup<threshold)problem(p,'price',r.sku,r.site,r.source,'加价率低于阈值','中',{markup:r.markup,sell:r.sell,supply:r.supply});
  if(r.conflict||r.markup==null)p.warnings.push('价格数据待核');
 }
 const stocks=rows('全托三区top200售罄'),stockSeen=new Map;
 for(let i=0;i<stocks.length;i++){
  const r=stocks[i],g=ident(r[7]),sku=ident(r[6]);if(!/^\d+$/.test(g))continue;
  const rec={goods:g,sku,skc:ident(r[5]),spu:ident(r[4]),seller:ident(r[0]),sellerId:ident(r[1]),categoryId:ident(r[2]),loss:num(r[3]),sales:num(r[8]),days:num(r[9]),orders:uniq(ident(r[10]).split(/[\n,，]/).map(x=>x.trim()).filter(Boolean)),source:'全托三区top200售罄!'+(i+2),shared:true};
  const sk=g+'|'+sku;if(stockSeen.has(sk)){if(JSON.stringify(stockSeen.get(sk))!==JSON.stringify(rec))addWarn('售罄重复',`${g}/${sku}重复SKU记录，保留首条损失并提示核对`);continue;}stockSeen.set(sk,rec);
  for(const key of byGoods.get('全托|'+g)||[]){const p=pools.get(key);details[key].stock.push(rec);metadata(p,{categoryId:rec.categoryId,sourceSeller:rec.seller,sourceSellerId:rec.sellerId});problem(p,'stock',sku,'三区共享','','售罄','高',{loss:rec.loss,sourceDays:rec.days});}
 }
 const adDates={};
 for(const [n,all]of Object.entries(sheets))if(n.includes('广告月数据')){
  const dep=n.includes('美国')?'UDP':n.includes('欧洲')?'EU':'GLO';const aggregated=dep==='UDP'?'UDP合计':dep==='EU'?'EU合计':'GLOBAL合计';
  const allValid=all.slice(1).filter(r=>/^\d+$/.test(ident(r[4]))&&dateOf(r[0]));adDates[dep]=maxDate(allValid.map(r=>dateOf(r[0])));
  const byDay=groups(allValid,r=>[dateOf(r[0]),ident(r[4]),ident(r[16])].join('|'));
  for(const set of byDay.values()){
   const chosen=set.find(r=>ident(r[3])===aggregated);const usable=chosen?[chosen]:set.filter((r,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(r))===i);
   for(const r of usable){const p=pools.get(productKey('全托',dep,ident(r[4])));if(!p)continue;
    const rec={date:dateOf(r[0]),scope:ident(r[3]),goods:p.goods,shop:ident(r[16]),name:ident(r[5]),amount:num(r[19]),roas:num(r[20]),target:num(r[21]),budget:num(r[22]),budgetRaw:ident(r[22]),feeRatio:num(r[23]),orders:num(r[24]),label:ident(r[25]),attributed:num(r[27])};
    details[p.key].ads.push(rec);metadata(p,{shop:rec.shop,shopName:ident(r[17]),name:rec.name,categoryId:ident(r[14]),category:ident(r[15])});
   }
  }
 }
 for(const p of pools.values()){
  const d=details[p.key],category=ownCats.get(p.categoryId);if(category){p.owner=(p.mode==='半托'?category.half:category.full)||'待分配';p.category=p.category||category.category;p.leader=category.leader;}
  if(!p.shop&&p.sourceSellerId&&shopMap.has(p.dep+'|'+p.sourceSellerId))p.shop=p.sourceSellerId;
  const exact=shopMap.get(p.dep+'|'+p.shop),fallback=shopGlobal.get(p.shop);
  const candidate=exact?.size===1?[...exact.values()][0]:!exact&&fallback?.size===1?[...fallback.values()][0]:null;
  if(candidate){p.sellerId=candidate.sellerId;p.seller=candidate.seller;p.identity=exact?(candidate.status.includes('人工已确认')?'已核验':'来源关联待核'):'部署区待核';}
  else{p.seller=p.sourceSeller||p.shopName||'待匹配';p.sellerId='unmatched:'+p.dep+':'+(p.shop||p.sourceSellerId||p.goods);p.identity='未匹配';}
  p.priceCount=d.prices.length;p.lowCount=d.prices.filter(r=>r.markup!=null&&r.markup<threshold).length;p.minMarkup=d.prices.filter(r=>r.markup!=null).reduce((v,r)=>v==null?r.markup:Math.min(v,r.markup),null);
  p.limitSkus=uniq(d.limits.map(r=>r.sku)).length;p.limitSites=uniq(d.limits.map(r=>r.site)).length;p.blocked=uniq(d.limits.filter(r=>r.state.includes('屏蔽')).map(r=>r.sku+'|'+r.site)).length;
  p.stockSkus=d.stock.length;p.stockLoss=d.stock.reduce((s,r)=>s+(r.loss||0),0);p.stockDays=Math.max(0,...d.stock.map(r=>r.days||0));
  if(d.ads.length){const latest=adDates[p.dep],current=d.ads.filter(r=>r.date===latest),last=maxDate(d.ads.map(r=>r.date));const one=current.length===1?current[0]:null;
   const window=offset=>{const chosen=d.ads.filter(r=>{const gap=dayGap(latest,r.date);return gap>=offset&&gap<offset+7;});return{amount:chosen.reduce((a,r)=>a+(r.amount||0),0),orders:chosen.reduce((a,r)=>a+(r.orders||0),0),days:uniq(chosen.map(r=>r.date)).length};};
   p.ad={...(one||{}),date:latest,lastRecord:last,covered:current.length>0,week:window(0),previousWeek:window(7)};
   if(one&&one.roas!=null&&one.target>0&&one.roas<one.target)problem(p,'ads','','区域汇总','','ROAS低于目标','中',{roas:one.roas,target:one.target});
  }
  p.warnings=uniq(p.warnings);if(p.identity!=='已核验')p.warnings.push('卖家映射'+p.identity);if(p.owner==='待分配')p.warnings.push('负责人待分配');
  p.issues.sort((a,b)=>(a.severity==='高'?0:1)-(b.severity==='高'?0:1));
 }
 if(duplicateLimits)addWarn('重复记录',`限流完全重复记录${duplicateLimits}条已去重；不同原因和竞品链接仍分别保留。`);
 if(outsideLimits)addWarn('名单外记录',`${outsideLimits}条限流明细不在对应Top200池，未纳入池内统计。`);
 const result={schemaVersion:1,date,threshold,complete,rows:[...pools.values()],details,warnings:uniq(warnings.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)),adDates,sourceName:opts.sourceName||'大组日常.xlsx',sourceHash:opts.sourceHash||'',importedAt:new Date().toISOString(),rawCounts,siteRules,priceValues:{}};
 for(const r of priceGroups.values())result.priceValues[r.key]={sell:r.sell,supply:r.supply,markup:r.markup,source:r.source};
 return result;
}

export function compareSnapshot(pack,previous){
 const before=previous?.issueIndex||Object.fromEntries([...(previous?.rows||[]).flatMap(r=>r.issues||[]),...(previous?.unverified||[])].map(r=>[r.key,r])),index={},priceBefore=previous?.priceValues||{},sameDay=previous?.date===pack.date,ruleChanged=previous&&previous.threshold!==pack.threshold;
 for(const p of pack.rows){
  const old=previous?.rows?.find(r=>r.key===p.key);p.newCount=0;p.expanded=false;
  for(const issue of p.issues){const prior=before[issue.key],gap=prior?dayGap(issue.dataDate,prior.dataDate):null;
   issue.firstSeen=prior?.firstSeen||pack.date;issue.observations=prior?(gap>0?prior.observations+1:prior.observations):1;
   issue.continuous=prior&&gap===1?(prior.continuous||1)+1:prior&&gap===0?prior.continuous||1:1;
   issue.change=!previous?'首次发现':ruleChanged&&issue.module==='price'?'规则变更':prior&&prior.state!=='恢复'?'持续':sameDay?'本日发现':'新增';issue.state='存在';
   if(issue.change==='新增')p.newCount++;index[issue.key]=issue;
  }
  for(const r of pack.details[p.key].prices){const previousPrice=priceBefore[r.key];if(previousPrice){r.sellDelta=r.sell!=null&&previousPrice.sell!=null?r.sell-previousPrice.sell:null;r.supplyDelta=r.supply!=null&&previousPrice.supply!=null?r.supply-previousPrice.supply:null;r.markupDelta=r.markup!=null&&previousPrice.markup!=null?r.markup-previousPrice.markup:null;}}
  p.expanded=!!old&&(p.limitSkus>old.limitSkus||p.limitSites>old.limitSites||p.stockSkus>old.stockSkus);p.change=!previous?'基准日':p.newCount?'新增问题':p.expanded?'问题扩大':p.issues.length?'持续问题':'无已检出问题';
 }
 const recovered=[],unverified=[];
 for(const [key,prior]of Object.entries(before))if(!index[key]&&prior.state!=='恢复'){
  const stillInPool=pack.rows.some(p=>p.key===prior.productKey),price=pack.priceValues[key];
  const ad=pack.rows.find(p=>p.key===prior.productKey)?.ad;
  const knownNormal=prior.module==='price'?price?.markup!=null&&price.markup>=pack.threshold:prior.module==='limits'?pack.complete.limits:prior.module==='stock'?pack.complete.stock:prior.module==='ads'?ad?.covered&&ad?.roas!=null&&ad?.target>0&&ad.roas>=ad.target:false;
  const state=!stillInPool?'退出监控':knownNormal?'恢复':'待核实';const item={...prior,state,lastObserved:pack.date};index[key]=item;if(state==='恢复')recovered.push(item);else if(state==='待核实')unverified.push(item);
 }
 pack.issueIndex=index;pack.recovered=recovered;pack.unverified=unverified;
 const uniqueStocks=new Map;for(const d of Object.values(pack.details))for(const r of d.stock)uniqueStocks.set(r.goods+'|'+r.sku,r);
 pack.stats={pool:pack.rows.length,goods:uniq(pack.rows.map(r=>r.goods)).length,priceGoods:pack.rows.filter(r=>r.priceCount>0).length,lowGoods:pack.rows.filter(r=>r.lowCount>0).length,limitGoods:pack.rows.filter(r=>r.limitSkus>0).length,stockGoods:uniq([...uniqueStocks.values()].map(r=>r.goods)).length,stockLoss:[...uniqueStocks.values()].reduce((n,r)=>n+(r.loss||0),0),adsGoods:pack.rows.filter(r=>r.ad?.covered).length,adsAlerts:pack.rows.filter(r=>r.issues.some(x=>x.module==='ads')).length,newGoods:pack.rows.filter(r=>r.newCount>0).length,recovered:uniq(recovered.map(r=>r.key)).length,unverified:unverified.length,unmatched:pack.rows.filter(r=>r.identity!=='已核验').length,unassigned:pack.rows.filter(r=>r.owner==='待分配').length};
 pack.fingerprint=hashText(JSON.stringify([pack.date,pack.sourceHash,pack.threshold,pack.complete,pack.rows.map(r=>[r.key,r.issues.map(x=>x.key)])]));return pack;
}

export function summarize(pack){const {details,siteRules,priceValues,issueIndex,...rest}=pack;return rest;}
