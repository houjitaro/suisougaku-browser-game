/* ブラウザ版第5段階：既存GameStart画面とローカルゲームロジックを接続。
 * GASの google.script.run の呼び出し形だけを再現し、通信は行わない。
 * UIを呼び出す側の既存関数はなるべく変更しない。
 */
(function(root){
'use strict';
const S=root.SuisougakuSave, C=root.SuisougakuGameCore, T=root.SuisougakuContest;
if(!S||!C||!T)throw Error('ブラウザ版の必要なJavaScriptが読み込まれていません。');
const copy=o=>JSON.parse(JSON.stringify(o));
function get(){const s=S.load();if(!s)throw Error('セーブデータがありません。タイトルからゲームを開始してください。');return s;}
function change(fn){const state=get(),result=fn(state);S.save(state);return result;}
function getRecruit(s){
 const h=s.history.find(x=>x.year===s.year);
 if(!h||!h.newMembers)return null;
 const m=s.members.filter(x=>x.year===s.year);
 const total=m.reduce((v,x)=>v+Number(x.effectivePower||0),0);
 return {year:s.year,bandName:s.player.bandName,prefecture:s.player.prefecture,branch:s.player.branch,
 memberCount:m.length,members:m,totalPower:total,ratingAfter:s.ui&&s.ui.recruit&&s.ui.recruit.year===s.year?s.ui.recruit.ratingAfter:s.player.rating,
 ratingBefore:s.ui&&s.ui.recruit&&s.ui.recruit.year===s.year?s.ui.recruit.ratingBefore:s.player.rating-total,
 totalCardCount:s.members.length};
}
function getEvent(s){
 const h=s.history.find(x=>x.year===s.year);if(!h||!h.bandEvent)return null;
 return s.ui&&s.ui.event&&s.ui.event.year===s.year?s.ui.event:{year:s.year,title:h.bandEvent,ratingBonus:0};
}
function doCall(method,args){
 switch(method){
 case 'savePlayerSettings': {
  const name=String(args[0]||'').trim(),pref=String(args[1]||'').trim();
  if(!name||!pref)throw Error('楽団名と都道府県を指定してください。');
  const branch=root.getBranch&&root.getBranch(pref);
  if(!T.branches.includes(branch))throw Error('支部が見つかりません：'+pref);
  if(S.hasSave()&&!root.confirm('既存のセーブを上書きして新しいゲームを開始しますか？'))throw Error('新規開始をキャンセルしました。');
  const s=S.createGame(name,pref,branch);s.ui={};S.save(s);
  return {bandName:name,prefecture:pref,branch:branch,year:1,rating:40};
 }
 case 'saveManagerSelection':return change(s=>C.selectManager(s,args[0]));
 case 'generateNewMembers':return change(s=>{
   const r=C.recruitNewMembers(s);s.ui=s.ui||{};
   const data={...r,prefecture:s.player.prefecture,branch:s.player.branch,totalCardCount:s.members.length};
   s.ui.recruit=copy(data);return data;
 });
 case 'generateBandEvent':return change(s=>{
   const r=C.drawBandEvent(s);s.ui=s.ui||{};s.ui.event={...r,year:s.year};return r;
 });
 case 'simulateBranchContestWeb':return change(s=>T.branchContest(s));
 case 'getNationalProgramDataWeb':return change(s=>{
  const program=T.nationalProgram(s);s.scene='national_program';return program;
 });
 case 'runNationalContest':return change(s=>T.nationalContest(s).bands);
 case 'getPlayerHistory':{
  const s=get(),f=T.finalHistory(s),manager=C.managers().find(x=>x.id===s.player.managerId)||null;
  return {...f,manager:manager,managerJoined:!!manager};
 }
 case 'advanceToNextYear':return change(s=>{
  const next=T.nextYear(s);
  if(next.gameOver)return next;
  const r=C.recruitNewMembers(s);s.ui=s.ui||{};
  s.ui.recruit={...r,prefecture:s.player.prefecture,branch:s.player.branch,totalCardCount:s.members.length};
  s.ui.event=null;
  return {...next,newMemberData:s.ui.recruit};
 });
 default:throw Error('ブラウザ版で未対応の操作：'+method);
 }
}
// チェーンごとにコールバックを独立させる。処理はマイクロタスクに置き、既存のGAS画面遷移を維持。
function chain(success,failure){
 return new Proxy({}, {get(_target,prop){
   if(prop==='withSuccessHandler')return fn=>chain(fn,failure);
   if(prop==='withFailureHandler')return fn=>chain(success,fn);
   if(prop==='then')return undefined;
   return (...args)=>{
     Promise.resolve().then(()=>doCall(String(prop),args)).then(result=>{
       if(typeof success==='function')success(result);
     }).catch(error=>{
       console.error('BrowserUiBridge',String(prop),error);
       if(typeof failure==='function')failure(error);else root.alert(error.message);
     });
   };
 }});
}
root.google={script:{run:chain(null,null)}};
function download(){const text=S.exportJson(),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='suisougaku_save_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function renderState(s){
 if(!s)return;
 // ページ再読込直後はタイトル画面が初期表示される。
 // 復元画面の上に残らないよう、通常の「楽団結成」と同じ表示状態へ移行する。
 const title=document.getElementById('titleScreen');
 if(title)title.style.display='none';
 const setup=document.getElementById('setupScreen');
 if(setup)setup.style.display='none';
 document.body.classList.remove('setup-mode','manager-mode');
 root.gameUiState={bandName:s.player.bandName,prefecture:s.player.prefecture,branch:s.player.branch,year:s.year,rating:s.player.rating,cardCount:s.members.length};
 root.pendingPlayerData={bandName:s.player.bandName,prefecture:s.player.prefecture,branch:s.player.branch};
 const mgr=C.managers().find(x=>x.id===s.player.managerId);
 if(mgr)root.pendingManager={...mgr,imageUrl:'https://raw.githubusercontent.com/kotetsuinu/suisougaku-game-assets/main/'+{MGR01:'manager_cat_normal.webp',MGR02:'manager_giraffe_normal.webp',MGR03:'manager_tanuki_normal.webp'}[mgr.id]};
 const b=s.contests.branch,n=s.contests.national;
 if(s.status==='completed'){root.renderFiveYearFinal(doCall('getPlayerHistory',[]));return;}
 if(!s.player.managerId){root.showManagerSelection();return;}
 if(n){root.showNationalResultsWeb(n.bands);return;}
 // 全国大会プログラムを既に開いた場合は同じ演奏順を直接復元する。
 if(b&&b.qualified&&s.scene==='national_program'&&s.contests.nationalProgram){
   root.showNationalProgramWeb(s.contests.nationalProgram);return;
 }
 if(b){root.branchResultData=b;root.showBranchResult(b);return;}
 const e=getEvent(s);
 if(e){
   // showBandEvent() はRatingボーナスを画面用状態に加算するため、
   // 復元時はボーナス適用前の値をセットして二重表示を防ぐ。
   root.gameUiState.rating=Number.isFinite(Number(e.ratingBefore))?Number(e.ratingBefore):Number(s.player.rating)-Number(e.ratingBonus||0);
   root.showBandEvent(e);return;
 }
 const r=getRecruit(s);if(r){root.showNewMembers(r);return;}
 // マネージャー決定後、初年度の募集前で保存された場合
 if(mgr){
   root.showManagerSelection();
   root.pendingManager={...root.pendingManager,id:mgr.id};
   root.showManagerIntro(root.pendingManager);
 }
}
function makeOverlay(){
 const existing=document.getElementById('browserSavePanel');if(existing)existing.remove();
 const wrap=document.createElement('section');wrap.id='browserSavePanel';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-label','セーブデータ');
 wrap.style.cssText='position:fixed;z-index:2147483646;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(27,22,16,.75);padding:16px;box-sizing:border-box;font-family:serif;color:#33291e';
 const card=document.createElement('div');card.style.cssText='width:min(95vw,480px);max-height:90vh;overflow:auto;padding:26px;background:#f3e6c9;border:2px solid #aa8954;border-radius:10px;box-shadow:0 10px 45px #0006;text-align:center';
 const title=document.createElement('h2');title.textContent='保存済みの楽団があります';title.style.cssText='font-size:24px;margin:0 0 14px';card.append(title);
 const info=S.info(),line=document.createElement('p');line.textContent=info.bandName+' ／ '+info.year+'年目'+(info.status==='completed'?'（終了）':'');card.append(line);
 function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='start-button';b.style.cssText='display:block;width:100%;margin:10px auto;min-height:48px;cursor:pointer';b.onclick=action;card.append(b);return b;}
 button('続きから再開',()=>{wrap.remove();try{renderState(get());}catch(e){root.alert('復元エラー：'+e.message);}});
 button('新しい楽団で始める',()=>{if(!root.confirm('新しいゲームを始めると、現在のセーブは上書きされます。先に「セーブを書き出す」でバックアップできます。続けますか？'))return;wrap.remove();if(document.getElementById('setupScreen')){root.openBandSetup();}else{S.clear();root.location.reload();}});
 button('セーブJSONを書き出す',()=>{try{download();}catch(e){root.alert(e.message);}});
 const label=document.createElement('label');label.textContent='セーブJSONを読み込む';label.style.cssText='display:block;margin-top:15px;font-weight:bold';
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.style.cssText='display:block;width:100%;margin:8px auto';
 input.onchange=async()=>{const f=input.files&&input.files[0];if(!f)return;try{const t=await f.text();if(!root.confirm('現在のセーブを上書きして読み込みますか？'))return;S.importJson(t);wrap.remove();renderState(get());}catch(e){root.alert('読み込み失敗：'+e.message);}finally{input.value='';}};
 label.append(input);card.append(label);wrap.append(card);document.body.append(wrap);
}
function refreshTitleResume(){
 const b=document.getElementById('browserTitleResumeButton');
 if(!b)return;
 try{
  const info=S.info();
  if(!info){b.style.display='none';return;}
  b.textContent=info.status==='completed'?'前回の結果を見る':'続きから再開';
  b.style.display='block';
 }catch(err){b.style.display='none';console.error('セーブ表示の更新に失敗',err);}
}
function resumeSavedGame(){
 try{if(!S.hasSave())throw Error('セーブデータがありません。');renderState(get());}
 catch(e){root.alert('復元エラー：'+e.message);}
}
root.SuisougakuBrowserUI=Object.freeze({renderState,showSaveMenu:makeOverlay,downloadSave:download,load:get,refreshTitleResume,resumeSavedGame});
root.addEventListener('DOMContentLoaded',()=>{
 const btn=document.createElement('button');btn.id='browserSaveMenuButton';btn.textContent='セーブ管理';btn.type='button';btn.setAttribute('aria-label','セーブ管理を開く');
 btn.style.cssText='position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));z-index:2147483645;background:#5c4934;color:white;border:1px solid #e6d5b2;border-radius:22px;padding:9px 15px;font:600 13px sans-serif;box-shadow:0 3px 12px #0005;cursor:pointer';
 btn.onclick=()=>{try{if(S.hasSave())makeOverlay();else root.alert('まだセーブデータがありません。');}catch(e){root.alert(e.message);}};
 document.documentElement.append(btn);
 // 起動時はタイトルを表示する。保存済みの選択画面は自動で開かない。
 refreshTitleResume();
});
})(window);
