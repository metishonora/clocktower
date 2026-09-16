import { countsFor, characterPresentation } from '../../custom/authoring/characterPresentation';
export type Draft = { id: string; name: string; ids: string[]; order: string[] };
type Player = { seat: number; name: string; actualCharacter: string; shownCharacter?: string };
type State = { definition: { name: string; characterIds: string[] }; draft: { playerCount: number; selectedIds: string[]; players: Player[] }; replay?: { players: Player[] }; tab: 'roles'|'seating'|'play'; busy: boolean; saveFailed: boolean; distributionPending: boolean; error: string; distribution: ReturnType<typeof countsFor> };
// Presentation-only fixture state. No commands, WASM, rule resolution or persistence.
export class GrimoireSetupController {
  nightIndex=0; delivered=false; bluffs:string[]=[]; target=''; value='1';
  listeners = new Set<() => void>();
  state: State;
  constructor(public scenario: Draft, resume = false) {
    const selected = ['chef','empath','clockmaker','poisoner','imp'].filter(id => scenario.ids.includes(id));
    const players = Array.from({length: 5}, (_,i) => ({seat:i+1,name:['민서','지우','서연','도윤','하린'][i],actualCharacter:resume ? selected[i] ?? '' : ''}));
    this.nightIndex=resume?1:0;
    this.state = {definition:{name:scenario.name,characterIds:scenario.ids},draft:{playerCount:5,selectedIds:resume?selected:[],players},tab:resume?'play':'roles',busy:false,saveFailed:false,distributionPending:false,error:'',distribution:{Townsfolk:3,Outsider:0,Minion:1,Demon:1},...(resume?{replay:{players}}:{})};
  }
  subscribe = (f:()=>void) => { this.listeners.add(f); return ()=>{this.listeners.delete(f);}; };
  getSnapshot = () => this.state;
  update(s:Partial<State>) { this.state={...this.state,...s}; this.listeners.forEach(f=>f()); }
  navigate = (tab:State['tab']) => this.update({tab});
  setPlayerCount(count:number) { const base=[[3,0,1,1],[3,1,1,1],[5,0,1,1],[5,1,1,1],[5,2,1,1],[7,0,2,1],[7,1,2,1],[7,2,2,1],[9,0,3,1],[9,1,3,1],[9,2,3,1]][count-5]; this.update({draft:{playerCount:count,selectedIds:[],players:Array.from({length:count},(_,i)=>({seat:i+1,name:`플레이어 ${i+1}`,actualCharacter:''}))},distribution:{Townsfolk:base[0],Outsider:base[1],Minion:base[2],Demon:base[3]}}); }
  toggleCharacter(id:string) { const d=this.state.draft; const ids=d.selectedIds.includes(id)?d.selectedIds.filter(x=>x!==id):[...d.selectedIds,id]; this.update({draft:{...d,selectedIds:ids,players:d.players.map(p=>ids.includes(p.actualCharacter)?p:{...p,actualCharacter:'',shownCharacter:undefined})}}); }
  setPlayerName(seat:number,name:string) { this.players(p=>p.seat===seat?{...p,name}:p); }
  assignCharacter(seat:number,id:string) { this.players(p=>p.seat===seat?{...p,actualCharacter:id,shownCharacter:undefined}:p); }
  setShownCharacter(seat:number,id:string) { this.players(p=>p.seat===seat?{...p,shownCharacter:id}:p); }
  players(fn:(p:Player)=>Player) { this.update({draft:{...this.state.draft,players:this.state.draft.players.map(fn)}}); }
  assignRemaining = () => { const remaining=this.state.draft.selectedIds.filter(id=>!this.state.draft.players.some(p=>p.actualCharacter===id)); this.players(p=>p.actualCharacter?p:{...p,actualCharacter:remaining.shift()??''}); };
  clearAssignments = () => this.players(p=>({...p,actualCharacter:'',shownCharacter:undefined}));
  confirm = () => { if(this.state.draft.players.some(p=>!p.name.trim()||!p.actualCharacter||(p.actualCharacter==='drunk'&&!p.shownCharacter))) {this.update({error:'이름과 배역을 확인하세요.'}); return;} this.update({replay:{players:structuredClone(this.state.draft.players)},tab:'play',error:''}); };
  retrySave = () => {};
  retryDistribution = () => {};
}
export const rosterComplete=(s:State)=>s.draft.selectedIds.length===s.draft.playerCount;
export const demoIds=['chef','empath','clockmaker','washerwoman','librarian','investigator','fortuneTeller','soldier','mayor','virgin','slayer','dreamer','seamstress','drunk','recluse','butler','mutant','poisoner','scarletWoman','witch','evilTwin','imp','vortox','fangGu','noDashii'];
