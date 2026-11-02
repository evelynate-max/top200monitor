import {resolveTax} from './tax-rules.js?v=highest-quote-tax-20261103-1';
export const PRICE_POLICY='additive-tax-markup-20261103+highest-quote-tax-20261103-1';
export const LOW_MARKUP=.15,HIGH_MARKUP=.30;
export const MARKUP_FORMULA='售价÷供价−1−适用税率';
const fraction=v=>{const m=String(v).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);if(!m)throw Error('无效金额');const p=(m[3]?.length||0)-Number(m[4]||0),n=BigInt((m[1]||'')+m[2]+(m[3]||''));return p>=0?[n,10n**BigInt(p)]:[n*10n**BigInt(-p),1n];};
export function applyPricePolicy(price,context={}){
 Object.assign(price,resolveTax({...context,site:price.site||context.site}));
 const valid=Number.isFinite(price.sell)&&price.sell>0&&Number.isFinite(price.supply)&&price.supply>0&&!price.currencyConflict&&!price.conflict;
 price.rawMarkup=valid?price.sell/price.supply-1:null;
 price.markup=valid&&price.taxRate!=null?price.rawMarkup-price.taxRate:null;
 price.markupFormula=MARKUP_FORMULA;price.band=markupBand(price);price.abnormal=['medium','high'].includes(price.band);return price;
}
export function atLeast(price,threshold){if(price?.markup==null)return false;try{const [sn,sd]=fraction(price.sell),[cn,cd]=fraction(price.supply),[tn,td]=fraction(threshold),[vn,vd]=fraction(price.taxRate??0);return sn*cd*td*vd>=cn*sd*(td*vd+tn*vd+vn*td);}catch{return price.markup>=threshold;}}
export function markupBand(price){return price?.markup==null?'unknown':atLeast(price,HIGH_MARKUP)?'high':atLeast(price,LOW_MARKUP)?'medium':'low';}
export const bandLabel=band=>({low:'低加价率',medium:'中加价率',high:'高加价率',unknown:'税率／价格待核'}[band]||'税率／价格待核');
export function summarizePrices(row,prices){const valid=prices.filter(p=>p.markup!=null);row.priceCount=prices.length;row.lowCount=prices.filter(p=>markupBand(p)==='low').length;row.mediumCount=prices.filter(p=>markupBand(p)==='medium').length;row.highCount=prices.filter(p=>markupBand(p)==='high').length;row.priceUnknown=prices.length-valid.length;row.abnormalCount=row.mediumCount+row.highCount;row.minMarkup=valid.length?Math.min(...valid.map(p=>p.markup)):null;row.maxMarkup=valid.length?Math.max(...valid.map(p=>p.markup)):null;row.markupBand=row.highCount?'high':row.priceUnknown?'unknown':row.mediumCount?'medium':row.lowCount?'low':'unknown';row.priceBands=[row.lowCount,row.mediumCount,row.highCount,row.priceUnknown];return row;}
