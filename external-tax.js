// Shared by Top200, the seller workbench, and the native quotation engine.
export const EXTERNAL_TAX_VERSION='brush-link-tax-20261105-1';
const aliases={shein:'SHEIN',aliexpress:'速卖通',tiktok:'TK','tiktok shop':'TK',amazon:'Amazon',ebay:'eBay',wayfair:'Wayfair',walmart:'Walmart'};
export const taxPlatform=v=>aliases[String(v||'').toLowerCase()]||String(v||'');
const EU='https://europa.eu/youreurope/business/finance-and-tax/vat/vat-rules-rates/index_en.htm';
const DISPLAY='https://taxation-customs.ec.europa.eu/system/files/2021-02/e-commerce-uk-factsheet_en.pdf';
const AMAZON='https://m.media-amazon.com/images/G/01/rainier/help/Update_European_VAT_Calculation_Services_Methodology.pdf';
const EBAY='https://www.ebay.com/help/buying/paying-items/paying-tax-ebay-purchases.html?id=4771';
const SHOPIFY='https://help.shopify.com/en/manual/taxes/include-exclude-taxes';
const rates={'奥地利':20,'比利时':21,'保加利亚':20,'克罗地亚':25,'塞浦路斯':19,'捷克':21,'丹麦':25,'爱沙尼亚':24,'芬兰':25.5,'法国':20,'德国':19,'希腊':24,'匈牙利':27,'爱尔兰':23,'意大利':22,'拉脱维亚':21,'立陶宛':21,'卢森堡':17,'马耳他':18,'荷兰':21,'波兰':23,'葡萄牙':23,'罗马尼亚':21,'斯洛伐克':23,'斯洛文尼亚':22,'西班牙':21,'瑞典':25};
const regional={
 '英国':{rate:20,sources:['https://www.gov.uk/vat-rates','https://www.gov.uk/tax-on-shopping/vat-duties']},
 '澳大利亚':{rate:10,sources:['https://moneysmart.gov.au/work-and-tax/gst-calculator','https://www.accc.gov.au/consumers/pricing/price-displays']},
 '日本':{rate:10,sources:['https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6303.htm','https://www.mof.go.jp/tax_policy/summary/consumption/a_001.htm']},
 '新西兰':{rate:15,sources:['https://www.ird.govt.nz/gst/charging-gst']}
};
export function externalTaxPreset(site,platform){
 const name=String(site||'').replace(/站$/,'').replace('·新',''),p=taxPlatform(platform),region=name in rates?{rate:rates[name],sources:[EU,DISPLAY]}:regional[name];
 const local={法国:['cdiscount'],德国:['Otto'],波兰:['Allegro'],捷克:['Alza','Allegro'],匈牙利:['Allegro'],日本:['Rakuten']};
 const consumer=['Amazon','SHEIN','Wayfair','TK'].includes(p)||local[name]?.includes(p);
 // eBay/import marketplace back-end fields can be net or gross for the same destination.
 const mode=region&&consumer?'included':'';
 return {mode,rate:region?.rate??null,sources:[...(region?.sources||[]),...(p==='Amazon'?[AMAZON]:p==='eBay'?[EBAY]:p==='速卖通'||!consumer?[SHOPIFY]:[])],
 note:mode?'按本站点面向消费者的含税价格参考；后台若另加税，请选择“未税填价，结账加税”。':'该平台填价方式随卖家及发货地变化，请按链接后台选择含税或未税。',
 rate_note:region?'标准税率参考；商品适用低税率时请按实际覆盖。':'请填写此链接结账实际适用税率，不沿用业务核价税率猜测。'};
}
class Money{
 constructor(n,d=1n){if(n instanceof Money){this.n=n.n;this.d=n.d;return;}if(typeof n==='bigint'){this.n=n;this.d=d;return;}const s=String(n),a=s.split('.');if(!/^\d+(\.\d+)?$/.test(s))throw Error('税费和运费须为有效非负数');this.n=BigInt(a.join(''));this.d=10n**BigInt(a[1]?.length||0);}
 add(v){v=new Money(v);return new Money(this.n*v.d+v.n*this.d,this.d*v.d);}
 sub(v){v=new Money(v);return new Money(this.n*v.d-v.n*this.d,this.d*v.d);}
 mul(v){v=new Money(v);return new Money(this.n*v.n,this.d*v.d);}
 div(v){v=new Money(v);if(!v.n)throw Error('除数须大于0');return new Money(this.n*v.d,this.d*v.n);}
 cmp(v){v=new Money(v);const n=this.n*v.d-v.n*this.d;return n>0n?1:n<0n?-1:0;}
 ceil(d){const s=10n**BigInt(d);return new Money((this.n*s+this.d-1n)/this.d,s);}
 round(d){const s=10n**BigInt(d);return new Money((this.n*s*2n+this.d)/(this.d*2n),s);}
 text(d){const v=this.ceil(d),s=String(v.n).padStart(d+1,'0');return d?s.slice(0,-d)+'.'+s.slice(-d):s;}
 number(){return Number(this.n)/Number(this.d);}
}
const M=v=>new Money(v),present=v=>v!==''&&v!==undefined&&v!==null;
const percent=(v,label)=>{const n=M(v);if(n.cmp(100)>0)throw Error(label+'须为0至100');return n.div(100);};
export function applyExternalTax(q,p={}){
 if(!q?.valid)return q;
 const digits=Number(q.digits??2),goal=M(q.suggested_text??q.suggested),shipping=M(p.shipping_local??q.shipping??p.shipping??0).ceil(digits),preset=externalTaxPreset(q.site||p.site,q.platform||p.platform);
 if(!Number.isFinite(Number(q.vat)))throw Error('缺少已确认的SOP税率');
 const common={external_tax_version:EXTERNAL_TAX_VERSION,external_tax_sources:preset.sources,external_quote_target:goal.text(digits)};
 // User-confirmed business rule: SOP-zero destinations skip external tax labels/calculation.
 if(Number(q.vat)===0){const item=goal.sub(shipping).ceil(digits);if(item.cmp(0)<=0)throw Error('运费须低于建议到手价');return {...q,...common,external_tax_applicable:false,external_tax_mode:'sop-zero',external_ready:true,link_item_text:item.text(digits),link_shipping_text:shipping.text(digits),final_total_text:item.add(shipping).text(digits),final_total:item.add(shipping).number(),checkout_tax_text:null,external_tax_rate:null,external_tax_note:'按已确认SOP的0税业务口径，跳过税额及含税标记。',item_price:item.number(),item_price_text:item.text(digits),shipping:shipping.number()};}
 const mode=p.external_tax_mode&&p.external_tax_mode!=='auto'?p.external_tax_mode:preset.mode;
 const rawRate=present(p.external_tax_rate)?p.external_tax_rate:preset.rate;
 const pending=reason=>({...q,...common,usable:false,external_tax_applicable:true,external_tax_mode:mode||'',external_ready:false,external_tax_rate:rawRate,link_item_text:null,link_shipping_text:shipping.text(digits),final_total_text:null,checkout_tax_text:null,external_tax_note:reason});
 if(!['included','excluded'].includes(mode))return pending(preset.note);
 if(!present(rawRate))return pending(preset.rate_note);
 const tax=percent(rawRate,'站外税率'),shipTax=p.external_shipping_tax==='zero'?M(0):p.external_shipping_tax==='custom'?percent(p.external_shipping_tax_rate,'运费税率'):tax;
 let item,total,added=M(0),included=M(0);
 if(mode==='included'){
  item=goal.sub(shipping).ceil(digits);if(item.cmp(0)<=0)throw Error('运费须低于建议含税到手价');total=item.add(shipping);
  included=item.sub(item.div(M(1).add(tax))).round(digits).add(shipping.sub(shipping.div(M(1).add(shipTax))).round(digits));
 }else{
  const shipGross=shipping.add(shipping.mul(shipTax).round(digits));
  if(shipGross.cmp(goal)>=0)throw Error('运费及运费税须低于建议含税到手价');
  item=goal.sub(shipGross).div(M(1).add(tax)).ceil(digits);
  const sum=()=>{added=item.mul(tax).round(digits).add(shipping.mul(shipTax).round(digits));return item.add(shipping).add(added);};
  total=sum();if(total.cmp(goal)<0){item=item.add(new Money(1n,10n**BigInt(digits)));total=sum();}
 }
 if(item.cmp(0)<=0)throw Error('链接商品价须大于0');
 return {...q,...common,external_tax_applicable:true,external_tax_mode:mode,external_tax_rate:tax.mul(100).number(),external_shipping_tax_rate:shipTax.mul(100).number(),external_ready:true,
  link_item_text:item.text(digits),link_shipping_text:shipping.text(digits),final_total_text:total.text(digits),final_total:total.number(),checkout_tax_text:added.text(digits),included_tax_text:mode==='included'?included.text(digits):null,
  external_tax_note:mode==='included'?'链接商品价和运费已含税，结账不再重复加税。':'链接按未税价填写；最终总额已计入商品税和运费税。',
  external_tax_basis:present(p.external_tax_rate)?'本次填写':preset.rate_note,item_price:item.number(),item_price_text:item.text(digits),shipping:shipping.number()};
}
export function externalQuoteLines(q){
 if(!q?.valid)return q?.reason||'价格待核';
 if(!q.external_tax_version)return '历史报价，含税方式未记录；请重新计算后建链。';
 const cur=q.currency;
 if(!q.external_ready)return '链接价格待核：'+q.external_tax_note;
 return '链接商品价 '+q.link_item_text+' '+cur+'；运费 '+q.link_shipping_text+' '+cur+'；'+(q.external_tax_applicable?'最终含税到手价 ':'到手价 ')+q.final_total_text+' '+cur+(q.external_tax_applicable?'（'+(q.external_tax_mode==='included'?'链接填含税价，不重复加税':'链接填未税价，结账加税 '+q.checkout_tax_text+' '+cur)+'）':'');
}
export function actualLinkTotal(q,item,shipping,digitsOverride){
 if(!q?.external_ready)return {ready:false,total_text:null,tax_text:null};
 const digits=Number(digitsOverride??q.digits??2),i=M(item),s=M(shipping);let tax=M(0);
 if(q.external_tax_applicable&&q.external_tax_mode==='excluded')tax=i.mul(M(q.external_tax_rate).div(100)).round(digits).add(s.mul(M(q.external_shipping_tax_rate).div(100)).round(digits));
 return {ready:true,total_text:i.add(s).add(tax).text(digits),tax_text:tax.text(digits)};
}
