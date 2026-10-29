importScripts('xlsx.full.min.js');
self.onmessage=async event=>{
 try{
  const {buffer,options,siteRules,previous}=event.data;
  self.postMessage({progress:'正在读取Excel工作表…'});
  const book=XLSX.read(buffer,{type:'array',dense:true,cellDates:true,cellFormula:false,cellStyles:false});const sheets={};
  for(const name of book.SheetNames){const ws=book.Sheets[name];if(!ws['!ref'])continue;const range=XLSX.utils.decode_range(ws['!ref']);if(name==='店铺映射')range.e.c=Math.min(range.e.c,9);sheets[name]=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true,range});}
  self.postMessage({progress:'正在关联Top200、卖家与负责人，计算监控结果…'});
  const {normalizeWorkbook,compareSnapshot}=await import('./model.js');
  const pack=compareSnapshot(normalizeWorkbook(sheets,siteRules,options),previous||null);
  self.postMessage({pack});
 }catch(error){self.postMessage({error:error.message||String(error)});}
};
