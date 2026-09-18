// v14.1 bootstrap: reuse the proven v14 helpers/exporter,
// but use a new scan flow that tests only 8 products BEFORE discovering the full catalog.
importScripts('background.js');

chrome.runtime.onMessage.addListener(m=>{
  if(m.type==='scanAllFast') scanAllFast(m.workers);
});

async function collectSampleUrlsFast(id,group,wanted=8){
  await nav(id,group.url);
  const discovered=await discoverSubgroups(id,group);
  if(!discovered.length)return {subgroup:null,urls:[]};

  for(const sub of discovered){
    await nav(id,sub.url);
    const found=new Set();
    const seenPages=new Set();
    let logical=1;

    for(let guard=0;guard<20;guard++){
      const a=await productLinks(id);
      const sig=a.join('|');
      if(seenPages.has(sig))break;
      seenPages.add(sig);

      for(const url of a){
        found.add(url);
        if(found.size>=wanted)break;
      }

      await state(
        `Предварительная проверка: ищу ${wanted} уникальных товаров.\n`+
        `${group.name} → ${sub.name}\n`+
        `Найдено ${Math.min(found.size,wanted)}/${wanted}`
      );

      if(found.size>=wanted){
        return {subgroup:sub,urls:[...found].slice(0,wanted)};
      }

      const pi=await pageInfo(id);
      const current=pi.current||logical;
      const greater=(pi.numbers||[]).filter(n=>n>current);
      const moved=greater.length
        ? await clickPage(id,Math.min(...greater))
        : await clickNext(id);
      if(!moved||!await waitChange(id,sig))break;
      logical++;
    }
  }

  return {subgroup:null,urls:[]};
}

