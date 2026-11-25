/* Shared phone controls for static forms and dynamically opened dialogs. */
(()=>{'use strict';
const root=new URL('.',document.currentScript.src),controls=new Set(),handled=new WeakSet();let countries=[{code:'SZ',name:'Eswatini',dial:'+268'}];
const valid=c=>/^\+\d{1,6}$/.test(c.dial||'');
function options(select){const previous=select.value;select.replaceChildren(...countries.filter(valid).map(c=>{const o=new Option(c.name+' '+c.dial,c.dial);o.dataset.country=c.code;return o}));select.value=[...select.options].some(o=>o.value===previous)?previous:'+268';}
function first(select){const top=[...select.options].find(o=>/Eswatini/i.test(o.textContent));if(top&&select.firstElementChild!==top){const value=select.value;select.prepend(top);select.value=value;}}
function enhance(input){if(handled.has(input)||input.type!=='tel')return;handled.add(input);
 const existing=input.parentElement.querySelector('select[name="dial"],select[data-phone-dial]');
 if(existing){input.parentElement.classList.add('sieg-phone-group');existing.dataset.phoneDial='';first(existing);controls.add({dial:existing});return;}
 const group=document.createElement('div');group.className='sieg-phone-group';const dial=document.createElement('select');dial.dataset.phoneDial='';dial.setAttribute('aria-label','Country calling code');options(dial);
 const number=input.cloneNode(false);number.removeAttribute('name');number.removeAttribute('form');number.removeAttribute('pattern');number.type='tel';number.autocomplete='tel-national';number.inputMode='tel';number.placeholder='Phone number';number.setAttribute('aria-label','Phone number');if(number.id)number.id+='National';number.pattern='[0-9 ()-]{5,25}';number.maxLength=25;
 if(input.form)number.setAttribute('form',input.form.id||'');if(!input.form?.id)number.removeAttribute('form');
 const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');let writing=false;
 const split=value=>{const text=String(value||'');if(text.startsWith('+')){const match=countries.filter(valid).sort((a,b)=>b.dial.length-a.dial.length).find(c=>text.startsWith(c.dial));if(match){dial.value=match.dial;number.value=text.slice(match.dial.length).trim();return;}}number.value=text;};
 const sync=()=>{writing=true;descriptor.set.call(input,number.value.trim()?dial.value+number.value.replace(/[^0-9]/g,''):'');writing=false;};
 const initial=input.value,originalDefault=input.defaultValue;input.before(group);group.append(dial,number,input);input.type='hidden';input.required=false;input.removeAttribute('pattern');input.removeAttribute('maxlength');input.dataset.siegPhoneOriginal='true';
 Object.defineProperty(input,'value',{configurable:true,get(){return descriptor.get.call(this)},set(value){descriptor.set.call(this,value);if(!writing)split(value)}});
 split(initial);sync();
 for(const kind of ['input','change']){number.addEventListener(kind,sync);dial.addEventListener(kind,()=>{sync();input.dispatchEvent(new Event(kind,{bubbles:true}))});}
 const state=()=>{number.disabled=input.disabled;dial.disabled=input.disabled;number.readOnly=input.readOnly;};state();new MutationObserver(state).observe(input,{attributes:true,attributeFilter:['disabled','readonly']});
 input.form?.addEventListener('reset',()=>queueMicrotask(()=>{dial.value='+268';split(originalDefault);sync()}));
 controls.add({dial,input,number,split,sync});
}
function scan(scope){if(scope.matches?.('input[type="tel"]'))enhance(scope);scope.querySelectorAll?.('input[type="tel"]').forEach(enhance);scope.querySelectorAll?.('select[data-phone-dial]').forEach(first);}
scan(document);new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1)scan(node)}).observe(document.documentElement,{childList:true,subtree:true});
fetch(new URL('countries-global.json',root)).then(r=>{if(!r.ok)throw Error();return r.json()}).then(list=>{countries=list.filter(valid).sort((a,b)=>(b.code==='SZ')-(a.code==='SZ')||a.name.localeCompare(b.name));for(const c of controls){const value=c.input?.value;options(c.dial);if(c.input){c.split(value);c.sync();}}}).catch(()=>{});
})();
