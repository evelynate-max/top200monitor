export const IDENTITY_VERSION='source-identity-20261103-1';
const text=v=>String(v??'').trim();
const numeric=v=>/^\d+$/.test(text(v));
const usable=v=>text(v)&&!['待匹配','待关联','待分配'].includes(text(v));
const groupKey=r=>r.mode+'|'+r.goods;
export function identityReady(row){
 if(typeof row.identityReady==='boolean')return row.identityReady;
 return !row.identityConflict&&(numeric(row.shop)||(numeric(row.sourceSellerId)&&usable(row.sourceSeller)));
}
// A source shop ID is sufficient for monitoring. A unified merchant mapping is separate metadata.
// Source seller IDs remain source seller IDs; never manufacture a shop ID from an unverified alias.
export function applyIdentityPolicy(pack){
 const shops=new Map,globalNames=new Map;
 const add=(r,id,name)=>{id=text(id);if(!numeric(id))return;const key=groupKey(r);if(!shops.has(key))shops.set(key,new Map);const candidates=shops.get(key);if(!candidates.has(id))candidates.set(id,new Set);if(usable(name))candidates.get(id).add(text(name));if(!globalNames.has(id))globalNames.set(id,new Set);if(usable(name))globalNames.get(id).add(text(name));};
 for(const r of pack.rows||[]){
  if(r.priorOnly)continue;
  add(r,r.shop,r.shopName);
  const detail=pack.details?.[r.key];
  for(const rec of [...(detail?.limits||[]),...(detail?.ads||[])])add(r,rec.shop,rec.shopName);
 }
 for(const r of pack.rows||[]){
  const candidates=shops.get(groupKey(r)),ids=[...(candidates?.keys()||[])];
  r.identityConflict=ids.length>1;r.identityCandidates=ids;
  if(!numeric(r.shop)&&ids.length===1){r.shop=ids[0];r.shopIdentityBasis='同经营模式、同Goods的业务明细店铺ID';}
  // A source ID can also be a shop ID, but only promote it when an explicit shop column confirms it.
  if(!numeric(r.shop)&&numeric(r.sourceSellerId)&&globalNames.has(text(r.sourceSellerId))){r.shop=text(r.sourceSellerId);r.shopIdentityBasis='来源ID命中业务明细的店铺ID';}
  if(numeric(r.shop)&&!usable(r.shopName)){
   const names=globalNames.get(text(r.shop));
   if(names?.size===1)r.shopName=[...names][0];
   else if(text(r.shop)===text(r.sourceSellerId)&&usable(r.sourceSeller))r.shopName=text(r.sourceSeller);
  }
  const hasShop=numeric(r.shop),hasSource=numeric(r.sourceSellerId)&&usable(r.sourceSeller);
  r.identityReady=!r.identityConflict&&(hasShop||hasSource);
  r.identityKind=hasShop?'店铺ID':'来源卖家ID';r.identityId=hasShop?text(r.shop):text(r.sourceSellerId);
  r.identityName=text(hasShop?r.shopName:r.sourceSeller);
  r.identityStatus=r.identityConflict?'店铺ID冲突':hasShop?'店铺已识别':hasSource?'来源已识别':'身份信息待补';
  if(!hasShop&&hasSource)r.shopIdentityBasis=r.stockSkus?'售罄源表：卖家／卖家ID':r.priceCount?'加价率源表：卖家名称／卖家ID':'业务源表：卖家／卖家ID';
  r.warnings=(r.warnings||[]).filter(w=>!String(w).startsWith('卖家映射')&&!['身份信息待补','店铺ID冲突'].includes(w));
  if(!r.identityReady)r.warnings.push(r.identityStatus);
  for(const p of pack.details?.[r.key]?.prices||[])Object.assign(p,{shop:r.shop,shopName:r.shopName});
 }
 const grouped=new Map;for(const r of pack.rows||[]){if(!grouped.has(r.goods))grouped.set(r.goods,[]);grouped.get(r.goods).push(r);}
 const all=[...grouped.values()],pending=all.filter(rs=>rs.some(r=>!r.identityReady));
 pack.identityVersion=IDENTITY_VERSION;
 pack.identityAudit={version:IDENTITY_VERSION,goods:all.length,identifiedGoods:all.length-pending.length,pendingGoods:pending.length,conflictGoods:all.filter(rs=>rs.some(r=>r.identityConflict)).length,missingGoods:all.filter(rs=>rs.some(r=>!r.identityReady&&!r.identityConflict)).length,sourceOnlyGoods:all.filter(rs=>rs.every(r=>!r.shop)&&rs.every(r=>r.identityReady)).length};
 if(pack.stats)pack.stats.unmatched=pending.length;
 return pack;
}
