// One NEW ChatGPT chat per picture (long chats stall; a fresh one is more stable). Paste into the page of any
// chatgpt.com tab via javascript_exec, then:  __R2.run(rows)   (row = [id, zh, en, refZh, summary, suffix?, note?]).
// The three reference pictures are re-fetched from the owner's own first chat (their attachment ids are in
// __R2.refIds) and attached to every new chat through the page's own file input, so no file ever leaves the browser.
// Per row: click "New chat" (client-side navigation, so this script survives) -> attach refs -> send the prompt ->
// wait for the picture -> save <id>.png to ~/Downloads -> pause. Stops on a limit message; gives up after 3 failures in a row.
(()=>{
if(window.__R2){return 'exists'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R={log:[],halted:null,busy:false,min:20,max:60,stallMin:6,files:null,fails:0,
 refIds:["file_0000000072fc81fa82b8b798360da03b","file_000000002378820bbfd8a87a0c18dfd2","file_000000006324820b822da55798fe9668"],
 refNames:["ref-ark.jpg","ref-a.jpg","ref-b.jpg"]};
R.tpl=(r)=>{const [id,zh,en,ref,sm]=r;return `Make the next picture in the same style as the three reference pictures in this chat: an isometric three-quarter top-down Minecraft-like voxel / chamfered-block diorama game screen, warm golden light, painterly soft shading, dense lively detail, tiny blocky people and animals, rich props, 16:9 landscape. Bible event: "${en}" (${ref}). Chinese title: ${zh}. Illustrate this event faithfully as a concrete scene. If the passage is a letter, a law, a psalm, a prophecy or a list, draw what it is about as a real scene with people and objects. Keep the same screen layout as the references: title with a small icon at top-left (Chinese title large, English title smaller under it), a parchment card beneath it, resource counters and two round buttons at top-right, and a row of three wooden buttons at the bottom. Text in the picture must be spelled exactly: title "${zh}" and "${en}"; the card shows "${ref}" and the line "${sm}"; the counters show 320, 180, 240; the three bottom buttons read "探索 Explore", "人物 People", "地图 Map". No other text anywhere. Rules: every man has short hair; ancient Near-Eastern clothing, nothing modern; every person has exactly two legs and two feet. Jesus, if the event has him, is shown with short hair cut above the ears and collar, gentle and majestic. God, if the event has him, is shown as a kind and majestic figure in radiant light, or as light and cloud alone.`+(r[6]?' '+r[6]:'')};
const gen=()=>[...document.querySelectorAll('img')].filter(i=>(i.alt||'').startsWith('Generated image'));
const stopBtn=()=>document.querySelector('[data-testid="stop-button"]');
const lastText=()=>{const a=[...document.querySelectorAll('[data-message-author-role="assistant"]')].pop();return a?a.innerText:''};
R.loadRefs=async()=>{
 const s=await (await fetch('/api/auth/session',{credentials:'include'})).json();
 const H={Authorization:'Bearer '+s.accessToken};const files=[];
 for(let i=0;i<R.refIds.length;i++){
  const j=await (await fetch('/backend-api/files/'+R.refIds[i]+'/download',{headers:H,credentials:'include'})).json();
  const b=await (await fetch(j.download_url)).blob();
  if(!b.type.startsWith('image'))throw new Error('ref '+i+' not an image');
  files.push(new File([b],R.refNames[i],{type:b.type}));}
 R.files=files;return files.map(f=>f.size)};
async function newChat(){
 const a=document.querySelector('a[data-testid="create-new-chat-button"]');if(!a)return false;a.click();
 for(let k=0;k<40;k++){await sleep(500);if(location.pathname==='/'&&document.querySelector('#prompt-textarea')&&gen().length===0)break}
 await sleep(1500);return location.pathname==='/'}
async function attach(){
 const inp=document.querySelector('#upload-files');if(!inp)return false;
 const dt=new DataTransfer();R.files.forEach(f=>dt.items.add(f));inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
 const form=document.querySelector('#prompt-textarea').closest('form');
 for(let k=0;k<60;k++){await sleep(1000);if(form.querySelectorAll('img').length>=3)break}
 await sleep(5000);return form.querySelectorAll('img').length>=3}
async function sendText(t){const ta=document.querySelector('#prompt-textarea');ta.focus();document.execCommand('selectAll',false);document.execCommand('insertText',false,t);await sleep(1200);
 for(let k=0;k<40;k++){const b=document.querySelector('[data-testid="send-button"]');if(b&&!b.disabled){b.click();return true}await sleep(500)}return false}
async function waitDone(n0,ms){const t0=Date.now();let idle=0;
 while(Date.now()-t0<ms){await sleep(5000);
  const done=!stopBtn();const n=gen().length;
  if(done&&n>n0){idle++;if(idle>=3)return 'image'}
  else if(done){idle++;if(idle>=10)return /limit|too many|later|come back/i.test(lastText())?'limit':'noimage'}
  else{idle=0;if(Date.now()-t0>R.stallMin*60000)return 'stall'}}
 return 'timeout'}
async function saveImg(im,name){const r=await fetch(im.src,{credentials:'include'});const b=await r.blob();
 let w=0,h=0;try{const bm=await createImageBitmap(b);w=bm.width;h=bm.height}catch(e){}
 if(!b.type.startsWith('image')||b.size<150000)return {ok:false,size:b.size,type:b.type,w,h};
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();return {ok:true,size:b.size,w,h}}
R.saveLast=(name)=>saveImg(gen().pop(),name);
R.run=async function(rows){if(R.busy)return 'busy';R.busy=true;R.halted=null;
 try{if(!R.files)await R.loadRefs()}catch(e){R.halted='refs';R.busy=false;return 'refs: '+e}
 for(const r of rows){if(R.halted)break;
  const t0=Date.now();const rec={id:r[0]};
  if(!(await newChat())){rec.st='nonewchat';R.log.push(rec);R.halted='nonewchat';break}
  if(!(await attach())){rec.st='noattach';R.log.push(rec);if(++R.fails>=3){R.halted='noattach';break}continue}
  const n0=gen().length;
  if(!(await sendText(R.tpl(r)))){rec.st='nosend';R.log.push(rec);R.halted='nosend';break}
  const st=await waitDone(n0,12*60000);rec.st=st;rec.url=location.pathname;rec.sec=Math.round((Date.now()-t0)/1000);
  if(st==='image'||gen().length>n0){await sleep(2500);try{Object.assign(rec,await saveImg(gen().pop(),r[0]+(r[5]||'')+'.png'))}catch(e){rec.err=String(e)}}
  else rec.text=lastText().slice(0,200);
  R.log.push(rec);try{localStorage.setItem('__R2log',JSON.stringify(R.log))}catch(e){}
  if(st==='limit'){R.halted='limit';break}
  if(rec.ok){R.fails=0}else if(++R.fails>=3){R.halted='fails';break}
  await sleep((R.min+Math.random()*(R.max-R.min))*1000)}
 R.busy=false;return 'finished'};
window.__R2=R;return 'ready'})()
