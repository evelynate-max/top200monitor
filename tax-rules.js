import {BRUSH_CONFIG} from './brush-config.js?v=identity-pet-tab-20261103-1';
export const TAX_VERSION='highest-quote-tax-20261103-1';
const clean=v=>String(v||'').trim().replace(/站$/,'').replace('·新','');
export function resolveTax(context={}){
 const name=clean(context.site),mode=['半托','半托管'].includes(context.mode)?'半托管':['本本','本对本'].includes(context.mode)?'本对本':context.mode;
 const pending=reason=>({taxRate:null,taxPercent:null,taxState:'待核',taxBasis:reason,taxVersion:TAX_VERSION});
 if(context.manualTaxConfirmed){const value=Number(context.manualTaxPercent);if(!Number.isFinite(value)||value<0||value>100)return pending('手动税率须为0至100的百分数');return{taxRate:value/100,taxPercent:value,taxState:'本次手动确认',taxBasis:'本次已核对的站点、模式适用税率',taxVersion:TAX_VERSION};}
 const rule=BRUSH_CONFIG.sites[name];if(!rule)return pending('用户资料未提供本站点核价税率');
 if(!['半托管','本对本'].includes(mode))return pending('用户核价资料未提供该经营模式的税率口径');
 if(/税率/.test(rule.conflict||''))return pending(rule.conflict);
 if(rule.mode_conflicts?.[mode])return pending(rule.mode_conflicts[mode]);
 const percent=['日本','澳大利亚'].includes(name)&&mode==='半托管'?0:Number(rule.mode_vat?.[mode]??rule.vat);
 if(!Number.isFinite(percent)||percent<0||percent>100)return pending('税率参数无效');
 return{taxRate:percent/100,taxPercent:percent,taxState:'已匹配',taxBasis:`${rule.tax_selection?.basis||'用户核价SOP与折扣表'}／${name}／${mode}；采用业务核价税率`,taxVersion:TAX_VERSION};
}
