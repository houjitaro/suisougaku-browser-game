/* 吹奏楽ゲーム・大会処理のブラウザ移植（第4段階）
 * 元 Code.gs の支部・全国大会の判定規則を維持。
 * 呼び出し側は state を複製して本関数を実行し、成功したらセーブすること。
 * GASやスプレッドシートへのアクセスなし。
 */
(function(root){
'use strict';
const BRANCHES=['北海道','東北','東関東','西関東','東京','北陸','東海','関西','中国','四国','九州'];
function masters(){const m=root.SuisougakuMasters;if(!m||!m.quotas||!m.npcBands||!m.srBands||!m.pieces)throw Error('GameMasters.jsが読み込まれていません。');return m;}
function required(){const r=root.SuisougakuRequiredPieces;if(!r||!r.length)throw Error('RequiredPieces.jsが読み込まれていません。');const p=r[Math.floor(Math.random()*r.length)];return p.title+'（'+p.year+'年度 課題曲'+p.no+'）／'+p.composer;}
function normal(){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function weighted(pieces){let total=0;for(const p of pieces)total+=p.weight;let r=Math.random()*total;for(const p of pieces){if(r<p.weight)return p;r-=p.weight;}return pieces[pieces.length-1];}
function boost(r){const roll=Math.random();if(r<=25){if(roll<.02)return {bonus:12+Math.random()*6,label:'快演'};if(roll<.12)return {bonus:6+Math.random()*4,label:'好演'};}
else if(r<=35){if(roll<.015)return {bonus:10+Math.random()*6,label:'快演'};if(roll<.075)return {bonus:5+Math.random()*4,label:'好演'};}
else if(r<=45){if(roll<.005)return {bonus:9+Math.random()*5,label:'快演'};if(roll<.035)return {bonus:4+Math.random()*4,label:'好演'};}return {bonus:0,label:''};}
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function pickSR(branch,m){const hit=m.srBands.filter(s=>s.branch===branch && Math.random()<s.appearanceRate);return hit.length?hit[Math.floor(Math.random()*hit.length)]:null;}
function srRep(sr,branch,m){const options=m.pieces.filter(p=>sr.pieceIds.includes(p.id));if(!options.length)throw Error(sr.name+'の自由曲候補がありません。');const piece=options[Math.floor(Math.random()*options.length)];return {branch,branchRank:'SR',id:sr.id,name:sr.name,type:'SR',requiredPiece:required(),pieceId:piece.id,pieceName:piece.name,composer:piece.composer,prefecture:sr.prefecture};}
function toRep(p,branch){return {branch,branchRank:p.branchRank,id:p.band.id,name:p.band.name,type:p.band.isPlayer?'PLAYER':'NPC',requiredPiece:p.requiredPiece,pieceId:p.piece.id,pieceName:p.piece.name,composer:p.piece.composer,prefecture:p.band.prefecture||''};}
function requireState(s){if(!s||s.status!=='in_progress'||!Number.isInteger(s.year)||s.year<1||s.year>5||!s.player||!s.contests||!Array.isArray(s.history))throw Error('有効な進行中データではありません。');if(!BRANCHES.includes(s.player.branch))throw Error('支部が不正です。');}
function history(s){let h=s.history.find(x=>x.year===s.year);if(!h){h={year:s.year,newMembers:0,bandEvent:'',branchResult:'',nationalResult:''};s.history.push(h);s.history.sort((a,b)=>a.year-b.year);}return h;}
function requireReady(s){requireState(s);const h=history(s);if(!h.newMembers||!h.bandEvent)throw Error('先に新人募集とバンドイベントを完了してください。');return h;}
function simulateOneBranch(branch,s,playerIncluded){const m=masters(),quota=Number(m.quotas[branch]);if(!Number.isInteger(quota)||quota<2)throw Error(branch+'の代表枠が不正です。');
const bands=m.npcBands.filter(b=>b.branch===branch).map(b=>({...b,isPlayer:false}));
if(playerIncluded)bands.push({id:'PLAYER',name:s.player.bandName,prefecture:s.player.prefecture,branch,rating:Number(s.player.rating),isPlayer:true});
if(bands.length<quota)throw Error(branch+'の団体数が代表枠より少なくなっています。');
// プレイヤーが所属する支部ではSR団体を登場させない。他支部では従来どおり抽選する。
const sr=branch===s.player.branch?null:pickSR(branch,m),normalQuota=quota-(sr?1:0);if(normalQuota<1)throw Error('通常代表枠がありません。');
const performances=bands.map(b=>{const p=weighted(m.pieces),nb=b.isPlayer?{bonus:0,label:''}:boost(b.rating),variation=normal()*12+nb.bonus;
return {band:b,requiredPiece:required(),piece:p,variation,npcPerformanceBoost:nb.bonus,performanceLabel:nb.label,
score:b.rating+p.bonus+variation+(b.isPlayer&&s.year===1?-8:0),award:'',representative:false};}).sort((a,b)=>b.score-a.score);
const border=performances[normalQuota-1].score;
performances.forEach((p,i)=>{if(i<normalQuota){p.award='金賞';p.representative=true;p.branchRank=i+1;}
else{const gap=border-p.score;p.award=gap<=8?'金賞':gap<=22?'銀賞':'銅賞';}});
// プレイヤー支部だけ「代表数+2団体」の最低金賞保証（元Code.gs）。
if(playerIncluded){const gold=performances.filter(p=>p.award==='金賞').length+(sr?1:0);let remaining=quota+2-gold;
for(const p of performances){if(remaining<=0)break;if(!p.representative&&p.award!=='金賞'){p.award='金賞';remaining--;}}}
const reps=performances.filter(p=>p.representative).map(p=>toRep(p,branch));
if(sr)reps.unshift(srRep(sr,branch,m));
if(reps.length!==quota)throw Error(branch+'の代表数が不正です。');
return {branch,quota,sr:sr?sr.id:null,performances,representatives:reps,player:performances.find(p=>p.band.isPlayer)||null};}
function orderNational(reps){if(reps.length!==26)throw Error('全国代表が26団体ではありません：'+reps.length);const groups={};for(const b of reps){(groups[b.branch]||(groups[b.branch]=[])).push({...b});}
const first=[],second=[],three=[];for(const branch of BRANCHES){const g=shuffle(groups[branch]||[]);if(g.length===2){first.push(g[0]);second.push(g[1]);}else if(g.length===3){three.push(g);}else throw Error(branch+'の代表数が2または3ではありません。');}
const shuffled=shuffle(three);if(shuffled.length!==4)throw Error('3代表支部の数が4ではありません。');shuffled.forEach((g,i)=>{if(i<2){first.push(g[0],g[1]);second.push(g[2]);}else{first.push(g[0]);second.push(g[1],g[2]);}});
if(first.length!==13||second.length!==13)throw Error('全国大会の前半・後半の団体数が不正です。');
function penalty(a){let n=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i].branch===a[j].branch){const d=j-i;n+=d===1?100:d===2?30:d===3?10:0;}return n;}
function balanced(a){let best=null,min=Infinity;for(let i=0;i<1000;i++){const t=shuffle(a),p=penalty(t);if(p<min){best=t;min=p;}if(min===0)break;}return best;}
const f=balanced(first),s=balanced(second);f.forEach((b,i)=>{b.session='前半';b.performanceOrder=i+1;});s.forEach((b,i)=>{b.session='後半';b.performanceOrder=i+1;});return {first:f,second:s};}
function branchContest(state){const h=requireReady(state);if(state.contests.branch)throw Error('今年の支部大会は実施済みです。');
const m=masters(),r=simulateOneBranch(state.player.branch,state,true),p=r.player;
const gold=[...r.performances.filter(x=>x.award==='金賞').map(x=>({id:x.band.id,name:x.band.name,type:x.band.isPlayer?'PLAYER':'NPC',requiredPiece:x.requiredPiece,pieceName:x.piece.name,composer:x.piece.composer,isPlayer:!!x.band.isPlayer})),
...(r.sr? r.representatives.filter(x=>x.type==='SR').map(x=>({id:x.id,name:x.name,type:'SR',requiredPiece:x.requiredPiece,pieceName:x.pieceName,composer:x.composer,isPlayer:false})):[])];
// 既定は1～20番。金賞が20団体を超える例外時も演奏順が欠落しないよう拡張。
const branchOrder=shuffle(Array.from({length:Math.max(20,gold.length)},(_,i)=>i+1));
gold.forEach((x,i)=>x.performanceOrder=branchOrder[i]);gold.sort((a,b)=>a.performanceOrder-b.performanceOrder);
const orderMap=Object.fromEntries(gold.map(x=>[x.id,x.performanceOrder]));
const branchReps=r.representatives.map(x=>({...x,performanceOrder:orderMap[x.id]}));
// 支部代表発表と全国大会の出場団体が食い違わないように検証。
// SR団体も支部の代表リスト・金賞一覧の双方に必ず含める。
const branchRepIds=new Set(branchReps.map(x=>x.id));
if(branchRepIds.size!==r.quota || branchReps.some(x=>!gold.some(g=>g.id===x.id)) ||
   branchReps.some(x=>!Number.isInteger(x.performanceOrder))) {
  throw Error('支部大会の代表発表データに不整合があります。');
}
let allReps=branchReps.slice(),nationalProgram=null,other=[];
if(p.representative){for(const branch of BRANCHES){if(branch===state.player.branch)continue;const rr=simulateOneBranch(branch,state,false);other.push({branch,sr:rr.sr,representatives:rr.representatives.map(x=>x.id)});allReps.push(...rr.representatives);}
if(allReps.length!==26)throw Error('全国大会代表が26団体ではありません：'+allReps.length);
nationalProgram=orderNational(allReps);
const actualPlayerBranch=new Set([...nationalProgram.first,...nationalProgram.second]
  .filter(x=>x.branch===r.branch).map(x=>x.id));
if(actualPlayerBranch.size!==branchRepIds.size ||
   [...branchRepIds].some(id=>!actualPlayerBranch.has(id))) {
  throw Error('支部代表発表と全国大会プログラムの団体が一致しません。');
}}
const playerAward=p.representative?'金賞・代表':p.award;h.branchResult=playerAward;
const result={year:state.year,branch:r.branch,representativeQuota:r.quota,qualified:!!p.representative,playerAward:p.award,playerResult:{score:p.score,rank:r.performances.indexOf(p)+1,requiredPiece:p.requiredPiece,pieceName:p.piece.name,composer:p.piece.composer,variation:p.variation},
goldBands:gold,representatives:branchReps.map(x=>({id:x.id,name:x.name,type:x.type,branchRank:x.branchRank,performanceOrder:x.performanceOrder,isPlayer:x.type==='PLAYER'})),
performances:r.performances.map(x=>({id:x.band.id,name:x.band.name,type:x.band.isPlayer?'PLAYER':'NPC',score:x.score,award:x.award,representative:x.representative,requiredPiece:x.requiredPiece,pieceName:x.piece.name,composer:x.piece.composer,performanceLabel:x.performanceLabel})),srBand:r.sr};
result.message=r.branch+'吹奏楽コンクール 一般の部\n'+state.player.bandName+'：'+playerAward+(p.representative?'\n全国大会進出！':'');
state.contests={branch:result,national:null,representatives:allReps,nationalProgram,otherBranches:other};state.scene='branch_result';return result;}
function nationalProgram(state){requireState(state);if(!state.contests.branch||!state.contests.branch.qualified||!state.contests.nationalProgram)throw Error('全国大会プログラムがありません。');return state.contests.nationalProgram;}
function nationalContest(state){requireState(state);if(!state.contests.branch||!state.contests.branch.qualified)throw Error('全国大会に進出していません。');if(state.contests.national)throw Error('今年の全国大会は実施済みです。');const program=nationalProgram(state),m=masters();const npc=new Map(m.npcBands.map(x=>[x.id,x.rating]));const sr=new Map(m.srBands.map(x=>[x.id,x.nationalRating]));const pieces=new Map(m.pieces.map(x=>[x.id,x.bonus]));
const resultOrder=[...program.first,...program.second].map(b=>{const rating=b.type==='PLAYER'?Number(state.player.rating):b.type==='SR'?(sr.get(b.id)||0):(npc.get(b.id)||0);const pieceBonus=pieces.get(b.pieceId)||0,variation=normal()*12;return {...b,rating,pieceBonus,variation,score:rating+pieceBonus+variation};});
for(const session of ['前半','後半']){const list=resultOrder.filter(b=>b.session===session).sort((a,b)=>b.score-a.score);if(list.length!==13)throw Error(session+'の団体数が13ではありません。');list.forEach((b,i)=>{b.sessionRank=i+1;b.award=i<5?'金賞':i<10?'銀賞':'銅賞';});}
resultOrder.sort((a,b)=>a.session===b.session?a.performanceOrder-b.performanceOrder:a.session==='前半'?-1:1);
const player=resultOrder.find(b=>b.type==='PLAYER');if(!player)throw Error('全国大会にプレイヤー団体がありません。');history(state).nationalResult=player.award;
const result={year:state.year,playerAward:player.award,playerSession:player.session,playerSessionRank:player.sessionRank,bands:resultOrder};state.contests.national=result;state.scene='national_result';return result;}
function nextYear(state){requireState(state);const h=history(state),branch=state.contests.branch;if(!branch)throw Error('先に支部大会を開催してください。');if(branch.qualified&&!state.contests.national)throw Error('全国大会の結果を確定してください。');
if(state.year===5){state.status='completed';state.scene='final_result';return {gameOver:true,currentYear:5,nextYear:null};}
const previous=state.year;state.year++;state.contests={branch:null,national:null,representatives:[],simulation:[]};state.scene='new_year';return {gameOver:false,currentYear:previous,nextYear:state.year};}
function finalHistory(state){if(!state||!state.player)throw Error('ゲームデータがありません。');return {bandName:state.player.bandName,prefecture:state.player.prefecture,finalRating:state.player.rating,managerId:state.player.managerId,totalNewMembers:state.history.reduce((n,h)=>n+(h.newMembers||0),0),history:state.history.slice().sort((a,b)=>a.year-b.year),members:state.members.slice()};}
root.SuisougakuContest=Object.freeze({branches:BRANCHES.slice(),branchContest,nationalProgram,nationalContest,nextYear,finalHistory});
})(typeof window !== 'undefined' ? window : globalThis);
