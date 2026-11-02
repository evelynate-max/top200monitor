// Dashboard bands are independent of the brush calculator's pricing target.
export const PRICE_POLICY='markup-bands-20261103';
export const LOW_MARKUP=.15;
export const HIGH_MARKUP=.30;
const fraction=v=>{const m=String(v).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);if(!m)throw Error('无效金额');const p=(m[3]?.length||0)-Number(m[4]||0),n=BigInt((m[1]||'')+m[2]+(m[3]||''));return p>=0?[n,10n**BigInt(p)]:[n*10n**BigInt(-p),1n];};
export function atLeast(price,threshold){if(price?.markup==null)return false;try{if(!(price.supply>0)||!(price.sell>=0))return price.markup>=threshold;const [sn,sd]=fraction(price.sell),[cn,cd]=fraction(price.supply),[tn,td]=fraction(threshold);return sn*cd*td>=cn*(td+tn)*sd;}catch{return price.markup>=threshold;}}
export function markupBand(price){return price?.markup==null?'unknown':atLeast(price,HIGH_MARKUP)?'high':atLeast(price,LOW_MARKUP)?'medium':'low';}
export const bandLabel=band=>({low:'低加价率',medium:'中加价率',high:'高加价率',unknown:'价格待核'}[band]||'价格待核');
export function summarizePrices(row,prices){const valid=prices.filter(p=>p.markup!=null);row.priceCount=prices.length;row.lowCount=prices.filter(p=>markupBand(p)==='low').length;row.mediumCount=prices.filter(p=>markupBand(p)==='medium').length;row.highCount=prices.filter(p=>markupBand(p)==='high').length;row.abnormalCount=row.mediumCount+row.highCount;row.minMarkup=valid.length?Math.min(...valid.map(p=>p.markup)):null;row.maxMarkup=valid.length?Math.max(...valid.map(p=>p.markup)):null;row.markupBand=row.highCount?'high':row.mediumCount?'medium':row.lowCount?'low':'unknown';row.priceBands=[row.lowCount,row.mediumCount,row.highCount,prices.length-valid.length];return row;}
