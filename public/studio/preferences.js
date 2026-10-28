export function studioSettingsScope({hasGame=false,choice='',insightType=''}){
  if(!hasGame)return 'default';
  if(choice==='insight'&&insightType)return `insight:${insightType}`;
  return choice?`template:${choice}`:'default';
}

export function studioSettingsKey(organization,scope='default'){
  return `hms-studio:settings:v2:${organization}:${scope}`;
}

export function studioAssetKey(settingsKey,kind){
  return `${settingsKey}:asset:${kind}`;
}

const databaseName='hms-studio-assets-v1',storeName='assets';
function database(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB)return reject(new Error('IndexedDB unavailable'));
    const request=indexedDB.open(databaseName,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('IndexedDB unavailable'));
  });
}
async function transaction(mode,action){
  const db=await database();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode),request=action(tx.objectStore(storeName));let result=null;
    request.onsuccess=()=>{result=request.result??null;};
    request.onerror=()=>reject(request.error??new Error('IndexedDB write failed'));
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(tx.error??new Error('IndexedDB transaction failed'));
  });}finally{db.close();}
}
export const loadStudioAsset=key=>transaction('readonly',store=>store.get(key));
export const saveStudioAsset=(key,value)=>transaction('readwrite',store=>store.put(value,key));
export const removeStudioAsset=key=>transaction('readwrite',store=>store.delete(key));
