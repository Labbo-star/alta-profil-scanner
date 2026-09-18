const s=document.getElementById('status');
const workersEl=document.getElementById('workers');

function parseCSV(text,delimiter=';'){
 const rows=[];let row=[],field='',q=false;
 for(let i=0;i<text.length;i++){
  const c=text[i],n=text[i+1];
  if(q){
   if(c==='"'&&n==='"'){field+='"';i++}
   else if(c==='"'){q=false}
   else field+=c;
  }else{
   if(c==='"')q=true;
   else if(c===delimiter){row.push(field);field=''}
   else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}
   else field+=c;
  }
 }
 if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}
 return rows;
}

async function upd(){
 const r=await chrome.storage.local.get([
   'products','scanState','scanStats','tildaCatalogRows','scanRuntime','scanErrors'
 ]);
 const products=r.products||[];
 const groupCounts={};
 let totalPhotos=0,one=0,two=0,threePlus=0,zero=0,maxPhotos=0;
 for(const p of products){
  const g=p.sourceGroup||'Без группы';
  groupCounts[g]=(groupCounts[g]||0)+1;
  const n=(p.images||[]).length;
  totalPhotos+=n;maxPhotos=Math.max(maxPhotos,n);
  if(n===0)zero++; else if(n===1)one++; else if(n===2)two++; else threePlus++;
 }
 const stat=Object.entries(groupCounts).map(([k,v])=>`${k}: ${v}`).join('\n');
 const avg=products.length?(totalPhotos/products.length).toFixed(2):'0';
 const tildaCount=(r.tildaCatalogRows||[]).length;
 const rt=r.scanRuntime||{};
 const perf=rt.total?`\nПрогресс: ${rt.done||0}/${rt.total} | потоков: ${rt.workers||0}`:'';
 const errs=(r.scanErrors||[]).length;

 s.textContent=
  `Товаров сохранено: ${products.length}${stat?'\n'+stat:''}${perf}\n`+
  `Ошибок в очереди: ${errs}\n`+
  `Фото: всего ${totalPhotos}, среднее ${avg}, максимум ${maxPhotos}\n`+
  `0 фото: ${zero} | 1 фото: ${one} | 2 фото: ${two} | 3+ фото: ${threePlus}\n`+
  `CSV Tilda загружен: ${tildaCount}\n\n`+
  `${r.scanState?.message||'Готов.'}`;
}
upd();
chrome.storage.onChanged.addListener(upd);

async function send(msg){
 try{await chrome.runtime.sendMessage(msg)}
 catch(e){s.textContent='Ошибка связи с расширением:\n'+e.message}
}

document.getElementById('scanAll').onclick=()=>{
 const workers=Math.max(2,Math.min(4,Number(workersEl.value)||4));
 send({type:'scanAll',workers});
};
document.getElementById('photoUpdate').onclick=()=>send({type:'export',format:'photo-update'});
document.getElementById('json').onclick=()=>send({type:'export',format:'json'});
document.getElementById('yml').onclick=()=>send({type:'export',format:'yml'});
document.getElementById('csv').onclick=()=>send({type:'export',format:'csv'});

document.getElementById('file').addEventListener('change',async e=>{
 const f=e.target.files?.[0]; if(!f)return;
 const text=await f.text();
 const table=parseCSV(text,';');
 if(!table.length){alert('CSV пустой');return}
 const h=table[0].map(x=>x.trim());
 const uidI=h.indexOf('Tilda UID'),titleI=h.indexOf('Title'),catI=h.indexOf('Category');
 if(uidI<0||titleI<0){
  alert('В CSV не найдены колонки Tilda UID и Title');
  return;
 }
 const rows=table.slice(1).filter(r=>r[uidI]&&r[titleI]).map(r=>({
   uid:(r[uidI]||'').trim(),
   title:(r[titleI]||'').trim(),
   category:catI>=0?(r[catI]||'').trim():''
 }));
 await chrome.storage.local.set({tildaCatalogRows:rows});
 await upd();
});

document.getElementById('clear').onclick=async()=>{
 if(confirm('Очистить локальную базу расширения?')){
  await chrome.storage.local.set({
   products:[],scanStats:[],scanErrors:[],scanRuntime:{},tildaCatalogRows:[],
   scanState:{message:'База очищена.',updated:Date.now()}
  });
  upd();
 }
};
