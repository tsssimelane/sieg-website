window.SiegGraduateMap={
 mount(svg,status,labels,choose){
  const ns='http://www.w3.org/2000/svg',paths=new Map(),markers=document.createElementNS(ns,'g');
  let rows=[],counts=[],selected='',ticket=0;
  const geometry=fetch('talent/world-map.json?v=geoboundaries-adm0').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
   rows=data;const land=document.createElementNS(ns,'g');land.setAttribute('aria-hidden','true');
   for(const [code,x,y,d] of data){if(!d)continue;const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('fill-rule','evenodd');path.classList.add('graduate-map-land');land.append(path);paths.set(code,path);}
   svg.replaceChildren(land,markers);return true;
  }).catch(()=>false);
  function select(code){
   selected=code;
   for(const [id,path] of paths)path.classList.toggle('is-selected',id===selected);
   for(const dot of markers.children)dot.classList.toggle('is-selected',dot.dataset.country===selected);
  }
  async function refresh(fetchCounts){
   const current=++ticket;
   try{
    const [ready,d]=await Promise.all([geometry,fetchCounts()]);
    if(current!==ticket)return;
    if(!ready){status.textContent='World map unavailable. Use the country filter below.';return;}
    counts=d.countries;const byCode=new Map(rows.map(r=>[r[0],r]));markers.replaceChildren();
    for(const path of paths.values())path.classList.remove('is-populated');
    let unmapped=0;
    for(const {country,count} of counts){
     const row=byCode.get(country);if(!row){unmapped++;continue;}
     paths.get(country)?.classList.add('is-populated');
     const dot=document.createElementNS(ns,'circle'),title=document.createElementNS(ns,'title'),label=(labels.get(country)||country)+': '+count+' graduate'+(count===1?'':'s');
     dot.classList.add('graduate-map-dot');dot.dataset.country=country;
     for(const [key,value] of Object.entries({cx:row[1],cy:row[2],r:Math.min(12,4+Math.sqrt(count)),tabindex:0,role:'button','aria-label':label}))dot.setAttribute(key,String(value));
     dot.onclick=()=>choose(country);dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(country);}};
     title.textContent=label;dot.append(title);markers.append(dot);
    }
    select(selected);
    status.textContent=counts.length?counts.length+' '+(counts.length===1?'country':'countries')+' represented. Select a dot to filter.'+(unmapped?' Some locations are available through the country filter only.':''):'No graduate records to map yet.';
   }catch{if(current===ticket)status.textContent='Graduate counts could not load. Try refreshing the page.';}
  }
  return {refresh,select};
 }
};
