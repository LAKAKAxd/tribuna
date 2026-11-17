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

/* Demo NFL con el mismo formato que genera actualizar_nfl.py: jugadores y equipos reales, todo lo demás simulado. */
window.TRIBUNA_DEMO_NFL = function () {
  function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const R = rng(2026);
  const gauss=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  function pois(l){if(l<=0)return 0;const L=Math.exp(-l);let k=0,p=1;do{k++;p*=R()}while(p>L);return k-1}
  const binom=(n,p)=>{let s=0;for(let i=0;i<n;i++)if(R()<p)s++;return s}, pos0=x=>Math.max(0,Math.round(x));
  const iso=d=>d.toISOString().slice(0,10);
  const TEAMS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LA','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS'];
  const STR={KC:6,BUF:6,PHI:5,DET:5,BAL:5,SF:3,CIN:2,LA:2,GB:2,HOU:1,MIN:1,LAC:1,DAL:0,PIT:0,TB:0,SEA:0,DEN:0,WAS:0,ATL:-1,MIA:-1,CHI:-1,ARI:-2,JAX:-2,IND:-2,NO:-3,NYJ:-3,LV:-4,NE:-4,TEN:-5,NYG:-5,CAR:-5,CLE:-6};
  const TODAY=[{away:'BUF',home:'KC',date:'2026-11-19',status:'8:15 pm ET'},{away:'DAL',home:'PHI',date:'2026-11-22',status:'1:00 pm ET'},
    {away:'DET',home:'SF',date:'2026-11-22',status:'4:25 pm ET'},{away:'CIN',home:'BAL',date:'2026-11-23',status:'8:15 pm ET'}];
  const teams={}; TEAMS.forEach(t=>teams[t]=[]);
  function season(name,start,weeks){
    for(let w=0;w<weeks;w++){
      const d=new Date(start+w*7*864e5), order=[...TEAMS].sort(()=>R()-.5);
      for(let i=0;i<32;i+=2){
        const h=order[i],a=order[i+1];
        const ph=pos0(22.5+STR[h]*.9-STR[a]*.6+1+gauss()*9.5),pa=pos0(22.5+STR[a]*.9-STR[h]*.6-1+gauss()*9.5);
        const hp=ph===pa?ph+3:ph;
        teams[h].push([iso(d),a,true,hp,pa,name]);teams[a].push([iso(d),h,false,pa,hp,name]);
      }
    }
  }
  season('2025',Date.UTC(2025,8,7),17);
  season('2026',Date.UTC(2026,8,13),10);
  // id, nombre, equipo, posición, nivel (1 = normal)
  const P=[
    ['d-mahomes','Patrick Mahomes','KC','QB',1.05],['d-pacheco','Isiah Pacheco','KC','RB',.95],['d-worthy','Xavier Worthy','KC','WR',.95],['d-kelce','Travis Kelce','KC','TE',1.05],
    ['d-allen','Josh Allen','BUF','QB',1.1],['d-cook','James Cook','BUF','RB',1.05],['d-shakir','Khalil Shakir','BUF','WR',.9],['d-kincaid','Dalton Kincaid','BUF','TE',.9],
    ['d-hurts','Jalen Hurts','PHI','QB',1],['d-barkley','Saquon Barkley','PHI','RB',1.2],['d-brown','A.J. Brown','PHI','WR',1.1],['d-goedert','Dallas Goedert','PHI','TE',.95],
    ['d-prescott','Dak Prescott','DAL','QB',1],['d-williams','Javonte Williams','DAL','RB',.9],['d-lamb','CeeDee Lamb','DAL','WR',1.2],['d-ferguson','Jake Ferguson','DAL','TE',.95],
    ['d-purdy','Brock Purdy','SF','QB',1],['d-mccaffrey','Christian McCaffrey','SF','RB',1.15],['d-jennings','Jauan Jennings','SF','WR',.95],['d-kittle','George Kittle','SF','TE',1.1],
    ['d-goff','Jared Goff','DET','QB',1.05],['d-gibbs','Jahmyr Gibbs','DET','RB',1.15],['d-stbrown','Amon-Ra St. Brown','DET','WR',1.15],['d-laporta','Sam LaPorta','DET','TE',1],
    ['d-jackson','Lamar Jackson','BAL','QB',1.1],['d-henry','Derrick Henry','BAL','RB',1.2],['d-flowers','Zay Flowers','BAL','WR',1],['d-andrews','Mark Andrews','BAL','TE',.95],
    ['d-burrow','Joe Burrow','CIN','QB',1.1],['d-chbrown','Chase Brown','CIN','RB',1],['d-chase','Ja’Marr Chase','CIN','WR',1.25],['d-gesicki','Mike Gesicki','CIN','TE',.85],
  ];
  const RUN_QB=new Set(['d-jackson','d-allen','d-hurts']);
  const cols=["date","opp","home","min","cmp","att","pyd","ptd","int","car","ryd","rtd","tgt","rec","reyd","retd","season"];
  const players={},logs={};
  P.forEach(([id,name,team,pos,k])=>{
    players[id]={name,team,pos,img:''};
    logs[id]=teams[team].filter(()=>R()>.08).map(g=>{
      let cmp=0,att=0,pyd=0,ptd=0,int=0,car=0,ryd=0,rtd=0,tgt=0,rec=0,reyd=0,retd=0;
      if(pos==='QB'){att=pos0(34+gauss()*5);cmp=binom(att,.62+.04*k);pyd=pos0(cmp*(10.5*k+gauss()*1.5));ptd=pois(1.6*k);int=pois(.7/k);car=pois(RUN_QB.has(id)?8:3);ryd=pos0(car*(4.5+gauss()*2));rtd=pois(car>6?.4:.08);}
      else if(pos==='RB'){car=pos0(15*k+gauss()*4);ryd=pos0(car*(4.4*k+gauss()*1.4));rtd=pois(.55*k);tgt=pois(3.5);rec=binom(tgt,.78);reyd=pos0(rec*(7.5+gauss()*3));retd=pois(.08);}
      else{const wr=pos==='WR';tgt=pos0((wr?8.5:6)*k+gauss()*2.5);rec=binom(tgt,wr?.64:.7);reyd=pos0(rec*((wr?13:10.5)*k+gauss()*3.5));retd=pois((wr?.5:.35)*k);}
      return [g[0],g[1],g[2],att+car+tgt,cmp,att,pyd,ptd,int,car,ryd,rtd,tgt,rec,reyd,retd,g[5]];
    });
  });
  const data={liga:'nfl',updated:'2026-11-17T08:00+00:00',seasons:['2025','2026'],cols,games:TODAY.map((g,i)=>({id:'nfl'+i,...g,week:11})),
    players,logs,team_cols:["date","opp","home","pts","opp_pts","season"],teams};
  const odds={};
  const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
  const pr=p=>Math.round(100/(p*1.045))/100;
  const val={pyd:r=>r[6],ptd:r=>r[7],ryd:r=>r[10],rec:r=>r[13],reyd:r=>r[14],rry:r=>r[10]+r[14]};
  const BY={QB:['pyd','ptd'],RB:['ryd','rry','td'],WR:['reyd','rec','td'],TE:['rec','reyd','td']};
  P.forEach(([id,,,pos])=>BY[pos].forEach(k=>{
    if(k==='td'){const p=logs[id].slice(-17).filter(r=>r[11]+r[15]>0).length/17;odds[id+'|td']={line:.5,over:pr(Math.max(.12,Math.min(.75,p+(R()-.5)*.1)))};return;}
    const v=logs[id].slice(-8).map(val[k]),base=Math.floor(med(v))+.5,sh=k==='ptd'?0:[-1,0,0,1][Math.floor(R()*4)]*(base>30?5:.5);
    const p=.5+(R()-.5)*.12;odds[id+'|'+k]={line:Math.max(.5,base+sh),over:pr(p),under:pr(1-p)};
  }));
  TODAY.forEach(g=>{
    const ph=Math.min(.85,Math.max(.15,.5+(STR[g.home]-STR[g.away])*.035+.04+(R()-.5)*.08));
    odds['T:'+g.home+'|ml']={line:0,over:pr(ph)};odds['T:'+g.away+'|ml']={line:0,over:pr(1-ph)};
    const spread=-Math.round(((STR[g.home]-STR[g.away])*1.2+1.5)*2)/2+.5;
    odds['T:'+g.home+'|spread']={line:spread,over:pr(.5)};odds['T:'+g.away+'|spread']={line:-spread,over:pr(.5)};
    const tot=Math.round((45+(R()-.5)*8)*2)/2+.5;
    odds['G:'+g.away+'@'+g.home+'|total']={line:tot,over:pr(.5),under:pr(.5)};
    [g.home,g.away].forEach(t=>{const L=tot/2+(t===g.home?-spread/2:spread/2);odds['T:'+t+'|pts']={line:Math.floor(L)+.5,over:pr(.5),under:pr(.5)}});
  });
  return {data,odds};
};

