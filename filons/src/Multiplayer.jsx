import React,{useState,useEffect} from "react";
import {createRoot} from "react-dom/client";
import {io} from "socket.io-client";

const socket=io({autoConnect:true,reconnection:true});
const COLORS={navy:"#243343",green:"#2A6756",gold:"#A98330",paper:"#F3F2ED",border:"#B9C0BA"};
const STORAGE="filons-online-v1";
const secret=()=>{try{return JSON.parse(localStorage.getItem(STORAGE))}catch{return null}};
const btn={padding:"10px 15px",cursor:"pointer",border:"1px solid "+COLORS.border,background:"white",color:COLORS.navy};
function LiveGame(){
  const [state,setState]=useState(null),[session,setSession]=useState(secret);
  const [connected,setConnected]=useState(socket.connected),[name,setName]=useState("");
  const [code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [policy,setPolicy]=useState({cit:20,royalty:4,reserve:60}),[block,setBlock]=useState("none");
  const [bid,setBid]=useState(60),[investments,setInvestments]=useState({});
  const [plan,setPlan]=useState({});
  const [resultDetails,setResultDetails]=useState(true);
  const [audit,setAudit]=useState("pt");
  useEffect(()=>{ setPlan({}); setInvestments({}); setBlock("none"); },[state?.turn]);
  useEffect(()=>{
    const handleConnect=()=>{
      setConnected(true);
      const remembered=secret();
      if(remembered?.code&&remembered?.token)
        socket.emit("room:join",{code:remembered.code,token:remembered.token,name:remembered.name},(answer)=>{
          if(!answer?.ok){setError(answer?.error||"Session expirée");setSession(null);localStorage.removeItem(STORAGE);}
        });
    };
    const disconnect=()=>setConnected(false);
    const update=value=>{setState(value);setError("");};
    const displaced=()=>{setState(null);setSession(null);localStorage.removeItem(STORAGE);setError("Session ouverte ailleurs.");};
    socket.on("connect",handleConnect);socket.on("disconnect",disconnect);
    socket.on("room:state",update);socket.on("room:displaced",displaced);
    if(socket.connected)handleConnect();
    return()=>{socket.off("connect",handleConnect);socket.off("disconnect",disconnect);socket.off("room:state",update);socket.off("room:displaced",displaced)};
  },[]);
  const invoke=(event,data,remember=false)=>{
    if(busy||!connected)return;setBusy(true);setError("");
    socket.timeout(10000).emit(event,data,(err,response)=>{
      setBusy(false);
      if(err){setError("Le serveur n’a pas répondu. Réessayez.");return;}
      if(!response?.ok){setError(response?.error||"Action refusée");return;}
      if(remember){
        const s={code:response.code,token:response.token,name:name.trim()};
        localStorage.setItem(STORAGE,JSON.stringify(s));setSession(s);
      }
    });
  };
  const act=(payload)=>invoke("game:act",payload);
  const me=state?.players.find(x=>x.id===state.me);
  const isMinister=me?.role==="minister";
  const companies=state?.players.filter(x=>x.role==="firm")||[];
  const mineBlocks=state?.blocks.filter(b=>b.owner===state.me&&b.remaining>0)||[];
  const decisionsComplete=companies.length>0&&companies.every(p=>p.ready);
  const unit=(x)=>Number(x).toLocaleString("fr-FR");
  const panel=(children)=> <section style={{padding:20,background:"white",border:"1px solid "+COLORS.border,marginBottom:16}}>{children}</section>;
  const action=(label,fn,disabled=false)=><button type="button" disabled={disabled||busy||!connected} style={{...btn,background:disabled||busy?"#ddd":COLORS.navy,color:"#fff",marginTop:12,opacity:disabled?0.55:1}} onClick={fn}>{label}</button>;
  const numeric=(value,setter,min,max,label)=><label style={{display:"block",margin:"12px 0"}}>{label} <input type="number" min={min} max={max} value={value} onChange={e=>setter(Number(e.target.value))} style={{...btn,width:115,marginLeft:8}}/></label>;
  if(!state)return <main style={{maxWidth:750,margin:"50px auto",padding:20,color:COLORS.navy}}>
    <h1 style={{fontFamily:"Georgia,serif",letterSpacing:5,fontSize:36}}>FILONS <span style={{fontSize:14,letterSpacing:1}}>EN LIGNE</span></h1>
    <p>Un ministre, jusqu’à cinq firmes, chacun sur son ordinateur. Les décisions des firmes se prennent simultanément ; le serveur arbitre les offres.</p>
    {panel(<>
      <h2>Créer une salle ou rejoindre une partie</h2>
      <label style={{display:"block",margin:"12px 0"}}>Votre nom : <input type="text" maxLength={24} value={name} onChange={e=>setName(e.target.value)} style={{...btn,width:190,marginLeft:8}} placeholder="Nom de joueur"/></label>
      {action("Créer une partie (ministre)",()=>invoke("room:create",{name},true),name.trim().length<2)}
      <hr style={{margin:"25px 0"}}/>
      <label>Code de partie <input value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="ABC123" style={{...btn,marginLeft:8,width:120}}/></label>
      <div>{action("Rejoindre (firme)",()=>invoke("room:join",{code,name},true),code.length!==6||name.trim().length<2)}</div>
    </>)}
    <p style={{color:"#8B2C2C"}} role="alert">{error}</p>
    <small>{connected?"Serveur connecté":"Connexion au serveur en cours…"} — Accès Internet requis. Le code n’est pas un mot de passe.</small>
  </main>;
  return <main style={{maxWidth:1060,margin:"0 auto",padding:20,background:COLORS.paper,minHeight:"100vh",fontFamily:"system-ui,sans-serif",color:COLORS.navy}}>
    <header style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:15,marginBottom:18}}>
      <div><h1 style={{fontFamily:"Georgia,serif",letterSpacing:4}}>FILONS <span style={{fontSize:14,letterSpacing:1}}>EN LIGNE</span></h1><div>Tour {state.turn}/8 · {state.stage==="lobby"?"Salle d’attente":state.stage==="policy"?"Code minier":state.stage==="bidding"?"Offres simultanées":state.stage==="investment"?"Investissements":state.stage==="planning"?"Stratégies fiscales":state.stage==="audit"?"Contrôle fiscal":state.stage==="results"?"Résultats du tour":"Partie terminée"}</div></div>
      <div style={{background:"white",padding:12,border:"1px solid "+COLORS.border}}>Code de partie : <strong style={{fontSize:25,letterSpacing:3}}>{state.code}</strong><div style={{fontSize:12}}>{connected?"● Connecté":"○ Déconnecté — reconnexion…"}</div><div style={{fontSize:12,color:state.durable?"#2A6756":"#9C3530"}}>{state.durable?"● Sauvegarde permanente activée":"○ Partie non sauvegardée sur serveur"}</div></div>
    </header>
    {error&&<p role="alert" style={{background:"#FFEDEB",padding:12,color:"#842B26"}}>{error}</p>}
    {panel(<><h3>Participants — {state.players.length}/6</h3>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{state.players.map(p=><span key={p.id} style={{border:"1px solid "+COLORS.border,padding:9,background:p.ready?"#E6F3E9":"#F5F5F2"}}>{p.role==="minister"?"⚖ Ministre":"⛏ Firme"} · {p.name}{p.id===state.me?" (vous)":""} · {p.connected?"en ligne":"absent"}{p.ready?" ✓ décision scellée":""}</span>)}</div>
    </>)}
    {state.stage!=="lobby"&&panel(<><h3>Territoire minier</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10}}>{state.blocks.map(b=><div key={b.id} style={{padding:13,minHeight:130,background:b.revealed?"#E9EEE6":COLORS.navy,color:b.revealed?COLORS.navy:"#fff"}}>
      <strong>Bloc {b.id+1}</strong><div style={{fontSize:22,margin:"14px 0"}}>{b.revealed?b.name:"?"}</div>
      {b.revealed&&<small>Reste : {b.remaining}/{b.ore} u.<div>Exploitant : {state.players.find(p=>p.id===b.owner)?.name||"—"}</div>{b.investment&&<div>{b.investment.name}</div>}</small>}
      {!b.revealed&&<small>Gisement inconnu</small>}
    </div>)}</div></>)}
    {state.stage==="lobby"&&panel(<><h2>Salle d’attente</h2><p>Transmettez le code <strong>{state.code}</strong> aux autres participants. Chaque firme rejoint sur son ordinateur. Le ministre démarre après l’arrivée des participants.</p>{isMinister&&action("Lancer la partie",()=>act({}),companies.length===0||companies.some(p=>!p.connected))}</>)}
    {state.stage==="policy"&&panel(<><h2>1. Ministre — Code minier</h2>{isMinister?<>{numeric(policy.cit,v=>setPolicy(p=>({...p,cit:v})),0,50,"Impôt sur les sociétés (%)")}{numeric(policy.royalty,v=>setPolicy(p=>({...p,royalty:v})),0,20,"Redevance (%)")}{numeric(policy.reserve,v=>setPolicy(p=>({...p,reserve:v})),0,300,"Réserve minimale par permis (M€)")}{action("Publier le code minier",()=>act(policy),policy.cit<0||policy.cit>50||policy.royalty<0||policy.royalty>20||policy.reserve<0||policy.reserve>300)}</>:<p>Le ministre prépare le régime fiscal. Les firmes attendent sa publication.</p>}</>)}
    {state.stage==="bidding"&&panel(<><h2>2. Offres simultanées</h2><p>Prix de réserve {state.policy.reserve} M€ par bloc. Les choix des autres firmes restent cachés jusqu’à la clôture.</p>{!isMinister&&!me.ready?<><label>Bloc demandé : <select style={btn} value={block} onChange={e=>setBlock(e.target.value)}><option value="none">Aucun (passer)</option>{state.blocks.filter(b=>!b.revealed).map(b=><option key={b.id} value={b.id}>Bloc {b.id+1} — inconnu</option>)}</select></label>{block!=="none"&&numeric(bid,setBid,0,500,"Offre (M€)")}{action("Sceller mon offre",()=>act({block:block==="none"?null:Number(block),bid}),block!=="none"&&(bid<state.policy.reserve||bid>Math.min(500,me.cash)))}</>:<p>{isMinister?"Attente des offres des firmes.":me.ready?"Offre scellée. Attente des autres firmes.":""}</p>}</>)}
    {state.stage==="investment"&&panel(<><h2>3. Investissements simultanés</h2>{!isMinister&&!me.ready?<><p>Trésorerie disponible : {unit(me.cash)} M€. Les investissements sont engagés simultanément.</p>{mineBlocks.filter(b=>!b.investment).map(b=><label key={b.id} style={{display:"block",margin:"12px 0"}}>Bloc {b.id+1} — {b.name} : <select style={btn} value={investments[b.id]||""} onChange={e=>setInvestments(p=>({...p,[b.id]:e.target.value?Number(e.target.value):null}))}><option value="">Ne pas investir</option>{[[1,"Sous-traitée",10],[2,"Conventionnelle",150],[3,"Mécanisée",400],[4,"Intégrée",750]].map(([id,name,cost])=><option key={id} value={id}>{name} — {cost} M€</option>)}</select></label>)}{action("Valider mes investissements",()=>act({investments:Object.fromEntries(Object.entries(investments).filter(([,v])=>v!=null))}),Object.values(investments).reduce((s,t)=>s+({1:10,2:150,3:400,4:750}[t]||0),0)>me.cash)}</>:<p>{isMinister?"Les firmes choisissent leurs équipements.":me.ready?"Investissements scellés.":""}</p>}</>)}
    {state.stage==="planning"&&panel(<>
      <h2>4. Déclarations fiscales — décisions détaillées</h2>
      <p>Cours du minerai : <strong>{unit(state.price)} M€ par unité</strong>.
      Chaque firme renseigne, pour chacune de ses mines, les <strong>achats intragroupe</strong>,
      les <strong>intérêts</strong> et les <strong>frais de siège</strong>, en M€.
      Les montants indiqués comme « zone sûre » présentent un risque réduit de redressement.
      Des charges plus élevées diminuent le bénéfice déclaré, mais exposent à un contrôle.</p>
      {!isMinister&&!me.ready?<>
        {mineBlocks.filter(b=>b.investment).map(b=>{
          const bands=state.myBands?.[b.id];
          if(!bands)return null;
          const current=plan[b.id]||{pt:bands.pt.safe,sc:bands.sc.safe,fs:bands.fs.safe};
          const setCharge=(channel,value)=>setPlan(prev=>({...prev,
            [b.id]:{...(prev[b.id]||{pt:bands.pt.safe,sc:bands.sc.safe,fs:bands.fs.safe}),[channel]:value}}));
          const lines=[["pt","Achats intragroupe"],["sc","Intérêts intragroupe"],["fs","Frais de siège"]];
          const total=Object.values(current).reduce((sum,v)=>sum+Number(v),0);
          const royalty=Math.round(bands.sales*(b.contract?.royalty||0)/100);
          const estimatedTaxable=Math.max(0,bands.sales-bands.local-bands.depreciation-total-royalty);
          const expectedCit=Math.round(estimatedTaxable*(b.contract?.cit||0)/100);
          return <div key={b.id} style={{border:"1px solid "+COLORS.border,padding:16,margin:"15px 0",background:COLORS.paper}}>
            <h3>Bloc {b.id+1} — {b.name} · {b.investment.name}</h3>
            <p style={{fontSize:13}}>Extraction prévue : {bands.units} unités · Chiffre d'affaires : {unit(bands.sales)} M€
              · Redevance : {unit(royalty)} M€</p>
            {lines.map(([key,label])=>{
              const v=current[key];
              const lower=key==="fs"?0:bands[key].real;
              const upper=bands[key].max;
              return <div key={key} style={{margin:"16px 0"}}>
                <label style={{display:"block",fontWeight:600,marginBottom:5}}>{label} : {unit(v)} M€
                  <span style={{marginLeft:8,color:v>bands[key].safe?"#9C3530":COLORS.green,fontSize:12}}>
                    {v>bands[key].safe?"Exposé au contrôle":"Zone sûre"}
                  </span>
                </label>
                <input aria-label={label+" bloc "+(b.id+1)} type="range" min={lower} max={upper} step={1}
                  value={v} onChange={e=>setCharge(key,Number(e.target.value))} style={{width:"100%"}}/>
                <div style={{fontSize:12,color:"#52625E"}}>Coût réel : {unit(bands[key].real)} · Seuil sûr : {unit(bands[key].safe)} · Maximum : {unit(upper)} M€</div>
              </div>;
            })}
            <div style={{background:"#E4EBE8",padding:10}}>
              Charges déclarées : <strong>{unit(total)} M€</strong> · Bénéfice imposable estimé : <strong>{unit(estimatedTaxable)} M€</strong>
              · IS avant contrôle : <strong>{unit(expectedCit)} M€</strong>
            </div>
            <button style={{...btn,marginTop:8}} onClick={()=>setPlan(prev=>({...prev,[b.id]:{pt:bands.pt.safe,sc:bands.sc.safe,fs:bands.fs.safe}}))}>Réinitialiser dans la zone sûre</button>
          </div>;
        })}
        {action("Sceller toutes mes déclarations",()=>act({plan}))}
      </>:<p>{isMinister?"Les firmes définissent leurs trois canaux de charges ; leurs choix restent confidentiels.":me.ready?"Déclarations scellées, en attente des autres firmes.":""}</p>}
    </>)}
    {state.stage==="audit"&&panel(<><h2>5. Ministre — Contrôle fiscal</h2>
      <p>Un seul instrument de contrôle s'applique à l'ensemble des entreprises. Vous observez la masse des charges et l'écart aux zones sûres, mais pas leur ventilation confidentielle.</p>
      {isMinister&&<div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Bloc","Firme","CA","Charges déclarées","Plafond sûr","Dépassement"].map(x=><th key={x} style={{padding:7,textAlign:"left"}}>{x}</th>)}</tr></thead>
        <tbody>{(state.auditSignal||[]).map(x=><tr key={x.block}>
          {[x.block,x.firm,x.sales,x.charges,x.safeCeiling,Math.max(0,x.charges-x.safeCeiling)].map((v,i)=><td key={i} style={{padding:7,borderTop:"1px solid #ddd"}}>{typeof v==="number"?unit(v):v}</td>)}
        </tr>)}</tbody></table>
      </div>}
      {isMinister?<><label>Canal contrôlé : <select style={btn} value={audit} onChange={e=>setAudit(e.target.value)}>
        <option value="pt">Prix de transfert</option><option value="sc">Intérêts intragroupe</option>
        <option value="fs">Frais de siège</option><option value="none">Aucun contrôle</option>
      </select></label><div>{action("Confirmer le contrôle et calculer la répartition de la rente",()=>act({channel:audit}))}</div></>:
      <p>Le ministre examine les déclarations des différentes entreprises.</p>}
    </>)}
    {["results","finished"].includes(state.stage)&&panel(<>
      <h2>{state.stage==="finished"?"Fin de partie":"6. Résultats économiques et fiscaux du tour "+state.turn}</h2>
      <p>Cours du minerai : <strong>{unit(state.result?.price||0)} M€ par unité</strong>.
      Les résultats ci-dessous portent sur les mines effectivement exploitées. Un permis sans équipement ne produit pas de recette fiscale d'exploitation.</p>
      {state.result?.summary&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,margin:"16px 0"}}>
        {[
          ["Chiffre d'affaires",state.result.summary.sales,COLORS.gold],
          ["Rente économique",state.result.summary.economicRent,COLORS.navy],
          ["Recettes fiscales du ministre",state.result.summary.fiscalTotal,COLORS.green],
          ["Profit économique des firmes",state.result.summary.companyProfit,"#73542A"]
        ].map(([label,value,color])=><div key={label} style={{borderTop:"4px solid "+color,padding:12,background:COLORS.paper}}>
          <div style={{fontSize:12}}>{label}</div><strong style={{fontSize:22}}>{unit(value)} M€</strong>
        </div>)}
      </div>}
      {state.result?.summary&&<div style={{background:"#E6EEE9",padding:14,marginBottom:15}}>
        <strong>Partage de la rente du tour</strong>
        <p style={{margin:"6px 0"}}>Rente économique = ventes − coûts réels d'exploitation − amortissement des équipements.</p>
        <p style={{margin:"6px 0"}}>État : {unit(state.result.summary.royalty)} M€ de redevances + {unit(state.result.summary.cit)} M€ d'IS + {unit(state.result.summary.penalties)} M€ de pénalités.</p>
        <p style={{margin:"6px 0"}}>Firmes : {unit(state.result.summary.companyProfit)} M€ de profit économique après prélèvements, avant prise en compte des permis et investissements passés.</p>
        {state.result.summary.economicRent>0&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #bbb"}}>
          <strong>Taux de partage de la rente :</strong>
          État {(100*state.result.summary.fiscalTotal/state.result.summary.economicRent).toFixed(1).replace(".",",")} %
          {" · "}Firmes {(100*state.result.summary.companyProfit/state.result.summary.economicRent).toFixed(1).replace(".",",")} %.
          <div style={{fontSize:12}}>Ces parts incluent les pénalités fiscales mais excluent le prix des permis et les nouveaux investissements. Elles ne sont interprétables comme des parts positives que si la rente est positive.</div>
        </div>}
      </div>}
      <h3>Concessions et mines attribuées</h3>
      <p>La découverte du gisement intervient dès l'attribution du permis. Une mine non équipée apparaît ci-dessous, même si elle n'a encore réalisé aucune production.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9,marginBottom:16}}>
        {state.blocks.filter(b=>b.revealed).map(b=><div key={b.id} style={{background:COLORS.paper,padding:10,borderLeft:"3px solid "+(b.investment?COLORS.green:COLORS.gold)}}>
          <strong>Bloc {b.id+1} — {b.name}</strong>
          <div>Entreprise : {state.players.find(p=>p.id===b.owner)?.name||"—"}</div>
          <div>Minerai restant : {b.remaining}/{b.ore} unités</div>
          <div>Équipement : {b.investment?.name||"non équipé"}</div>
          <div style={{fontSize:12,color:"#63726C"}}>{b.investment?"Capacité : "+b.investment.capacity+" u./tour":"Pas encore de production sur cette concession"}</div>
        </div>)}
      </div>
      <h3>Résultats mine par mine</h3>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>{["Bloc / gisement","Entreprise","Équipement","Volume","CA","Rente","Redevance","IS","Pénalité","Profit"].map(x=><th key={x} style={{textAlign:"left",padding:7,borderBottom:"1px solid #bbb"}}>{x}</th>)}</tr></thead>
        <tbody>{(state.result?.details||[]).map(x=><tr key={x.block}>
          {[`B${x.block} · ${x.deposit}`,x.firm,x.technology,x.units,x.sales,x.rent,x.royalty,x.cit,x.penalty,x.profit].map((v,k)=><td key={k} style={{padding:7,borderBottom:"1px solid #ddd"}}>{typeof v==="number"?unit(v):v}</td>)}
        </tr>)}</tbody>
      </table></div>
      {state.result?.summary&&<><h3>Résultat par entreprise</h3>
        {state.result.summary.firms.map(f=><div key={f.id} style={{padding:10,marginBottom:6,background:COLORS.paper}}>
          <strong>{f.name}</strong> — chiffre d'affaires {unit(f.sales)} M€ · prélèvements {unit(f.taxes)} M€ · <strong>profit {unit(f.profit)} M€</strong>
        </div>)}
      </>}
      <h3>Résultats cumulés</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8}}>
        {state.players.map(p=><div key={p.id} style={{background:COLORS.paper,padding:10}}>
          <strong>{p.name}</strong><div>{p.role==="minister"?"Recettes totales de l'État (permis inclus)":"Trésorerie nette cumulée (permis et investissements inclus)"}</div>
          <strong>{unit(p.score)} M€</strong>
          {p.role==="firm"&&<div style={{fontSize:12,marginTop:5}}>
            Investissement : {unit(p.invested||0)} M€ · Permis : {unit(p.permitsPaid||0)} M€
            <div>Rendement cumulé du capital : <strong>{p.invested>0?(100*p.score/p.invested).toFixed(1).replace(".",",")+" %":"—"}</strong></div>
            <div style={{fontSize:11}}>Flux nets cumulés, après achat des permis et investissements, divisés par le capital investi dans les équipements.</div>
          </div>}
        </div>)}
      </div>
      <button style={{...btn,marginTop:15}} onClick={()=>setResultDetails(x=>!x)}>
        {resultDetails?"Masquer":"Afficher"} le bilan détaillé par mine
      </button>
      {resultDetails&&(state.result?.details||[]).filter(x=>x.ownerId===state.me).map(x=><div key={x.block} style={{padding:10,border:"1px solid "+COLORS.border,marginTop:8}}>
        <strong>Votre déclaration — bloc {x.block}</strong>
        <div>Achats intragroupe : {unit(x.declared.pt)} · Intérêts : {unit(x.declared.sc)} · Frais de siège : {unit(x.declared.fs)} M€</div>
        <div>Charges déplacées : {unit(x.displaced)} · Redressées : {unit(x.recovered)} M€</div>
      </div>)}
      {state.stage==="results"&&isMinister&&action(state.turn===8?"Terminer la partie":"Ouvrir le tour suivant",()=>{setPlan({});setInvestments({});setBlock("none");act({});})}
    </>)}
    <footer style={{marginTop:25,color:"#607069",fontSize:12}}>Prototype multijoueur distinct du mode FILONS classique. Les parties sont gardées en mémoire sur le serveur, sans sauvegarde durable après un redémarrage.</footer>
  </main>;
}
createRoot(document.getElementById("root")).render(<LiveGame/>);
