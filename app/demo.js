/* Datos de demostración con el mismo formato que genera actualizar_nba.py.
   Jugadores y equipos reales; estadísticas, resultados y cuotas simulados. */
window.TRIBUNA_DEMO = function () {
  function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const R = rng(2027);
  const gauss=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  function gamma(k){if(k<1)return gamma(k+1)*Math.pow(R(),1/k);const d=k-1/3,c=1/Math.sqrt(9*d);for(;;){let x,v;do{x=gauss();v=1+c*x}while(v<=0);v=v*v*v;const u=R();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v}}
  function pois(l){if(l<=0)return 0;const L=Math.exp(-l);let k=0,p=1;do{k++;p*=R()}while(p>L);return k-1}
  const gp=(m,k=7)=>pois(m*gamma(k)/k), binom=(n,p)=>{let s=0;for(let i=0;i<n;i++)if(R()<p)s++;return s};
  const iso=d=>d.toISOString().slice(0,10);

  const TEAMS=['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS'];
  const STR={OKC:7,CLE:5,BOS:4,DEN:4,NYK:4,HOU:3,MIN:2,LAL:2,GSW:1.5,DET:1.5,ORL:1,IND:1,MIL:.5,LAC:.5,MEM:0,ATL:0,SAS:0,DAL:-.5,PHX:-1,MIA:-1,SAC:-2,CHI:-2,TOR:-2.5,PHI:-2.5,POR:-3,NOP:-4,BKN:-5,CHA:-5,UTA:-6,WAS:-7};
  const TODAY=[{away:'NYK',home:'BOS',status:'7:30 pm ET'},{away:'DEN',home:'OKC',status:'8:00 pm ET'},{away:'GSW',home:'LAL',status:'10:30 pm ET'}];

  // Calendario: cada jornada empareja a los 30 equipos al azar.
  const teams={}; TEAMS.forEach(t=>teams[t]=[]);
  const schedule=[];
  function season(name,start,rounds,stopBefore){
    let d=new Date(start);
    for(let r=0;r<rounds;r++){
      d=new Date(d.getTime()+864e5*(r===0?0:(R()<.25?1:2)));
      if(stopBefore&&d>=stopBefore)break;
      const order=[...TEAMS].sort(()=>R()-.5);
      for(let i=0;i<30;i+=2){
        const h=order[i],a=order[i+1];
        const ph=Math.round(113+STR[h]*1.1-STR[a]*.6+1.5+gauss()*11),pa=Math.round(113+STR[a]*1.1-STR[h]*.6-1.5+gauss()*11);
        const hp=ph===pa?ph+1:ph;
        teams[h].push([iso(d),a,true,hp,pa,name]);teams[a].push([iso(d),h,false,pa,hp,name]);
        schedule.push({date:iso(d),home:h,away:a,season:name});
      }
    }
  }
  season('2025-26',Date.UTC(2025,9,21),82);
  season('2026-27',Date.UTC(2026,9,20),20,new Date(Date.UTC(2026,10,16)));

  // id, nombre, equipo, pos, min, tiros, %TC, triples int., %3, TL int., %TL, reb, ast, rob, tap, pérd.
  const P=[
   ['1628983','Shai Gilgeous-Alexander','OKC','G',34,21,.53,5.8,.37,8.8,.89,5,6.4,1.4,1,2.4],
   ['1631114','Jalen Williams','OKC','F',33,16,.49,4.6,.37,4,.82,5.4,5,1.5,.6,2.5],
   ['1631096','Chet Holmgren','OKC','C',30,12,.53,4.5,.36,4,.78,8.5,2.2,.7,2.2,1.6],
   ['1628378','Luguentz Dort','OKC','G',29,8,.42,6,.38,1.5,.75,4,1.6,1.1,.4,.9],
   ['203999','Nikola Jokić','DEN','C',36,19.5,.58,4.5,.40,7,.80,12.5,10.2,1.7,.7,3.2],
   ['1627750','Jamal Murray','DEN','G',35,17,.48,7,.40,4,.88,4.3,6,1.2,.4,2.4],
   ['203932','Aaron Gordon','DEN','F',30,10.5,.55,3.3,.40,3.6,.78,5.8,2.7,.8,.4,1.4],
   ['1631128','Christian Braun','DEN','G',31,10,.52,3,.36,2.5,.74,5,2.4,1,.3,1.1],
   ['1627759','Jaylen Brown','BOS','F',33,20,.48,6,.34,6,.76,6,4.5,1.1,.4,3],
   ['1628369','Jayson Tatum','BOS','F',35,19.5,.45,9.5,.35,6.5,.83,8.5,5.5,1.1,.5,2.8],
   ['1628401','Derrick White','BOS','G',33,13.5,.44,8.5,.36,2.8,.88,4.3,5,1.2,1.2,1.5],
   ['1629057','Payton Pritchard','BOS','G',28,11,.46,6.5,.40,1.5,.85,3.6,3.4,.8,.1,.9],
   ['1628973','Jalen Brunson','NYK','G',35,20,.49,6,.38,7,.83,3.3,7,.9,.2,2.6],
   ['1626157','Karl-Anthony Towns','NYK','C',34,15.5,.52,5.5,.40,5.5,.85,12,3.2,.8,.8,2.8],
   ['1628969','Mikal Bridges','NYK','F',36,14,.49,5.5,.36,2,.80,4,3.5,1.2,.6,1.6],
   ['1628384','OG Anunoby','NYK','F',35,12,.47,6,.37,3,.80,4.6,2,1.4,.8,1.3],
   ['1629029','Luka Dončić','LAL','G',36,22,.47,10,.36,9,.78,8,8.5,1.6,.5,4],
   ['2544','LeBron James','LAL','F',34,17.5,.51,5,.37,5,.76,7.5,8,1,.6,3.5],
   ['1630559','Austin Reaves','LAL','G',35,15,.47,7,.37,6.5,.87,5,6,1.1,.3,2.5],
   ['1629216','Deandre Ayton','LAL','C',28,10,.58,.2,.2,2,.72,9.5,1.4,.6,.9,1.4],
   ['201939','Stephen Curry','GSW','G',33,18.5,.45,11.5,.40,4.5,.92,4.4,5.5,1.1,.3,2.9],
   ['202710','Jimmy Butler','GSW','F',32,12.5,.50,2,.30,8,.86,5.5,5.5,1.4,.3,1.6],
   ['203110','Draymond Green','GSW','F',29,7.5,.44,3.5,.34,1.5,.70,6,5.8,1.3,.9,2.6],
   ['1630228','Jonathan Kuminga','GSW','F',26,12,.47,3,.32,4,.68,4.8,2,.7,.4,1.6],
  ];
  const cols=["date","opp","home","min","pts","reb","ast","fg3m","fg3a","fgm","fga","ftm","fta","stl","blk","tov","season"];
  const players={},logs={};
  P.forEach(a=>{
    const [id,name,team,pos,min,fga,fgp,fg3a,fg3p,fta,ftp,reb,ast,stl,blk,tov]=a;
    players[id]={name,team,pos};
    logs[id]=teams[team].filter(()=>R()>.06).map(g=>{
      const m=Math.max(14,Math.min(44,Math.round(min+gauss()*3.6))),s=m/min,form=gamma(9)/9;
      const a3=pois(fg3a*s*form),m3=binom(a3,fg3p),a2=pois(Math.max(0,fga-fg3a)*s*form);
      const p2=Math.min(.75,(fga*fgp-fg3a*fg3p)/Math.max(1,fga-fg3a)),m2=binom(a2,p2),ta=pois(fta*s),tm=binom(ta,ftp);
      return [g[0],g[1],g[2],m,2*m2+3*m3+tm,gp(reb*s),gp(ast*s),m3,a3,m2+m3,a2+a3,tm,ta,gp(stl*s,4),gp(blk*s,4),gp(tov*s,5),g[5]];
    });
  });

  const data={updated:'2026-11-16T08:00+00:00',seasons:['2025-26','2026-27'],cols,games:TODAY.map((g,i)=>({id:'demo'+i,...g,date:'2026-11-16'})),
    players,logs,team_cols:["date","opp","home","pts","opp_pts","season"],teams};

  // Cuotas de ejemplo, como si el administrador las hubiera pegado.
  const odds={};
  const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
  const pr=(p)=>Math.round(100/(p*1.045))/100;
  const statVal={pts:r=>r[4],reb:r=>r[5],ast:r=>r[6],fg3m:r=>r[7],pra:r=>r[4]+r[5]+r[6]};
  Object.keys(players).forEach(id=>Object.entries(statVal).forEach(([k,f])=>{
    if(R()<.25)return;
    const v=logs[id].slice(-20).map(f),base=Math.floor(med(v))+.5,sh=[-1,-.5,0,0,.5,1][Math.floor(R()*6)]*(base>8?2:1);
    const p=.5+(R()-.5)*.14;odds[id+'|'+k]={line:Math.max(.5,base+sh),over:pr(p),under:pr(1-p)};
  }));
  TODAY.forEach(g=>{
    const ph=Math.min(.85,Math.max(.15,.5+(STR[g.home]-STR[g.away])*.04+.06+(R()-.5)*.1));
    odds['T:'+g.home+'|ml']={line:0,over:pr(ph)};odds['T:'+g.away+'|ml']={line:0,over:pr(1-ph)};
    const spread=-Math.round(((STR[g.home]-STR[g.away])*1.4+2)*2)/2+.5;
    odds['T:'+g.home+'|spread']={line:spread,over:pr(.5)};
    odds['T:'+g.away+'|spread']={line:-spread,over:pr(.5)};
    const tot=Math.round((226+(R()-.5)*14)*2)/2+.5;
    odds['G:'+g.away+'@'+g.home+'|total']={line:tot,over:pr(.5),under:pr(.5)};
    [g.home,g.away].forEach(t=>{const L=Math.round((tot/2+(t===g.home?-spread/2:spread/2))*2)/2;odds['T:'+t+'|pts']={line:Math.floor(L)+.5,over:pr(.5),under:pr(.5)}});
  });
  return {data,odds};
};
