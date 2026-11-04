const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function searchableFilter(field,label,options,value,config={}){
 const selected=options.find(x=>String(x.value)===String(value))||options[0],target=config.targetId;
 const searchable=config.searchable??options.length>=8,disabled=config.disabled||!options.length;
 const placeholder=config.placeholder||(field==='category'?'输入类目名称或ID':field==='owner'?'输入对接人姓名':'输入关键词搜索');
 return `<details class="filter-picker ${e(config.className||'')}" data-picker="${e(field)}" ${disabled?'data-disabled="true"':''} ${config.title?`title="${e(config.title)}"`:''}><summary role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="picker-options-${e(field)}" aria-label="${e(config.ariaLabel||label+'筛选')}" ${disabled?'aria-disabled="true" tabindex="-1"':''}><span class="picker-label">${e(selected?.label||config.emptyLabel||'请选择')}</span><span class="picker-chevron" aria-hidden="true">⌄</span></summary>${target?`<input type="hidden" id="${e(target)}" value="${e(value)}" ${disabled?'disabled':''}>`:''}<div class="picker-menu">${searchable?`<input type="search" data-filter-search="${e(field)}" aria-label="搜索${e(label)}" placeholder="${e(placeholder)}" autocomplete="off" spellcheck="false">`:''}<div role="listbox" id="picker-options-${e(field)}" aria-label="${e(label)}选项">${options.map(x=>`<button type="button" role="option" aria-selected="${String(x.value)===String(value)}" ${target?`data-picker-target="${e(target)}"`:`data-filter-field="${e(field)}"`} data-filter-value="${e(x.value)}" data-filter-text="${e((x.value+' '+x.label).toLowerCase())}"><span>${e(x.label)}</span><span class="picker-check" aria-hidden="true">✓</span></button>`).join('')}</div><p class="picker-empty" hidden>没有匹配选项</p></div></details>`;
}
function positionPicker(picker){
 if(!picker.open)return;
 const anchor=picker.querySelector('summary').getBoundingClientRect(),menu=picker.querySelector('.picker-menu'),vw=document.documentElement.clientWidth,vh=window.innerHeight;
 if(anchor.bottom<0||anchor.top>vh){picker.open=false;return;}
 const width=Math.min(Math.max(anchor.width,picker.querySelector('[data-filter-search]')?280:0),vw-24),below=vh-anchor.bottom-12,above=anchor.top-12,up=below<220&&above>below;
 menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(anchor.left,vw-width-12))+'px';menu.style.maxHeight=Math.max(80,Math.min(360,up?above:below))+'px';
 menu.style.top=(up?Math.max(8,anchor.top-menu.getBoundingClientRect().height-6):anchor.bottom+6)+'px';
}
function visibleOptions(picker){return [...picker.querySelectorAll('[data-filter-value]')].filter(o=>!o.hidden);}
function focusOption(option){option?.focus({preventScroll:true});const list=option?.parentElement;if(!list)return;const r=option.getBoundingClientRect(),b=list.getBoundingClientRect();if(r.bottom>b.bottom)list.scrollTop+=r.bottom-b.bottom;else if(r.top<b.top)list.scrollTop-=b.top-r.top;}
function filterOptions(input){const picker=input.closest('.filter-picker'),query=input.value.trim().toLowerCase();let count=0;for(const option of picker.querySelectorAll('[data-filter-value]')){option.hidden=!option.dataset.filterText.includes(query);if(!option.hidden)count++;}picker.querySelector('.picker-empty').hidden=count>0;positionPicker(picker);}
document.addEventListener('input',event=>{if(event.target.dataset?.filterSearch&&!event.isComposing)filterOptions(event.target);});
document.addEventListener('compositionend',event=>{if(event.target.dataset?.filterSearch)filterOptions(event.target);});
document.addEventListener('toggle',event=>{const picker=event.target;if(!picker.matches?.('.filter-picker'))return;picker.querySelector('summary').setAttribute('aria-expanded',String(picker.open));if(!picker.open)return;if(picker.dataset.disabled==='true'){picker.open=false;return;}for(const other of document.querySelectorAll('.filter-picker[open]'))if(other!==picker)other.open=false;positionPicker(picker);const search=picker.querySelector('[data-filter-search]');if(search)search.focus({preventScroll:true});else focusOption(picker.querySelector('[aria-selected="true"]')||visibleOptions(picker)[0]);},true);
document.addEventListener('click',event=>{
 const disabled=event.target.closest?.('.filter-picker[data-disabled="true"]');if(disabled){event.preventDefault();return;}
 const button=event.target.closest?.('[data-picker-target]');if(button){const input=document.getElementById(button.dataset.pickerTarget);if(!input||input.disabled)return;const picker=input.closest('.filter-picker');input.value=button.dataset.filterValue;picker.querySelector('.picker-label').textContent=button.querySelector('span').textContent;for(const option of picker.querySelectorAll('[data-filter-value]'))option.setAttribute('aria-selected',String(option===button));picker.open=false;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById(button.dataset.pickerTarget)?.closest('.filter-picker').querySelector('summary').focus({preventScroll:true});}
 for(const picker of document.querySelectorAll('.filter-picker[open]'))if(!picker.contains(event.target))picker.open=false;
});
document.addEventListener('keydown',event=>{
 const picker=event.target.closest?.('.filter-picker');if(!picker||event.isComposing||event.keyCode===229)return;
 if(picker.dataset.disabled==='true'){if(event.key!=='Tab')event.preventDefault();return;}
 const searching=event.target.matches('[data-filter-search]'),options=visibleOptions(picker),index=options.indexOf(event.target);
 if(event.key==='Escape'){picker.open=false;picker.querySelector('summary').focus({preventScroll:true});event.preventDefault();return;}
 if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&!(searching&&['Home','End'].includes(event.key))){if(!picker.open){picker.open=true;event.preventDefault();return;}const i=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?Math.min(index+1,options.length-1):index<0?options.length-1:Math.max(index-1,0);focusOption(options[i]);event.preventDefault();}
 if(event.key==='Enter'&&searching){options[0]?.click();event.preventDefault();}
});
window.addEventListener('resize',()=>{for(const picker of document.querySelectorAll('.filter-picker[open]'))positionPicker(picker);});
window.addEventListener('scroll',()=>{for(const picker of document.querySelectorAll('.filter-picker[open]'))positionPicker(picker);},true);
