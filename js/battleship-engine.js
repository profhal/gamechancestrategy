'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Battleship=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const N=10,FLEET=[['Carrier',5],['Battleship',4],['Cruiser',3],['Submarine',3],['Destroyer',2]];
const index=(r,c)=>r*N+c,coords=p=>[Math.floor(p/N),p%N];
const pick=(a,rng=Math.random)=>a[Math.floor(rng()*a.length)];
function neighbors(p){const [r,c]=coords(p);return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([a,b])=>a>=0&&a<N&&b>=0&&b<N).map(([a,b])=>index(a,b));}
function emptyFleet(){return {cells:Array(100).fill(null),ships:[],shots:Array(100).fill(null)};}
function positions(start,length,vertical){const [r,c]=coords(start);if(r<0||r>=N||c<0||c>=N||(vertical?r+length>10:c+length>10))return null;return Array.from({length},(_,k)=>index(r+(vertical?k:0),c+(vertical?0:k)));}
function placeShip(fleet,name,length,start,vertical){const ps=positions(start,length,vertical);if(!ps||ps.some(p=>fleet.cells[p]!==null))return false;const ship={name,length,positions:ps,hits:0};fleet.ships.push(ship);for(const p of ps)fleet.cells[p]=ship;return true;}
function makeFleet(rng=Math.random){for(let attempt=0;attempt<100;attempt++){const fleet=emptyFleet();let ok=true;for(const [name,length] of FLEET){const options=[];for(let p=0;p<100;p++)for(const vertical of [false,true]){const ps=positions(p,length,vertical);if(ps&&ps.every(q=>fleet.cells[q]===null))options.push([p,vertical]);}if(!options.length){ok=false;break;}const [p,v]=pick(options,rng);placeShip(fleet,name,length,p,v);}if(ok)return fleet;}throw new Error('Could not place fleet');}
function fire(fleet,p){if(!Number.isInteger(p)||p<0||p>=100||fleet.shots[p]!==null)return null;const ship=fleet.cells[p];fleet.shots[p]=ship?'HIT':'MISS';let sunk=null;if(ship){ship.hits++;if(ship.hits===ship.length){sunk=ship.name;for(const q of ship.positions)fleet.shots[q]='SUNK';}}return {hit:!!ship,sunk};}
const remaining=fleet=>fleet.ships.filter(s=>s.hits<s.length).length;
const observation=fleet=>({shots:fleet.shots.slice()});
function chooseShot(view,level='naive',rng=Math.random){const shots=view.shots,open=[];for(let p=0;p<100;p++)if(shots[p]===null)open.push(p);if(!open.length)return null;
if(level==='naive'||level==='random')return pick(open,rng);
if(!['adjacent','checkerboard','strategist'].includes(level))throw new Error('Unknown agent: '+level);
const targets=new Set();for(let p=0;p<100;p++)if(shots[p]==='HIT')for(const q of neighbors(p))if(shots[q]===null)targets.add(q);
if(level==='strategist'){
 const directed=[];
 for(const p of targets){const [r,c]=coords(p);for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){const r1=r+dr,c1=c+dc,r2=r+2*dr,c2=c+2*dc;if(r2>=0&&r2<N&&c2>=0&&c2<N&&shots[index(r1,c1)]==='HIT'&&shots[index(r2,c2)]==='HIT'){directed.push(p);break;}}}
 if(directed.length)return pick(directed,rng);
}
if(targets.size)return pick([...targets],rng);
if(level==='checkerboard'||level==='strategist'){const parity=open.filter(p=>{const [r,c]=coords(p);return (r+c)%2===0;});if(parity.length)return pick(parity,rng);}
return pick(open,rng);
}
function playGame(first='naive',second='naive',rng=Math.random){const fleets=[makeFleet(rng),makeFleet(rng)],levels=[first,second];let turn=0,shots=0;while(remaining(fleets[0])&&remaining(fleets[1])){const defender=fleets[1-turn],p=chooseShot(observation(defender),levels[turn],rng);if(p===null||!fire(defender,p))throw new Error('Invalid agent shot');shots++;if(remaining(defender)===0)return {winner:turn,shots};turn=1-turn;}throw new Error('Unexpected termination');}
return {N,FLEET,index,coords,neighbors,emptyFleet,positions,placeShip,makeFleet,fire,remaining,observation,chooseShot,playGame};
});
