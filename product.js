(()=>{
 const clean=s=>(s||'').replace(/\s+/g,' ').trim();
 const abs=u=>{try{return new URL(u,location.origin).href.split('#')[0]}catch{return''}};
 const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
 const name=clean(document.querySelector('h1')?.innerText);

 let price='';
 for(const e of [...document.querySelectorAll('[class*="price"],[itemprop="price"]')].filter(vis)){
   const t=clean(e.getAttribute('content')||e.innerText);
   const m=t.match(/\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.|руб(?:\.|лей)?)(?:\s*\/\s*[а-яА-Яa-zA-Z.]+)?/i);
   if(m){price=m[0];break}
 }
 if(!price){
   const top=clean(document.querySelector('h1')?.parentElement?.parentElement?.innerText||document.body.innerText);
   const m=top.match(/\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:₽|р\.|руб(?:\.|лей)?)(?:\s*\/\s*[а-яА-Яa-zA-Z.]+)?/i);
   if(m)price=m[0];
 }

 const breadcrumbs=[...document.querySelectorAll('.breadcrumbs a,.breadcrumb a,[class*="breadcrumb"] a')]
   .filter(vis).map(a=>clean(a.innerText)).filter(Boolean);
 const category=breadcrumbs.length?breadcrumbs.at(-1):'';

 const characteristics={};
 const isArticle=k=>/^(?:артикул|арт\.?|код товара|sku)\b/i.test(clean(k));
 const add=(k,v)=>{
   k=clean(k).replace(/[:：]\s*$/,'');v=clean(v);
   if(!k||!v||isArticle(k)||k===v||k.length>140||v.length>500)return;
   characteristics[k]=v;
 };
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,p,span')]
   .filter(e=>vis(e)&&/^характеристики\s*$/i.test(clean(e.innerText)));
 const heading=headings[0];

 function parseRegion(region){
   region.querySelectorAll('tr').forEach(tr=>{
     const c=[...tr.querySelectorAll('th,td')].map(x=>clean(x.innerText)).filter(Boolean);
     if(c.length>=2)add(c[0],c.slice(1).join(' '));
   });
   region.querySelectorAll('dt').forEach(dt=>{
     const dd=dt.nextElementSibling;if(dd?.tagName==='DD')add(dt.innerText,dd.innerText);
   });
   region.querySelectorAll('div,li').forEach(row=>{
     const kids=[...row.children].filter(vis);
     if(kids.length===2)add(kids[0].innerText,kids[1].innerText);
   });
 }
 if(heading){
   let p=heading.parentElement,best=null,bestCount=0;
   for(let level=0;level<7&&p;level++,p=p.parentElement){
     let count=0;
     p.querySelectorAll('tr').forEach(tr=>{const c=[...tr.querySelectorAll('th,td')].map(x=>clean(x.innerText)).filter(Boolean);if(c.length>=2&&!isArticle(c[0]))count++});
     p.querySelectorAll('dt').forEach(dt=>{if(dt.nextElementSibling?.tagName==='DD'&&!isArticle(dt.innerText))count++});
     p.querySelectorAll('div,li').forEach(row=>{const k=[...row.children].filter(vis);if(k.length===2){const a=clean(k[0].innerText),b=clean(k[1].innerText);if(a&&b&&a.length<140&&b.length<500&&!isArticle(a))count++}});
     const txt=clean(p.innerText);
     if(count>bestCount&&txt.length<12000){best=p;bestCount=count}
     if(count>=5&&txt.length<7000){best=p;break}
   }
   if(best)parseRegion(best);
 }
 if(Object.keys(characteristics).length<3){
   [...document.querySelectorAll('div,li,tr')].filter(vis).forEach(row=>{
     const kids=[...row.children].filter(vis);
     if(kids.length===2){
       const a=clean(kids[0].innerText),b=clean(kids[1].innerText);
       if(/цвет|единица измерения|количество в упаковке|коллекция|площадь|габарит|длина|ширина|материал|вес|страна|оттенок|имитация/i.test(a))add(a,b);
     }
   });
 }
 for(const k of Object.keys(characteristics)) if(isArticle(k)) delete characteristics[k];

 const cleanedCharacteristics={};
 const articlePair=/(?:^|\s*\|\s*|\s{2,})\s*(?:Артикул|Арт\.?|Код товара|SKU)\s*:?\s*[A-Za-zА-Яа-я0-9._-]+\s*(?=\||\s{2,}|$)/gi;
 for(const [rawK,rawV] of Object.entries(characteristics)){
   let k=clean(rawK),v=clean(rawV);
   if(isArticle(k)) continue;
   k=clean(k.replace(articlePair,' ')).replace(/^\|\s*|\s*\|$/g,'');
   v=clean(v.replace(articlePair,' ')).replace(/^\|\s*|\s*\|$/g,'');
   k=k.replace(/^(?:Артикул|Арт\.?|Код товара|SKU)\s*:?\s*[A-Za-zА-Яа-я0-9._-]+\s*/i,'').trim();
   if(k && v && !isArticle(k)) cleanedCharacteristics[k]=v;
 }
 for(const k of Object.keys(characteristics)) delete characteristics[k];
 Object.assign(characteristics,cleanedCharacteristics);

 const imageMap=new Map();
 let imageSeq=0;

 const looksImage=u=>{
   const s=String(u||'').trim();
   return /\.(?:jpe?g|png|webp|avif)(?:[?#].*)?$/i.test(s) ||
          /\/upload\/iblock\//i.test(s);
 };

 const normalizeImage=u=>{
   u=abs(u);
   if(!u)return '';
   try{
     const x=new URL(u);
     for(const k of [...x.searchParams.keys()]){
       if(/^(?:w|h|width|height|resize|quality|q)$/i.test(k))x.searchParams.delete(k);
     }
     u=x.href;
   }catch{}
   return u;
 };

 const addUrl=(u,priority=20)=>{
   if(!u || /^(?:undefined|null)$/i.test(String(u).trim()))return;
   u=normalizeImage(u);
   if(!u || !/^https?:/i.test(u) || /\/undefined(?:[?#/]|$)/i.test(u))return;
   if(/(?:logo|favicon|sprite|avatar|dealer|captcha)/i.test(u))return;
   if(/\.svg(?:[?#].*)?$/i.test(u))return;
   if(!looksImage(u))return;
   const old=imageMap.get(u);
   if(!old || priority<old.priority)imageMap.set(u,{url:u,priority,seq:old?.seq??imageSeq++});
 };

 const addSrcset=(value,priority=5)=>{
   if(!value)return;
   const parts=value.split(',').map(x=>{
     const z=x.trim().split(/\s+/);
     const d=z[1]||'';
     const n=parseFloat(d)||0;
     const mult=/w$/i.test(d)?n:(/x$/i.test(d)?n*10000:0);
     return {u:z[0],rank:mult};
   }).filter(x=>x.u);
   parts.sort((a,b)=>b.rank-a.rank);
   parts.forEach((x,i)=>addUrl(x.u,priority+i));
 };

 const addElementMedia=(el,basePriority=10)=>{
   if(!el)return;

   [
     'data-original','data-full','data-full-src','data-large','data-large-src',
     'data-zoom','data-zoom-image','data-image','data-photo','data-src'
   ].forEach((a,i)=>addUrl(el.getAttribute?.(a),basePriority+i));

   addSrcset(el.getAttribute?.('srcset'),basePriority+3);
   addSrcset(el.getAttribute?.('data-srcset'),basePriority+3);

   if(el.tagName==='SOURCE'){
     addSrcset(el.getAttribute('srcset'),basePriority+2);
     addSrcset(el.getAttribute('data-srcset'),basePriority+2);
     addUrl(el.getAttribute('src'),basePriority+6);
   }

   if(el.tagName==='A' && looksImage(el.getAttribute('href')))addUrl(el.getAttribute('href'),basePriority);
   const a=el.closest?.('a[href]');
   if(a && looksImage(a.getAttribute('href')))addUrl(a.getAttribute('href'),basePriority);

   addUrl(el.getAttribute?.('src'),basePriority+12);
   if(el.currentSrc)addUrl(el.currentSrc,basePriority+14);

   for(const at of [...(el.attributes||[])]){
     if(/(?:src|image|photo|picture|zoom|large|full|original|href)/i.test(at.name)){
       const raw=at.value||'';
       if(raw.includes(','))addSrcset(raw,basePriority+4);
       else addUrl(raw,basePriority+5);
     }
   }

   const st=el.getAttribute?.('style')||'';
   for(const m of st.matchAll(/url\((['"]?)(.*?)\1\)/gi))addUrl(m[2],basePriority+7);
 };

 document.querySelectorAll('script[type="application/ld+json"]').forEach(sc=>{
   try{
     const j=JSON.parse(sc.textContent);
     const walk=x=>{
       if(!x)return;
       if(Array.isArray(x)){x.forEach(walk);return}
       if(typeof x==='object'){
         const typ=x['@type'];
         if(typ==='Product'||(Array.isArray(typ)&&typ.includes('Product'))){
           const im=x.image;
           const take=z=>{
             if(typeof z==='string')addUrl(z,0);
             else if(z)addUrl(z.url||z.contentUrl,0);
           };
           Array.isArray(im)?im.forEach(take):take(im);
         }
         Object.values(x).forEach(walk);
       }
     };
     walk(j);
   }catch{}
 });

 const h1=document.querySelector('h1');
 const h1Y=h1?h1.getBoundingClientRect().top+scrollY:0;
 const charY=heading?heading.getBoundingClientRect().top+scrollY:Infinity;

 const mediaSelectors=[
   '[class*="gallery"]','[class*="slider"]','[class*="swiper"]',
   '[class*="photo"]','[class*="image"]','[class*="picture"]',
   '[class*="media"]','[class*="preview"]','[class*="thumb"]'
 ];

 const mediaContainers=[...new Set(mediaSelectors.flatMap(s=>[...document.querySelectorAll(s)]))]
   .filter(e=>{
     const r=e.getBoundingClientRect();
     const top=r.top+scrollY, bottom=r.bottom+scrollY;
     return top<charY && bottom>h1Y-900 && top<h1Y+1400;
   });

 for(const box of mediaContainers){
   addElementMedia(box,6);
   box.querySelectorAll('img,source,a[href],picture,[style*="background"]').forEach(el=>addElementMedia(el,5));
 }

 if(h1){
   let p=h1.parentElement;
   for(let level=0;level<8&&p;level++,p=p.parentElement){
     const r=p.getBoundingClientRect();
     const top=r.top+scrollY,bottom=r.bottom+scrollY;
     if(top<charY && bottom>h1Y){
       const els=[...p.querySelectorAll('img,source,a[href],picture,[style*="background"]')];
       const probable=els.filter(el=>{
         const er=el.getBoundingClientRect();
         const y=er.top+scrollY;
         return y<charY && y>h1Y-1000 && y<h1Y+1600;
       });
       if(probable.length>=2){
         probable.forEach(el=>addElementMedia(el,8));
         break;
       }
     }
   }
 }

 document.querySelectorAll('img,source,a[href],picture,[style*="background"]').forEach(el=>{
   const r=el.getBoundingClientRect();
   const y=r.top+scrollY;
   if(y<charY && y>h1Y-1000 && y<h1Y+1500)addElementMedia(el,12);
 });

 addUrl(document.querySelector('meta[property="og:image"]')?.content,40);
 addUrl(document.querySelector('meta[name="twitter:image"]')?.content,41);

 const images=[...imageMap.values()]
   .sort((a,b)=>a.priority-b.priority||a.seq-b.seq)
   .map(x=>x.url);

 return {url:location.href.split('#')[0],name,price,category,breadcrumbs,characteristics,images};
})()
