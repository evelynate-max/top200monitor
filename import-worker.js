importScripts('xlsx.full.min.js');
self.onmessage=async event=>{
 try{
  const {buffer,options,siteRules,previous}=event.data;
  self.postMessage({progress:'正在读取Excel工作表…'});
  const book=XLSX.read(buffer,{type:'array',dense:true,cellDates:false,cellFormula:false,cellStyles:false});const sheets={};
  for(const name of book.SheetNames){const ws=book.Sheets[name];if(!ws['!ref'])continue;const range=XLSX.utils.decode_range(ws['!ref']);if(name==='店铺映射')range.e.c=Math.min(range.e.c,9);sheets[name]=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true,range});if(name.includes('广告月数据'))for(const row of sheets[name].slice(1))if(typeof row[0]==='number'){const d=XLSX.SSF.parse_date_code(row[0],{date1904:!!book.Workbook?.WBProps?.date1904});if(d)row[0]=String(d.y)+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');}}
  self.postMessage({progress:'正在关联Top200、卖家与负责人，计算监控结果…'});
  const {normalizeWorkbook,compareSnapshot}=await import('./model.js?v=20261030-3');
  const pack=compareSnapshot(normalizeWorkbook(sheets,siteRules,options),previous||null);
  self.postMessage({pack});
 }catch(error){self.postMessage({error:error.message||String(error)});}
};