async function scanAllFast(requestedWorkers=8){
  let catalogTab=null;
  const workerTabs=[];
  const workers=Math.max(1,Math.min(8,Number(requestedWorkers)||8));

  try{
    await chrome.storage.local.set({
      products:[],
      scanStats:[],
      scanErrors:[],
      scanRuntime:{workers:0,done:0,total:8},
      scanState:{
        message:'Этап 1/4: ищу только 8 тестовых товаров. Полный каталог пока НЕ сканируется.',
        updated:Date.now()
      }
    });

    const productMap=new Map();
    const urlAssignments=new Map();
    const scanStats=[];
    const errors=[];

    catalogTab=await chrome.tabs.create({url:'about:blank',active:false});

    // 1) Find exactly eight unique product URLs, without enumerating the whole catalog.
    const sample=await collectSampleUrlsFast(catalogTab.id,GROUPS[0],8);
    const sampleUrls=[...new Set(sample.urls)].slice(0,8);

    if(sampleUrls.length!==8){
      await state(
        `СТОП: не удалось получить 8 уникальных тестовых товаров. `+
        `Найдено ${sampleUrls.length}/8. Полный поиск не запускался.`
      );
      return;
    }

    for(const url of sampleUrls){
      urlAssignments.set(url,[{
        group:GROUPS[0].name,
        subgroup:sample.subgroup?.name||'',
        categoryPath:`${GROUPS[0].name} / ${sample.subgroup?.name||''}`
      }]);
    }

    // 2) Open up to eight products simultaneously and run the REAL product parser.
    for(let i=0;i<Math.min(workers,8);i++){
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

    await chrome.storage.local.set({
      scanRuntime:{workers:workerTabs.length,done:0,total:8},
      scanState:{
        message:`Этап 2/4: проверяю 8 товаров. Одновременно: ${workerTabs.length}.`,
        updated:Date.now()
      }
    });

    let testNext=0;
    let testOk=0;
    let testFail=0;
    const testErrors=[];

    const testWorker=async(tab,no)=>{
      while(true){
        const i=testNext++;
        if(i>=sampleUrls.length)return;
        const url=sampleUrls[i];

        try{
          const p=attachMeta(await loadAndParseProduct(tab.id,url),url);
          productMap.set(url,p);
          testOk++;

          await chrome.storage.local.set({
            products:[...productMap.values()],
            scanRuntime:{workers:workerTabs.length,done:testOk+testFail,total:8}
          });

          await state(
            `Тест: ${testOk+testFail}/8\n`+
            `Успешно: ${testOk} • ошибок: ${testFail}\n`+
            `${p.name}\n`+
            `Характеристик: ${Object.keys(p.characteristics||{}).length} • `+
            `фото: ${(p.images||[]).length}`
          );
        }catch(e){
          testFail++;
          testErrors.push({url,error:e.message,phase:'preflight'});

          await chrome.storage.local.set({
            scanErrors:testErrors,
            scanRuntime:{workers:workerTabs.length,done:testOk+testFail,total:8}
          });

          await state(
            `Тест: ${testOk+testFail}/8\n`+
            `Успешно: ${testOk} • ошибок: ${testFail}\n`+
            `Ошибка: ${url}\n${e.message}`
          );
        }
      }
    };

    await Promise.all(workerTabs.map((tab,i)=>testWorker(tab,i+1)));

    // Do not waste time on the whole catalog unless all eight are valid.
    if(testOk!==8 || testFail!==0){
      await state(
        `СТОП: полный поиск не запущен.\n`+
        `Тест: ${testOk}/8 успешно, ошибок: ${testFail}.\n`+
        `Полный каталог начнёт сканироваться только после результата 8/8.`
      );
      return;
    }

    // 3) Now, and only now, discover the entire catalog.
    await state('Этап 3/4: тест 8/8 пройден. Теперь ищу все товары каталога.');
    urlAssignments.clear();

    for(const group of GROUPS){
      await nav(catalogTab.id,group.url);
      const discovered=await discoverSubgroups(catalogTab.id,group);

      const foundNames=new Set(discovered.map(x=>x.name));
      const missing=group.subgroups.filter(x=>!foundNames.has(x));
      if(missing.length){
        await state(
          `${group.name}: найдены ${discovered.length}/${group.subgroups.length} подгрупп.\n`+
          `Не найдены: ${missing.join(', ')}`
        );
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

    // Refresh final category metadata for the eight already-tested products.
    for(const url of sampleUrls){
      const p=productMap.get(url);
      if(p)attachMeta(p,url);
    }

    if(catalogTab?.id){
      try{await chrome.tabs.remove(catalogTab.id)}catch{}
      catalogTab=null;
    }

    // Already-tested products are NOT opened again.
    const remainingUrls=urls.filter(u=>!productMap.has(u));
    let nextIndex=0;
    let done=productMap.size;
    let ok=productMap.size;
    let fail=0;
    let lastSaved=productMap.size;

    await chrome.storage.local.set({
      products:[...productMap.values()],
      scanErrors:[],
      scanRuntime:{workers:workerTabs.length,done,total:urls.length},
      scanState:{
        message:
          `Этап 4/4: найдено ${urls.length} уникальных товаров. `+
          `Осталось обработать ${remainingUrls.length}. `+
          `Одновременно: ${workerTabs.length}.`,
        updated:Date.now()
      }
    });

    const saveBatch=async(force=false)=>{
      if(!force && productMap.size-lastSaved<10)return;
      lastSaved=productMap.size;
      await chrome.storage.local.set({
        products:[...productMap.values()],
        scanErrors:errors,
        scanRuntime:{workers:workerTabs.length,done,total:urls.length}
      });
    };

    const worker=async(tab,no)=>{
      while(true){
        const i=nextIndex++;
        if(i>=remainingUrls.length)return;
        const url=remainingUrls[i];

        try{
          const p=attachMeta(await loadAndParseProduct(tab.id,url),url);
          productMap.set(url,p);
          ok++;
          done++;
          await saveBatch(false);

          await state(
            `Поток ${no}/${workerTabs.length} • ${done}/${urls.length}\n`+
            `${p.name}\n`+
            `Характеристик: ${Object.keys(p.characteristics||{}).length} • `+
            `фото: ${(p.images||[]).length}\n`+
            `Успешно: ${ok} • ошибок: ${fail}`
          );
        }catch(e){
          fail++;
          done++;
          errors.push({url,error:e.message,phase:'main'});

          await chrome.storage.local.set({
            scanErrors:errors,
            scanRuntime:{workers:workerTabs.length,done,total:urls.length}
          });

          await state(
            `Поток ${no}/${workerTabs.length} • ${done}/${urls.length}\n`+
            `Ошибка: ${url}\n${e.message}\n`+
            `Успешно: ${ok} • ошибок: ${fail}`
          );
        }
      }
    };

    await Promise.all(workerTabs.map((tab,i)=>worker(tab,i+1)));

    // One retry pass for failures; only two tabs to reduce transient server pressure.
    const retryUrls=[...new Set(errors.map(x=>x.url))].filter(u=>!productMap.has(u));
    if(retryUrls.length){
      await state(`Основной проход закончен. Повторяю ${retryUrls.length} ошибок в 2 потока…`);
      let ri=0;

      const retryWorker=async tab=>{
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

      await Promise.all(
        workerTabs.slice(0,Math.min(2,workerTabs.length)).map(retryWorker)
      );
    }

    await saveBatch(true);

    const finalProducts=[...productMap.values()];
    const remaining=urls.filter(u=>!productMap.has(u));
    const byGroup={};
    for(const p of finalProducts){
      byGroup[p.sourceGroup]=(byGroup[p.sourceGroup]||0)+1;
    }

    await chrome.storage.local.set({
      products:finalProducts,
      scanErrors:remaining.map(url=>({url,error:'Не прочитан после повторной попытки'})),
      scanRuntime:{workers:workerTabs.length,done:urls.length,total:urls.length}
    });

    await state(
      `ГОТОВО.\n`+
      `Успешно: ${finalProducts.length}/${urls.length}\n`+
      `Не прочитано после повтора: ${remaining.length}\n`+
      `Параллельных карточек: ${workerTabs.length}\n`+
      Object.entries(byGroup).map(([k,v])=>`${k}: ${v}`).join('\n')
    );
  }catch(e){
    console.error(e);
    await state('Критическая ошибка быстрого сканирования: '+e.message);
  }finally{
    if(catalogTab?.id){
      try{await chrome.tabs.remove(catalogTab.id)}catch{}
    }
    for(const t of workerTabs){
      if(t?.id)try{await chrome.tabs.remove(t.id)}catch{}
    }
  }
}