/* Demo de fútbol con el mismo formato que genera actualizar_futbol.py: equipos y jugadores reales, todo lo demás simulado. */
window.TRIBUNA_DEMO_FUT = function () {
  function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const R = rng(2030);
  function pois(l){if(l<=0)return 0;const L=Math.exp(-l);let k=0,p=1;do{k++;p*=R()}while(p>L);return k-1}
  const iso=d=>d.toISOString().slice(0,10);
  // siglas, nombre, id de ESPN (para el escudo), colores, competición, fuerza
  const T=[['INT','Internazionale','110','#0a2d6e','#a29161','ita.1',.45],['MIL','AC Milan','103','#c8102e','#000000','ita.1',.2],['JUV','Juventus','111','#111111','#ffffff','ita.1',.25],['NAP','Napoli','114','#1f6fb2','#ffffff','ita.1',.35],
    ['RMA','Real Madrid','86','#ffffff','#00529f','esp.1',.55],['BAR','Barcelona','83','#a50044','#004d98','esp.1',.5],['ATM','Atlético Madrid','1068','#cb3524','#272e61','esp.1',.3],['SEV','Sevilla','243','#d71920','#ffffff','esp.1',-.1],
    ['ARS','Arsenal','359','#ef0107','#ffffff','eng.1',.5],['MNC','Manchester City','382','#6cabdd','#1c2c5b','eng.1',.5],['LIV','Liverpool','364','#c8102e','#00b2a9','eng.1',.45],['CHE','Chelsea','363','#034694','#ffffff','eng.1',.25]];
  const comps={'ita.1':'Serie A','esp.1':'LaLiga','eng.1':'Premier','uefa.champions':'Champions'}, S={}; T.forEach(t=>S[t[0]]=t[6]);
  const teams_meta=Object.fromEntries(T.map(t=>[t[0],{id:t[2],name:t[1],short:t[1],color:t[3],alt:t[4]}]));
  const teams={}; T.forEach(t=>teams[t[0]]=[]);
  function season(name,start,rounds){ for(let r=0;r<rounds;r++){ const d=new Date(start+r*7*864e5);
    for(const comp of ['ita.1','esp.1','eng.1']){ const ts=T.filter(t=>t[5]===comp).map(t=>t[0]).sort(()=>R()-.5);
      for(let i=0;i<4;i+=2){ const h=ts[i],a=ts[i+1],gh=pois(Math.exp(.25+S[h]-S[a]*.8+.12)),ga=pois(Math.exp(.25+S[a]-S[h]*.8-.12));
        const sH=est(h,a,gh,true),sA=est(a,h,ga,false),row=(x,y)=>EK.flatMap(k=>[x[k],y[k]]);
        teams[h].push([iso(d),a,true,gh,ga,name,comp,...row(sH,sA)]);teams[a].push([iso(d),h,false,ga,gh,name,comp,...row(sA,sH)]); } } } }
  // estadísticas de equipo por partido (mismo orden que EQ_STATS de actualizar_futbol.py)
  const EK=['sh','sot','cor','fc','yc','rc','off','sv','pos','pas','pp','tk','ht'];
  function est(t,o,g,home){ const f=S[t]-S[o]+(home?.1:-.1), sh=pois(12+f*8), pos=Math.round(50+f*25);
    let ht=0; for(let i=0;i<g;i++) if(R()<.45) ht++;
    return {sh,sot:Math.min(sh,pois(4.2+f*3)),cor:pois(Math.max(1.5,5+f*3)),fc:pois(11.5-f*2),yc:pois(Math.max(.5,2.1-f)),rc:R()<.05?1:0,off:pois(1.8),sv:pois(Math.max(.5,3-f*2)),pos,pas:Math.round(pos*9+R()*60),pp:Math.round(80+f*8),tk:pois(16),ht}; }
  season('2025',Date.UTC(2025,7,17),36); season('2026',Date.UTC(2026,7,16),13);
  const TODAY=[{home:'INT',away:'NAP',comp:'ita.1',h:20,m:45,day:1},{home:'RMA',away:'ATM',comp:'esp.1',h:21,m:0,day:2},{home:'LIV',away:'ARS',comp:'eng.1',h:17,m:30,day:2},{home:'BAR',away:'MNC',comp:'uefa.champions',h:21,m:0,day:4}];
  // id, nombre, equipo, posición, goles/90, asist/90, tiros/90, a puerta/90, faltas/90, amarillas/90, paradas/90
  const P=[['155153','Lautaro Martínez','INT','F',.62,.12,3.1,1.5,1.2,.18,0],['207219','Nicolò Barella','INT','M',.12,.22,1.4,.4,1.6,.28,0],['199015','Yann Sommer','INT','G',0,0,0,0,.1,.03,2.6],
    ['244489','Romelu Lukaku','NAP','F',.5,.12,2.6,1.2,1.3,.15,0],['281048','Scott McTominay','NAP','M',.33,.08,2.2,.9,1.4,.25,0],['168987','Alex Meret','NAP','G',0,0,0,0,.05,.02,2.8],
    ['231388','Kylian Mbappé','RMA','F',.9,.2,4.5,2.2,.6,.12,0],['244482','Vinícius Júnior','RMA','F',.5,.3,3.3,1.4,.9,.3,0],['179434','Thibaut Courtois','RMA','G',0,0,0,0,.05,.03,2.9],
    ['141024','Antoine Griezmann','ATM','F',.42,.25,2.3,1,.8,.15,0],['234215','Julián Álvarez','ATM','F',.55,.15,3,1.3,.9,.12,0],['134925','Jan Oblak','ATM','G',0,0,0,0,.05,.02,3.1],
    ['256896','Mohamed Salah','LIV','F',.7,.4,3.6,1.6,.4,.06,0],['224431','Virgil van Dijk','LIV','D',.08,.03,.9,.4,.6,.12,0],['191451','Alisson','LIV','G',0,0,0,0,.05,.03,2.7],
    ['265226','Bukayo Saka','ARS','F',.45,.35,2.9,1.2,.9,.12,0],['251856','Martin Ødegaard','ARS','M',.22,.3,2.1,.7,.9,.15,0],['226592','David Raya','ARS','G',0,0,0,0,.05,.03,2.6],
    ['230366','Lamine Yamal','BAR','F',.4,.4,3.2,1.2,.7,.1,0],['153066','Robert Lewandowski','BAR','F',.75,.12,3.4,1.6,.9,.12,0],['232111','Pedri','BAR','M',.12,.25,1.6,.5,1,.18,0],
    ['250924','Erling Haaland','MNC','F',.95,.12,4,2.1,.6,.1,0],['232233','Phil Foden','MNC','M',.32,.25,2.4,1,.6,.12,0],['176521','Bernardo Silva','MNC','M',.15,.22,1.5,.6,1.1,.2,0]];
  const cols=["date","opp","home","min","g","a","sh","sot","fc","yc","rc","sv","season","comp"], players={}, logs={};
  P.forEach(([id,name,team,pos,g,a,sh,sot,fc,yc,sv])=>{ players[id]={name,team,pos};
    logs[id]=teams[team].filter(()=>R()>.1).map(x=>{ const m=R()<.15?Math.round(20+R()*40):90, f=m/90, o=pois(sh*f), on=Math.min(o,pois(sot*f));
      return [x[0],x[1],x[2],m,Math.min(on,pois(g*f)),pois(a*f),o,on,pois(fc*f),Math.min(1,pois(yc*f)),0,pois(sv*f),x[5],x[6]]; }); });
  const now=Date.UTC(2026,10,17), games=TODAY.map((g,i)=>{ const st=new Date(now+g.day*864e5+(g.h-1)*36e5+g.m*6e4); return { id:'fut'+i, comp:g.comp, start:st.toISOString(), date:iso(st), home:g.home, away:g.away, status:'' }; });
  const data={liga:'futbol',updated:'2026-11-17T08:00+00:00',seasons:['2025','2026'],comps,cols,games,players,logs,team_cols:["date","opp","home","pts","opp_pts","season","comp",...EK.flatMap(k=>[k,k+'_a'])],teams,teams_meta};
  const pr=p=>Math.round(100/(p*1.05))/100, odds={};
  games.forEach(g=>{ const d=S[g.home]-S[g.away]+.15, ph=Math.min(.8,Math.max(.12,.45+d*.35)), pd=.26, pa=Math.max(.08,1-ph-pd);
    odds['T:'+g.home+'|ml']={line:0,over:pr(ph)}; odds['T:'+g.away+'|ml']={line:0,over:pr(pa)}; odds['G:'+g.away+'@'+g.home+'|draw']={line:.5,over:pr(pd)};
    odds['G:'+g.away+'@'+g.home+'|total']={line:2.5,over:pr(.52),under:pr(.48)}; odds['G:'+g.away+'@'+g.home+'|btts']={line:.5,over:pr(.55),under:pr(.45)};
    odds['G:'+g.away+'@'+g.home+'|s_cor']={line:9.5,over:pr(.5),under:pr(.5)}; odds['G:'+g.away+'@'+g.home+'|s_crd']={line:4.5,over:pr(.48),under:pr(.52)}; odds['T:'+g.home+'|t_sot']={line:4.5,over:pr(.5),under:pr(.5)}; });
  P.forEach(([id,,team,pos])=>{ if(!games.some(g=>g.home===team||g.away===team))return;
    if(pos==='G'){odds[id+'|sv']={line:2.5,over:pr(.5),under:pr(.5)};return;}
    odds[id+'|gol']={line:.5,over:pr(Math.min(.6,.15+R()*.4))}; odds[id+'|sh']={line:pos==='F'?2.5:1.5,over:pr(.5),under:pr(.5)}; odds[id+'|sot']={line:.5,over:pr(.55),under:pr(.45)}; });
  return {data,odds};
};
