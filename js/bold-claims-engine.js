'use strict';
/* Bold Claims: the Atelier Java rules and four Arcade agents. */
const BoldClaimsEngine = (() => {
 const SIDES=6, DICE=5, TOTAL=10;
 const agents=['naive','handAware','skeptic','provocateur'];
 const names={naive:'Naive',handAware:'Enthusiast — Hand Aware',skeptic:'Enthusiast — Skeptic',provocateur:'Strategist — Provocateur'};
 const bid=(value,count)=>({value,count});
 const valid=(old,next)=>next.value>=1&&next.value<=SIDES&&next.count>=1&&next.count<=TOTAL&&(next.count>old.count||(next.count===old.count&&next.value>old.value));
 const cmp=(a,b)=>a.count-b.count||a.value-b.value;
 const roll=(rng=Math.random)=>Array.from({length:DICE},()=>1+Math.floor(rng()*SIDES));
 const counts=hand=>{let a=Array(SIDES+1).fill(0);for(const v of hand)a[v]++;return a};
 function chooseK(n,k){let x=1;for(let i=1;i<=k;i++)x*=(n-i+1)/i;return x}
 function tail(n,r,s=SIDES){if(r<=0)return 1;if(r>n)return 0;let p=1/s,x=0;for(let k=r;k<=n;k++)x+=chooseK(n,k)*Math.pow(p,k)*Math.pow(1-p,n-k);return x}
 function probability(b,hand){return tail(DICE,b.count-counts(hand)[b.value])}
 function opening(hand){let c=counts(hand),v=1;for(let i=2;i<=SIDES;i++)if(c[i]>c[v])v=i;return bid(v,c[v])}
 function reasonableRaise(current,hand,kind){const c=counts(hand);let best=null,bestP=-1,smallest=SIDES+1;
  // Mirrors Atelier's exclusive upper bounds: v < SIDES, count < TOTAL.
  for(let v=1;v<SIDES;v++)for(let n=1;n<TOTAL;n++){
   const b=bid(v,n);if(!valid(current,b))continue;
   if(kind==='handAware'){
    if(n>=c[v]+2)continue;
    if(!best||v<smallest||(v===smallest&&cmp(b,best)<0)){best=b;smallest=v}
   }else{
    const p=tail(DICE,n-c[v]);if(!(p>0.5))continue;
    // Java uses stable ascending probability sort and chooses the final item.
    // Equal probabilities favor the last enumerated count (for the smallest face).
    if(!best||v<smallest||(v===smallest&&p>=bestP)){best=b;smallest=v;bestP=p}
   }
  }return best;
 }
 function challengeProbability(b){let q=0;for(let j=0;j<=DICE;j++)if(tail(DICE,b.count-j)<0.19)q+=chooseK(DICE,j)*Math.pow(1/SIDES,j)*Math.pow(1-1/SIDES,DICE-j);return q}
 function provocativeRaise(current,hand){const c=counts(hand);let guaranteed=null,bestQ=-Infinity,fallback=null,smallest=SIDES+1,bestP=-Infinity;
  for(let n=1;n<=TOTAL;n++)for(let v=1;v<=SIDES;v++){
   const b=bid(v,n);if(!valid(current,b))continue;
   if(n<=c[v]){let q=challengeProbability(b);if(!guaranteed||q>bestQ||(q===bestQ&&cmp(b,guaranteed)<0)){guaranteed=b;bestQ=q}}
   const p=tail(DICE,n-c[v]);if(p>0.5&&(!fallback||v<smallest||(v===smallest&&p>bestP)||(v===smallest&&p===bestP&&cmp(b,fallback)<0))){fallback=b;smallest=v;bestP=p}
  }return guaranteed||fallback;
 }
 function choose(kind,current,hand,rng=Math.random){if(!agents.includes(kind))throw Error('Unknown agent '+kind);
  if(kind==='provocateur'){
   if(current.value!==0&&probability(current,hand)<0.19)return {action:'CALL'};
   let next=provocativeRaise(current,hand);return next?{action:'RAISE',bid:next}:{action:'CALL'};
  }
  if(current.value===SIDES&&current.count===TOTAL)return {action:'CALL'};
  if(current.value===0){return {action:'RAISE',bid:kind==='naive'?bid(1+Math.floor(rng()*SIDES),1):opening(hand)}}
  if(kind==='naive'){
   if(rng()<0.5)return {action:'CALL'};
   if(current.value===SIDES)return {action:'RAISE',bid:bid(SIDES,current.count+1)};
   if(current.count===TOTAL)return {action:'RAISE',bid:bid(current.value+1,current.count)};
   return rng()<0.5?{action:'RAISE',bid:bid(1+Math.floor(rng()*SIDES),current.count+1)}:{action:'RAISE',bid:bid(current.value+1,current.count)};
  }
  if(kind==='skeptic'&&probability(current,hand)<0.19)return {action:'CALL'};
  let next=reasonableRaise(current,hand,kind);return next?{action:'RAISE',bid:next}:{action:'CALL'};
 }
 function fresh(){return {bidsMade:0,challengesMade:0,challengesWon:0,bidsChallenged:0,bidsWon:0,bidIncrease:0,challengeValue:0,challengeCount:0,turns:0,illegal:0}}
 function newGame(hands=[roll(),roll()]){return {hands:hands.map(x=>[...x]),current:bid(0,0),turn:0,done:false,winner:null,history:[],stats:[fresh(),fresh()]}}
 function move(g,action){if(g.done)throw Error('Game finished');let p=g.turn,o=1-p,s=g.stats[p];s.turns++;
  if(action.action==='CALL'){
   if(g.current.value===0)throw Error('Cannot call before opening bid');s.challengesMade++;g.stats[o].bidsChallenged++;
   let matches=g.hands.flat().filter(v=>v===g.current.value).length;g.winner=matches>=g.current.count?o:p;
   if(g.winner===p)s.challengesWon++;else g.stats[o].bidsWon++;
   s.challengeValue+=g.current.value;s.challengeCount+=g.current.count;
   g.history.push({player:p,action:'CALL',bid:{...g.current},matches,winner:g.winner});g.done=true;
  }else if(action.action==='RAISE'&&action.bid&&valid(g.current,action.bid)){
   let b={...action.bid};s.bidsMade++;s.bidIncrease+=SIDES*(b.count-g.current.count)+b.value-g.current.value;
   g.history.push({player:p,action:'RAISE',bid:b});g.current=b;g.turn=o;
  }else{throw Error('Illegal move: '+JSON.stringify(action))}
  return g;
 }
 function simulate(n,a,b,rng=Math.random){let wins=[0,0],stats=[fresh(),fresh()],sample=null;for(let i=0;i<n;i++){
   let g=newGame([roll(rng),roll(rng)]),limit=TOTAL*SIDES+1;
   while(!g.done&&limit-->0){let p=g.turn;move(g,choose(p===0?a:b,g.current,g.hands[p],rng))}
   if(!g.done)throw Error('Move limit exceeded');wins[g.winner]++;
   for(let p=0;p<2;p++)for(const k of Object.keys(stats[p]))stats[p][k]+=g.stats[p][k];
   if(i===0)sample={hands:g.hands,history:g.history,winner:g.winner};
  }return {games:n,agents:[a,b],wins,stats,sample};}
 return {SIDES,DICE,TOTAL,agents,names,bid,valid,cmp,roll,counts,tail,probability,choose,newGame,move,simulate};
})();
