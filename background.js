const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state=m=>chrome.storage.local.set({scanState:{message:m,updated:Date.now()}});
function cell(v){v=v==null?'':String(v);return '"'+v.replaceAll('"','""')+'"'}
const GROUPS=[
{name:'Сайдинг',url:'https://www.alta-profil.ru/catalog/saiding/',subgroups:['Виниловый сайдинг','Акриловый сайдинг','Формованный сайдинг','Крашеный','Блокхаус','Корабельная доска','Комплектующие элементы','Система отделки углов','Альта-Декор','Мембраны','Софиты']},
{name:'Фасадные панели',url:'https://www.alta-profil.ru/catalog/fasadnie-paneli/',subgroups:['Под кирпич','Под камень','Планки для монтажа','Углы','Система отделки углов','Альта-Декор','3D панели','Мембраны','Софиты']},
{name:'Водостоки',url:'https://www.alta-profil.ru/catalog/vodostochnaya-sistema/',subgroups:['Серия "Элит"','Серия "Стандарт"']}
];
async function waitComplete(id,timeout=30000){const st=Date.now();while(Date.now()-st<timeout){try{if((await chrome.tabs.get(id)).status==='complete')return true}catch{return false}await sleep(250)}return false}
async function waitBody(id,timeout=15000){const st=Date.now();while(Date.now()-st<timeout){try{const r=await chrome.scripting.executeScript({target:{tabId:id},func:()=>({len:document.body?.innerText?.length||0})});if((r?.[0]?.result?.len||0)>700)return true}catch{}await sleep(300)}return false}
async function nav(id,url){await chrome.tabs.update(id,{url});await waitComplete(id);await waitBody(id);await sleep(700)}
async function productLinks(id){
 const r=await chrome.scripting.executeScript({target:{tabId:id},func:()=>{
   const root=document.querySelector('.products');
   if(!root)return [];
   return [...new Set(
     [...root.querySelectorAll('a[href*="/catalog/product/"]')]
       .map(a=>new URL(a.getAttribute('href'),location.origin).href.split('#')[0])
   )];
 }});
 return r?.[0]?.result||[];
}
async function pageInfo(id){const r=await chrome.scripting.executeScript({target:{tabId:id},func:()=>{const c=s=>(s||'').replace(/\s+/g,' ').trim();const v=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const all=[...document.querySelectorAll('a,button')].filter(v);let root=null;const nums=all.filter(e=>/^\d+$/.test(c(e.innerText)));for(const n of nums){let p=n.parentElement;for(let i=0;i<7&&p;i++,p=p.parentElement){if([...p.querySelectorAll('a,button')].filter(e=>v(e)&&/^\d+$/.test(c(e.innerText))).length>=2){root=p;break}}if(root)break}if(!root){const rs=[...document.querySelectorAll('[class*="pagination"],[class*="pager"]')].filter(v);root=rs.at(-1)}if(!root)return {exists:false,current:null,numbers:[]};const bs=[...root.querySelectorAll('a,button')].filter(v);const numbers=[...new Set(bs.map(e=>parseInt(c(e.innerText),10)).filter(Number.isFinite))].sort((a,b)=>a-b);const active=bs.find(e=>/active|current|selected/i.test(e.className||'')||e.getAttribute('aria-current')==='page');let current=parseInt(c(active?.innerText),10);if(!Number.isFinite(current)){const u=new URL(location.href);current=parseInt(u.searchParams.get('page')||u.searchParams.get('PAGEN_1')||'',10)||null}return {exists:true,current,numbers};}});return r?.[0]?.result||{exists:false,current:null,numbers:[]}}
async function clickPage(id,target){const r=await chrome.scripting.executeScript({target:{tabId:id},args:[target],func:(target)=>{const c=s=>(s||'').replace(/\s+/g,' ').trim();const v=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const el=[...document.querySelectorAll('a,button')].filter(v).find(e=>/^\d+$/.test(c(e.innerText))&&parseInt(c(e.innerText),10)===target);if(!el)return false;el.scrollIntoView({block:'center'});el.click();return true;}});return !!r?.[0]?.result}
async function clickNext(id){const r=await chrome.scripting.executeScript({target:{tabId:id},func:()=>{const c=s=>(s||'').replace(/\s+/g,' ').trim();const v=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};const bs=[...document.querySelectorAll('a,button')].filter(v);let e=bs.find(x=>/следующ|next|впер[её]д/i.test(c(x.innerText)+' '+(x.getAttribute('aria-label')||'')+' '+(x.getAttribute('title')||'')));if(!e)e=bs.find(x=>/(pagination|pager).*(next|right)|(next|right).*(pagination|pager)/i.test(x.className||''));if(!e)return false;e.scrollIntoView({block:'center'});e.click();return true;}});return !!r?.[0]?.result}
async function waitChange(id,sig,timeout=16000){const st=Date.now();while(Date.now()-st<timeout){await sleep(300);const a=await productLinks(id);if(a.length&&a.join('|')!==sig)return true}return false}
async function collectUrls(id,label){const all=new Set(),seen=new Set();let logical=1;for(let guard=0;guard<100;guard++){const a=await productLinks(id),sig=a.join('|');if(seen.has(sig))break;seen.add(sig);a.forEach(u=>all.add(u));const pi=await pageInfo(id);await state(`${label}\nСтраница ${pi.current||logical}; на странице ${a.length}; найдено ${all.size}`);const current=pi.current||logical;const greater=(pi.numbers||[]).filter(n=>n>current);const moved=greater.length?await clickPage(id,Math.min(...greater)):await clickNext(id);if(!moved||!await waitChange(id,sig))break;logical++;}return [...all]}
async function discoverSubgroups(id,group){const r=await chrome.scripting.executeScript({target:{tabId:id},args:[group.subgroups,group.url],func:(expected,rootUrl)=>{const clean=s=>(s||'').replace(/\s+/g,' ').trim();const root=new URL(rootUrl);const as=[...document.querySelectorAll('a[href]')];const out=[];for(const name of expected){const matches=as.filter(a=>clean(a.innerText)===name).map(a=>{try{return new URL(a.getAttribute('href'),location.origin).href.split('#')[0]}catch{return''}}).filter(Boolean);const u=matches.find(x=>{try{const q=new URL(x);return q.origin===root.origin&&q.pathname.startsWith(root.pathname)&&!q.pathname.includes('/product/')}catch{return false}});if(u)out.push({name,url:u});}return out;}});return r?.[0]?.result||[]}
async function waitProduct(id,timeout=18000){const st=Date.now();while(Date.now()-st<timeout){try{const r=await chrome.scripting.executeScript({target:{tabId:id},func:()=>({h:(document.querySelector('h1')?.innerText||'').trim(),has:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,p,span')].some(e=>(e.innerText||'').trim()==='Характеристики')})});const x=r?.[0]?.result;if(x?.h&&x.has)return true}catch{}await sleep(300)}return false}
function externalId(url){const m=String(url).match(/-(\d+)\/?(?:[?#].*)?$/);return m?'alta-'+m[1]:'alta-'+btoa(unescape(encodeURIComponent(url))).replace(/[^a-zA-Z0-9]/g,'').slice(-24)}
function numericPrice(raw){const s=String(raw||'').replace(/\u00a0/g,' ').trim();const m=s.match(/\d[\d\s]*(?:[.,]\d{1,2})?/);if(!m)return '';return m[0].replace(/\s/g,'').replace(',','.')}
chrome.runtime.onMessage.addListener(m=>{if(m.type==='scanAll')scanAll(m.workers);else if(m.type==='export')exportData(m.format)});

async function waitProductShell(id,timeout=12000){
 const st=Date.now();
 while(Date.now()-st<timeout){
  try{
   const r=await chrome.scripting.executeScript({
    target:{tabId:id},
    func:()=>({
      h1:(document.querySelector('h1')?.innerText||'').trim(),
      bodyLen:(document.body?.innerText||'').length
    })
   });
   const x=r?.[0]?.result;
   if(x?.h1 && x.bodyLen>700)return true;
  }catch{}
  await sleep(220);
 }
 return false;
}

async function nudgeProductPage(id,attempt){
 try{
  await chrome.scripting.executeScript({
   target:{tabId:id},
   args:[attempt],
   func:(attempt)=>{
    const h=document.documentElement.scrollHeight||document.body.scrollHeight||0;
    if(attempt===0)window.scrollTo(0,Math.min(700,h*0.18));
    else if(attempt===1)window.scrollTo(0,Math.min(1500,h*0.35));
    else window.scrollTo(0,0);
   }
  });
 }catch{}
}

async function injectProductParser(id){
 try{
  const rr=await chrome.scripting.executeScript({
   target:{tabId:id},
   files:['product.js']
  });
  return {product:rr?.[0]?.result||null,error:null};
 }catch(e){
  return {product:null,error:e?.message||String(e)};
 }
}

async function loadAndParseProduct(tabId,url){
 await chrome.tabs.update(tabId,{url});

 const complete=await waitComplete(tabId,25000);
 if(!complete)throw new Error('Страница не завершила загрузку за 25 секунд');

 await waitProductShell(tabId,10000);
 await sleep(180);

 let best=null;
 let bestScore=-1;
 let stable=0;
 let prevSignature='';
 let parserError='';

 for(let attempt=0;attempt<5;attempt++){
  const {product:p,error}=await injectProductParser(tabId);
  if(error)parserError=error;

  if(p?.name){
   const cc=Object.keys(p.characteristics||{}).length;
   const ic=(p.images||[]).length;
   const score=cc*100+ic;

   if(score>bestScore){
    best=p;
    bestScore=score;
   }

   const sig=`${cc}|${ic}`;
   if(sig===prevSignature)stable++;
   else stable=0;
   prevSignature=sig;

   if(cc>0 && stable>=1)return best;
  }

  await nudgeProductPage(tabId,attempt);
  await sleep([350,550,800,1100,1400][attempt]);
 }

 if(best?.name && Object.keys(best.characteristics||{}).length>0)return best;

 if(best?.name){
  throw new Error(
   `Название найдено («${best.name.slice(0,55)}»), но парсер вернул 0 характеристик `+
   `(фото: ${(best.images||[]).length})`
  );
 }

 throw new Error(
  parserError
   ? `product.js не вернул карточку: ${parserError}`
   : 'После 5 попыток product.js не вернул название товара'
 );
}

async function scanAll(requestedWorkers=4){
 let catalogTab=null;
 const workerTabs=[];
 const workers=Math.max(2,Math.min(4,Number(requestedWorkers)||4));

 try{
  await chrome.storage.local.set({
   products:[],
   scanStats:[],
   scanErrors:[],
   scanRuntime:{workers:0,done:0,total:0},
   scanState:{message:`Этап 1/3: собираю ссылки. Затем автоматически проверю 8 карточек.`,updated:Date.now()}
  });

  const productMap=new Map();
  const urlAssignments=new Map();
  const scanStats=[];
  const errors=[];

  catalogTab=await chrome.tabs.create({url:'about:blank',active:false});

  for(const group of GROUPS){
   await nav(catalogTab.id,group.url);
   const discovered=await discoverSubgroups(catalogTab.id,group);

   const foundNames=new Set(discovered.map(x=>x.name));
   const missing=group.subgroups.filter(x=>!foundNames.has(x));
   if(missing.length){
    await state(`${group.name}: найдены ${discovered.length}/${group.subgroups.length} подгрупп.\nНе найдены: ${missing.join(', ')}`);
   }

   for(let si=0;si<discovered.length;si++){
    const sub=discovered[si];
    await nav(catalogTab.id,sub.url);
    const urls=await collectUrls(
     catalogTab.id,
     `${group.name} → ${sub.name} (${si+1}/${discovered.length})`
    );

    scanStats.push({group:group.name,subgroup:sub.name,count:urls.length});
    await chrome.storage.local.set({scanStats});

    for(const url of urls){
     if(!urlAssignments.has(url))urlAssignments.set(url,[]);
     const arr=urlAssignments.get(url);
     if(!arr.some(x=>x.group===group.name&&x.subgroup===sub.name)){
      arr.push({
       group:group.name,
       subgroup:sub.name,
       categoryPath:`${group.name} / ${sub.name}`
      });
     }
    }
   }
  }

  const urls=[...urlAssignments.keys()];

  if(catalogTab?.id){
   try{await chrome.tabs.remove(catalogTab.id)}catch{}
   catalogTab=null;
  }

  await chrome.storage.local.set({
   scanRuntime:{workers,done:0,total:urls.length},
   scanState:{message:`Этап 2/3: найдено ${urls.length} URL. Проверяю первые 8 карточек перед полным запуском…`,updated:Date.now()}
  });

  for(let i=0;i<workers;i++){
   workerTabs.push(await chrome.tabs.create({url:'about:blank',active:false}));
  }

  const attachMeta=(p,url)=>{
   const a=urlAssignments.get(url)||[];
   p.sourceGroup=a[0]?.group||'';
   p.sourceSubgroup=a[0]?.subgroup||'';
   p.categoryPath=a[0]?.categoryPath||'';
   p.categoryPaths=a.map(x=>x.categoryPath);
   p.externalId=externalId(url);
   return p;
  };

  const testCount=Math.min(8,urls.length);
  let testNext=0,testOk=0,testFail=0;

  const testWorker=async(tab,no)=>{
   while(true){
    const i=testNext++;
    if(i>=testCount)return;
    const url=urls[i];
    try{
     const p=attachMeta(await loadAndParseProduct(tab.id,url),url);
     productMap.set(url,p);
     testOk++;
     await state(
      `Проверка 8 карточек: ${testOk+testFail}/${testCount}\n`+
      `Успешно: ${testOk} • ошибок: ${testFail}\n`+
      `${p.name}\nХарактеристик: ${Object.keys(p.characteristics||{}).length} • фото: ${(p.images||[]).length}`
     );
    }catch(e){
     testFail++;
     errors.push({url,error:e.message,phase:'preflight'});
     await chrome.storage.local.set({scanErrors:errors});
     await state(
      `Проверка 8 карточек: ${testOk+testFail}/${testCount}\n`+
      `Успешно: ${testOk} • ошибок: ${testFail}\n`+
      `Ошибка: ${url}\n${e.message}`
     );
    }
   }
  };

  await Promise.all(workerTabs.map((t,i)=>testWorker(t,i+1)));
  await chrome.storage.local.set({products:[...productMap.values()]});

  if(testOk===0 || testOk<Math.ceil(testCount/2)){
   await state(
    `СТОП: полный проход не запущен.\n`+
    `Контрольные карточки: успешно ${testOk}/${testCount}, ошибок ${testFail}.\n`+
    `Это защитный стоп — сначала нужно исправить парсер, а не ждать обработку всех ${urls.length} товаров.`
   );
   return;
  }

  await state(
   `Этап 3/3: контроль пройден (${testOk}/${testCount}).\n`+
   `Запускаю полный проход ${urls.length} товаров в ${workers} потоках.`
  );

  let nextIndex=testCount;
  let done=testCount;
  let ok=testOk;
  let fail=testFail;
  let lastSaved=productMap.size;

  const saveBatch=async(force=false)=>{
   if(!force && productMap.size-lastSaved<10)return;
   lastSaved=productMap.size;
   await chrome.storage.local.set({
    products:[...productMap.values()],
    scanErrors:errors,
    scanRuntime:{workers,done,total:urls.length}
   });
  };

  const worker=async(tab,no)=>{
   while(true){
    const i=nextIndex++;
    if(i>=urls.length)return;
    const url=urls[i];

    try{
     const p=attachMeta(await loadAndParseProduct(tab.id,url),url);
     productMap.set(url,p);
     ok++;done++;
     await saveBatch(false);
     await state(
      `Поток ${no}/${workers} • ${done}/${urls.length}\n`+
      `${p.name}\n`+
      `Характеристик: ${Object.keys(p.characteristics||{}).length} • фото: ${(p.images||[]).length}\n`+
      `Успешно: ${ok} • ошибок: ${fail}`
     );
    }catch(e){
     fail++;done++;
     errors.push({url,error:e.message,phase:'main'});
     await chrome.storage.local.set({
      scanErrors:errors,
      scanRuntime:{workers,done,total:urls.length}
     });
     await state(
      `Поток ${no}/${workers} • ${done}/${urls.length}\n`+
      `Ошибка: ${url}\n${e.message}\n`+
      `Успешно: ${ok} • ошибок: ${fail}`
     );
    }
   }
  };

  await Promise.all(workerTabs.map((t,i)=>worker(t,i+1)));

  const retryUrls=[...new Set(errors.filter(x=>x.phase==='main').map(x=>x.url))]
   .filter(u=>!productMap.has(u));

  if(retryUrls.length){
   await state(`Основной проход закончен. Автоповтор ${retryUrls.length} ошибок в 2 потока…`);
   let ri=0;
   const retryWorker=async(tab)=>{
    while(true){
     const j=ri++;
     if(j>=retryUrls.length)return;
     const url=retryUrls[j];
     try{
      const p=attachMeta(await loadAndParseProduct(tab.id,url),url);
      productMap.set(url,p);
     }catch{}
    }
   };
   await Promise.all(workerTabs.slice(0,Math.min(2,workerTabs.length)).map(retryWorker));
  }

  await saveBatch(true);

  const finalProducts=[...productMap.values()];
  const remaining=urls.filter(u=>!productMap.has(u));
  const byGroup={};
  for(const p of finalProducts)byGroup[p.sourceGroup]=(byGroup[p.sourceGroup]||0)+1;

  await chrome.storage.local.set({
   products:finalProducts,
   scanErrors:remaining.map(url=>({url,error:'Не прочитан после повторной попытки'})),
   scanRuntime:{workers,done:urls.length,total:urls.length}
  });

  await state(
   `ГОТОВО.\n`+
   `Успешно: ${finalProducts.length}/${urls.length}\n`+
   `Не прочитано после повтора: ${remaining.length}\n`+
   Object.entries(byGroup).map(([k,v])=>`${k}: ${v}`).join('\n')
  );

 }catch(e){
  console.error(e);
  await state('Критическая ошибка сканирования: '+e.message);
 }finally{
  if(catalogTab?.id)try{await chrome.tabs.remove(catalogTab.id)}catch{}
  for(const t of workerTabs)if(t?.id)try{await chrome.tabs.remove(t.id)}catch{}
 }
}

function xmlEsc(v){
 return String(v??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&apos;');
}
function safeIdFromExternal(v,fallback){
 const m=String(v||'').match(/(\d+)/g);
 if(m?.length)return m.join('').slice(-18);
 let h=0,s=String(fallback||v||'');
 for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;
 return String(Math.abs(h)||1);
}
async function exportData(format){
 const {products=[]}=await chrome.storage.local.get('products');
 const usable=products.filter(p=>p.sourceGroup && p.sourceSubgroup);

 for(const p of usable){
  const dst={};
  for(const [rk,rv] of Object.entries(p.characteristics||{})){
   const k=String(rk||'').trim(),v=String(rv||'').trim();
   if(!k||!v||/^(?:артикул|арт\.?|код товара|sku)\b/i.test(k))continue;
   dst[k]=v;
  }
  p.characteristics=dst;
  p.images=[...new Set((p.images||[]).filter(u=>u&&!/\/undefined(?:[?#/]|$)/i.test(String(u))))];
 }

 if(format==='photo-update'){
  const {tildaCatalogRows=[]}=await chrome.storage.local.get('tildaCatalogRows');
  if(!tildaCatalogRows.length){
   await state('Сначала загрузите текущий CSV из Tilda через кнопку в расширении.');
   return;
  }

  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const byTitle=new Map();
  for(const p of usable){
   const k=norm(p.name);
   if(!k)continue;
   if(!byTitle.has(k))byTitle.set(k,[]);
   byTitle.get(k).push(p);
  }

  let matched=0,missing=0;
  const rows=[];
  for(const t of tildaCatalogRows){
   const cands=byTitle.get(norm(t.title))||[];
   if(!cands.length){missing++;continue}

   const p=[...cands].sort((a,b)=>(b.images||[]).length-(a.images||[]).length)[0];
   const photos=[...new Set((p.images||[]).filter(Boolean))];
   if(!photos.length){missing++;continue}

   rows.push([t.uid,t.title,photos.join(' ')]);
   matched++;
  }

  const h=['Tilda UID','Title','Photo'];
  const csv='\uFEFF'+[h,...rows].map(r=>r.map(cell).join(';')).join('\r\n');
  chrome.downloads.download({
   url:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),
   filename:'alta-profil-photo-update-v14.csv',
   saveAs:true
  });
  await state(`CSV фотографий готов.\nСопоставлено: ${matched}\nБез совпадения/фото: ${missing}\nИмпортируйте в Tilda в режиме «только обновить».`);
  return;
 }

 if(format==='json'){
  chrome.downloads.download({
   url:'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(usable,null,2)),
   filename:'alta-profil-3-groups-v12.json',saveAs:true
  });
  return;
 }

 if(format==='yml'){
  const groupIds={
   'Сайдинг':'100',
   'Фасадные панели':'200',
   'Водостоки':'300'
  };
  const subgroupIds=new Map();
  let sid=1000;

  const grouped=new Map();
  for(const p of usable){
   const key=`${p.sourceGroup}|||${p.sourceSubgroup}`;
   if(!grouped.has(key)){
    subgroupIds.set(key,String(sid++));
    grouped.set(key,{group:p.sourceGroup,subgroup:p.sourceSubgroup});
   }
  }

  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const date=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let y='<?xml version="1.0" encoding="UTF-8"?>\n';
  y+=`<yml_catalog date="${date}">\n`;
  y+='  <shop>\n';
  y+='    <name>Alta-Profil import</name>\n';
  y+='    <company>Alta-Profil</company>\n';
  y+='    <url>https://www.alta-profil.ru/</url>\n';
  y+='    <currencies><currency id="RUR" rate="1"/></currencies>\n';
  y+='    <categories>\n';

  for(const [name,id] of Object.entries(groupIds)){
   y+=`      <category id="${id}">${xmlEsc(name)}</category>\n`;
  }
  for(const [key,data] of grouped){
   const id=subgroupIds.get(key), parent=groupIds[data.group];
   if(!parent)continue;
   y+=`      <category id="${id}" parentId="${parent}">${xmlEsc(data.subgroup)}</category>\n`;
  }
  y+='    </categories>\n';
  y+='    <offers>\n';

  for(const p of usable){
   const key=`${p.sourceGroup}|||${p.sourceSubgroup}`;
   const catId=subgroupIds.get(key);
   if(!catId)continue;
   const id=safeIdFromExternal(p.externalId,p.url);
   const price=numericPrice(p.price)||'0';
   y+=`      <offer id="${xmlEsc(id)}" available="true">\n`;
   y+=`        <name>${xmlEsc(p.name||'')}</name>\n`;
   y+=`        <price>${xmlEsc(price)}</price>\n`;
   y+='        <currencyId>RUR</currencyId>\n';
   y+=`        <categoryId>${catId}</categoryId>\n`;
   for(const img of (p.images||[])){
    y+=`        <picture>${xmlEsc(img)}</picture>\n`;
   }
   for(const [k,v] of Object.entries(p.characteristics||{})){
    y+=`        <param name="${xmlEsc(k)}">${xmlEsc(v)}</param>\n`;
   }
   y+='      </offer>\n';
  }

  y+='    </offers>\n';
  y+='  </shop>\n';
  y+='</yml_catalog>\n';

  chrome.downloads.download({
   url:'data:application/xml;charset=utf-8,'+encodeURIComponent(y),
   filename:'alta-profil-3-groups-hierarchy-v12.yml',
   saveAs:true
  });
  return;
 }

 const charNames=[];
 const seen=new Set();
 for(const p of usable){
  for(const n of Object.keys(p.characteristics||{})){
   if(!seen.has(n)){seen.add(n);charNames.push(n)}
  }
 }

 const h=[
  'External ID','Title','Price','Photo','Category',
  ...charNames.map(n=>'Characteristics:'+n)
 ];
 const rows=usable.map(p=>[
  p.externalId||externalId(p.url),
  p.name||'',
  numericPrice(p.price),
  (p.images||[]).join(' '),
  `${p.sourceGroup} — ${p.sourceSubgroup}`,
  ...charNames.map(n=>(p.characteristics||{})[n]??'')
 ]);

 const csv='\uFEFF'+[h,...rows].map(r=>r.map(cell).join(';')).join('\r\n');
 chrome.downloads.download({
  url:'data:text/csv;charset=utf-8,'+encodeURIComponent(csv),
  filename:'alta-profil-3-groups-tilda-v12.csv',
  saveAs:true
 });
}
