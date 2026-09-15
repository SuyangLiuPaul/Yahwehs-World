import type {Route} from '../routes.ts';
export type CampPhase='pitch'|'rest'|'pack'|'travel';
/** Distance-linear travel with explicit camp dwell, including shared and
 * unlocated textual stages. Neither animation duration nor spacing is history. */
export class CampPlayback {
  ordinal=1; elapsed=0; travelling=false; done=false; t=0;
  constructor(private route:Route){}
  seek(n:number){
    this.ordinal=n;this.elapsed=1;this.travelling=false;this.done=false;
    // An unlocated selection still needs a preceding distance cursor. Keeping
    // the previous arbitrary cursor (possibly 1) would turn Resume into Replay.
    for(let i=this.index(n);i>=0;i--){const t=this.route.path.markerT[i];if(Number.isFinite(t)){this.t=t!;break;}}
  }
  private index(n:number){return this.route.journey.markers.findIndex(m=>m.stops.includes(n));}
  get phase():CampPhase{return this.travelling?'travel':this.elapsed<.8?'pitch':this.elapsed<1.8?'rest':'pack';}
  get tentScale(){return this.phase==='pitch'?Math.max(.03,this.elapsed/.8):this.phase==='rest'?1:this.phase==='pack'?Math.max(.03,(3-this.elapsed)/1.2):0;}
  advance(dt:number){
    let left=Math.max(0,dt);
    for(let guard=0;left>1e-9&&!this.done&&guard<150;guard++){
      if(!this.travelling){
        if(this.ordinal===this.route.journey.stopCount){this.elapsed=Math.min(1.5,this.elapsed+left);this.done=true;break;}
        const used=Math.min(left,3-this.elapsed);this.elapsed+=used;left-=used;
        if(this.elapsed<3)break;
        const from=this.index(this.ordinal),to=this.index(this.ordinal+1);
        const leg=this.route.path.legs.find(l=>l.startMarker===from&&l.endMarker===to);
        if(!leg){this.ordinal++;this.elapsed=0;const t=this.route.path.markerT[to];if(Number.isFinite(t))this.t=t!;continue;}
        this.travelling=true;
      }else{
        const target=this.route.path.markerT[this.index(this.ordinal+1)]!;
        const duration=Math.max(24,this.route.journey.stopCount*1.6);
        const used=Math.min(left,Math.max(0,target-this.t)*duration);this.t=Math.min(target,this.t+used/duration);left-=used;
        if(this.t>=target-1e-10){this.t=target;this.ordinal++;this.travelling=false;this.elapsed=0;}else break;
      }
    }
  }
}
