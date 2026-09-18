const s=document.getElementById('status');
const workersEl=document.getElementById('workers');
const updateStatus=document.getElementById('updateStatus');
const checkUpdateBtn=document.getElementById('checkUpdate');
const installUpdateBtn=document.getElementById('installUpdate');
const copyIdBtn=document.getElementById('copyId');
const extensionIdEl=document.getElementById('extensionId');
const HOST='com.labbo.alta_profil_scanner_updater';

if(extensionIdEl) extensionIdEl.textContent=chrome.runtime.id;

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

function compareVersions(a,b){
 const pa=String(a||'').split('.').map(n=>parseInt(n,10)||0);
 const pb=String(b||'').split('.').map(n=>parseInt(n,10)||0);
 const len=Math.max(pa.length,pb.length);
 for(let i=0;i<len;i++){
  const x=pa[i]||0,y=pb[i]||0;
  if(x>y)return 1;
  if(x<y)return -1;
 }
 return 0;
}

function nativeMessage(message){
 return new Promise((resolve,reject)=>{
  chrome.runtime.sendNativeMessage(HOST,message,response=>{
   const err=chrome.runtime.lastError;
   if(err){reject(new Error(err.message));return}
   if(!response){reject(new Error('Updater не вернул ответ'));return}
   resolve(response);
  });
 });
}

async function installUpdate(target='новую'){
 if(updateStatus)updateStatus.textContent=`Нашёл версию ${target}. Устанавливаю… Не закрывай браузер.`;
 if(checkUpdateBtn)checkUpdateBtn.disabled=true;
 if(installUpdateBtn)installUpdateBtn.disabled=true;
 try{
  const r=await nativeMessage({action:'update'});
  if(!r.ok)throw new Error(r.error||'Неизвестная ошибка updater');
  if(updateStatus)updateStatus.textContent=`Версия ${r.remoteVersion||target} установлена. Перезапускаю расширение…`;
  setTimeout(()=>chrome.runtime.reload(),700);
 }catch(e){
  if(updateStatus)updateStatus.textContent='Ошибка обновления: '+(e.message||e);
  if(checkUpdateBtn)checkUpdateBtn.disabled=false;
  if(installUpdateBtn)installUpdateBtn.disabled=false;
 }
}

async function checkUpdate(){
 const local=chrome.runtime.getManifest().version;
 if(updateStatus)updateStatus.textContent='Проверяю GitHub…';
 if(checkUpdateBtn)checkUpdateBtn.disabled=true;
 if(installUpdateBtn)installUpdateBtn.style.display='none';
 try{
  const r=await nativeMessage({action:'check'});
  if(!r.ok)throw new Error(r.error||'Неизвестная ошибка updater');
  const remote=r.remoteVersion||'';
  if(compareVersions(remote,local)>0){
   await installUpdate(remote);
   return;
  }
  if(updateStatus)updateStatus.textContent=`Установлена актуальная версия ${local}.`;
 }catch(e){
  const msg=String(e.message||e);
  if(updateStatus){
   updateStatus.textContent=
    'Автообновление ещё не подключено. Один раз запусти INSTALL_UPDATER.bat из папки расширения, затем обнови расширение в browser://extensions.\n\n'+msg;
  }
 }finally{
  if(checkUpdateBtn && !checkUpdateBtn.disabled)checkUpdateBtn.disabled=false;
  else if(updateStatus && updateStatus.textContent.startsWith('Установлена актуальная'))checkUpdateBtn.disabled=false;
 }
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
 const workers=Math.max(1,Math.min(8,Number(workersEl.value)||8));
 send({type:'scanAllFast',workers});
};
document.getElementById('photoUpdate').onclick=()=>send({type:'export',format:'photo-update'});
document.getElementById('json').onclick=()=>send({type:'export',format:'json'});
document.getElementById('yml').onclick=()=>send({type:'export',format:'yml'});
document.getElementById('csv').onclick=()=>send({type:'export',format:'csv'});
if(checkUpdateBtn)checkUpdateBtn.onclick=checkUpdate;
if(installUpdateBtn)installUpdateBtn.onclick=()=>installUpdate(installUpdateBtn.dataset.version||'новую');
if(copyIdBtn)copyIdBtn.onclick=async()=>{
 try{
  await navigator.clipboard.writeText(chrome.runtime.id);
  copyIdBtn.textContent='ID скопирован';
  setTimeout(()=>copyIdBtn.textContent='Скопировать ID',1200);
 }catch{}
};

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
