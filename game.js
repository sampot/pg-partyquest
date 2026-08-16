function clone(v){return structuredClone(v)}
function rand(n){let t=(n+0x6d2b79f5)|0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}
export function createGame({seed=1,chapter=1}={}){return {seed:Number(seed)||1,turn:0,score:0,outcome:"playing",message:"準備就緒",chapter,node:0,enemyHp:22,party:[{n:"凜",job:"劍士",hp:32},{n:"米菈",job:"術師",hp:22},{n:"波可",job:"療師",hp:25}],gear:["木劍"],world:["村","林","橋","城","塔","王"]}}
export function getLegalActions(s){return s.outcome==="playing"?["march", "attack", "skill", "equip"]:[]}
export function applyAction(state,action){const s=clone(state);if(!getLegalActions(s).includes(action))return s;s.message={"march": "行軍", "attack": "普攻", "skill": "技能", "equip": "裝備"}[action];if(action==="march"&&s.enemyHp<=0){if(s.node>=5)s.outcome="won";else{s.node++;s.enemyHp=18+s.node*5;if(s.node===2)s.chapter=2;if(s.node===4)s.chapter=3}}else if(action==="attack"){s.enemyHp-=7;s.party[0].hp-=3}else if(action==="skill"){s.enemyHp-=10;s.party[1].hp-=2;s.party[2].hp=Math.min(25,s.party[2].hp+3)}else if(action==="equip"){s.gear.push(["鋼劍","星杖","聖鈴"][s.chapter-1]);s.score+=10}s.turn++;if(s.party.every(p=>p.hp<=0))s.outcome="lost";return s}
export function summarize(s){return {turn:s.turn,score:s.score,outcome:s.outcome,message:s.message}}
export function getOutcome(s){return s.outcome}
