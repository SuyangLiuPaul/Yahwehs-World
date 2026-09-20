// In-page runner for the event pictures. Paste into the console (or the Chrome tool's
// javascript_exec) of a ChatGPT conversation that already has the three reference pictures
// attached to its FIRST message, then:  __R.run(rows)  where a row is
//   [id, zh title, en title, refZh, one-line summary, optional filename suffix]
// (rows come from tools/scenes/build_queue.py --compact). It sends one prompt, waits for
// the picture, saves it as <id><suffix>.png through the browser's downloads, pauses 25-75 s,
// and goes on. It stops (never retries blindly) on a timeout, a rate-limit message or a
// send failure, and __R.log holds one record per picture (also in localStorage.__Rlog).
// One picture at a time on purpose: it is the owner's own account, used the way its
// page is used, slowly. Every saved picture is then looked at by a person or by Claude and
// redone if the text, the hair, the era or the story is wrong.

(()=>{
if(window.__R){return 'exists'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R={log:[],halted:null,busy:false,min:25,max:75};
R.tpl=(r)=>{const [id,zh,en,ref,sm]=r;return `Make the next picture in the same style as the three reference pictures in this chat: an isometric three-quarter top-down Minecraft-like voxel / chamfered-block diorama game screen, warm golden light, painterly soft shading, dense lively detail, tiny blocky people and animals, rich props, 16:9 landscape. Bible event: "${en}" (${ref}). Chinese title: ${zh}. Illustrate this event faithfully as a concrete scene. If the passage is a letter, a law, a psalm, a prophecy or a list, draw what it is about as a real scene with people and objects. Keep the same screen layout as the references: title with a small icon at top-left (Chinese title large, English title smaller under it), a parchment card beneath it, resource counters and two round buttons at top-right, and a row of three wooden buttons at the bottom. Text in the picture must be spelled exactly: title "${zh}" and "${en}"; the card shows "${ref}" and the line "${sm}"; the counters show 320, 180, 240; the three bottom buttons read "探索 Explore", "人物 People", "地图 Map". No other text anywhere. Rules: every man has short hair; ancient Near-Eastern clothing, nothing modern. Jesus, if the event has him, is shown with short hair, gentle and majestic. God, if the event has him, is shown as a kind and majestic figure in radiant light, or as light and cloud alone.`};
const gen=()=>[...document.querySelectorAll('img')].filter(i=>(i.alt||'').startsWith('Generated image'));
const stopBtn=()=>document.querySelector('[data-testid="stop-button"]');
const lastText=()=>{const a=[...document.querySelectorAll('[data-message-author-role="assistant"]')].pop();return a?a.innerText:''};
async function sendText(t){const ta=document.querySelector('#prompt-textarea');ta.focus();document.execCommand('selectAll',false);document.execCommand('insertText',false,t);await sleep(1200);
 for(let k=0;k<40;k++){const b=document.querySelector('[data-testid="send-button"]');if(b&&!b.disabled){b.click();return true}await sleep(500)}return false}
async function waitDone(n0,ms){const t0=Date.now();let idle=0;
 while(Date.now()-t0<ms){await sleep(5000);
  const done=!stopBtn();const n=gen().length;
  if(done&&n>n0){idle++;if(idle>=3)return 'image'}
  else if(done){idle++;if(idle>=10)return /limit|too many|later|come back/i.test(lastText())?'limit':'noimage'}
  else idle=0}
 return 'timeout'}
async function save(name){const im=gen().pop();const r=await fetch(im.src,{credentials:'include'});const b=await r.blob();
 let w=0,h=0;try{const bm=await createImageBitmap(b);w=bm.width;h=bm.height}catch(e){}
 if(!b.type.startsWith('image')||b.size<150000)return {ok:false,size:b.size,type:b.type,w,h};
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();return {ok:true,size:b.size,w,h}}
R.run=async function(rows){if(R.busy)return 'busy';R.busy=true;R.halted=null;
 for(const r of rows){if(R.halted)break;
  const t0=Date.now();const n0=gen().length;
  if(!(await sendText(R.tpl(r)))){R.log.push({id:r[0],st:'nosend'});R.halted='nosend';break}
  const st=await waitDone(n0,15*60000);
  const rec={id:r[0],st,sec:Math.round((Date.now()-t0)/1000)};
  if(st==='image'){await sleep(2500);Object.assign(rec,await save(r[0]+(r[5]||'')+'.png'))}else rec.text=lastText().slice(0,200);
  R.log.push(rec);try{localStorage.setItem('__Rlog',JSON.stringify(R.log))}catch(e){}
  if(st==='timeout'||st==='limit'){R.halted=st;break}
  await sleep((R.min+Math.random()*(R.max-R.min))*1000)}
 R.busy=false;return 'finished'};
window.__R=R;return 'ready'})()
