"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {type Auction,type AuctionState,currency,dateLabel} from "@/lib/domain";
import {useSession} from "./session";
import {VehicleImage} from "./vehicle-image";
function LiveBidding({auction}:{auction:Auction}){
 const {user}=useSession();
 const [snapshot,setSnapshot]=useState(()=>({data:auction.state,received:performance.now()}));
 const [now,setNow]=useState(()=>performance.now()),[networkError,setNetworkError]=useState(""),[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false);
 const [amount,setAmount]=useState("");
 useEffect(()=>{
  const controller=new AbortController();let timeout:ReturnType<typeof setTimeout>;
  async function refresh(){
   const start=performance.now();
   try{const r=await fetch(`/api/subastas/${auction.id}/estado`,{cache:"no-store",signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(d.error);if(!controller.signal.aborted){setSnapshot({data:d,received:(start+performance.now())/2});setNetworkError("");}}
   catch{if(!controller.signal.aborted)setNetworkError("Sin conexión en vivo. Reconectando…");}
   finally{if(!controller.signal.aborted)timeout=setTimeout(refresh,document.hidden?10000:2000);}
  }
  function resume(){if(!document.hidden){clearTimeout(timeout);void refresh();}}
  document.addEventListener("visibilitychange",resume);void refresh();
  const tick=setInterval(()=>setNow(performance.now()),1000);
  return()=>{controller.abort();clearTimeout(timeout);clearInterval(tick);document.removeEventListener("visibilitychange",resume);};
 },[auction.id,user]);
 const state=snapshot.data,serverNow=new Date(state.serverNow).getTime()+now-snapshot.received;
 const started=serverNow>=new Date(state.startsAt).getTime(),closed=serverNow>=new Date(state.endsAt).getTime();
 const remaining=Math.max(0,Math.ceil(((started?new Date(state.endsAt):new Date(state.startsAt)).getTime()-serverNow)/1000));
 const days=Math.floor(remaining/86400),hours=Math.floor((remaining%86400)/3600),minutes=Math.floor((remaining%3600)/60),seconds=remaining%60;
 async function bid(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSuccess("");try{
  const r=await fetch(`/api/subastas/${auction.id}/pujas`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({monto:amount})});const d=await r.json();if(!r.ok)throw new Error(d.error);setSnapshot({data:d as AuctionState,received:performance.now()});setSuccess("Tu oferta fue registrada.");setAmount("");
 }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar la oferta.");}finally{setBusy(false);}}
 return <aside className="panel bid-panel"><div className="bid-heading"><span className="eyebrow">SUBASTA #{auction.id}</span><span className={`badge status-${closed?"cerrada":started?"activa":"programada"}`}>{closed?"Subasta cerrada":started?"● En vivo":"Programada"}</span></div><p className="muted">{state.highest?"Oferta más alta":"Comienza desde"}</p><strong className="big-price" data-testid="highest">{currency(state.highest??state.base)}</strong><div className="bid-meta"><span>Base {currency(state.base)}</span><span>{state.bidCount} {state.bidCount===1?"oferta":"ofertas"}</span></div><div className="countdown"><small>{closed?"SUBASTA FINALIZADA":started?"TIEMPO RESTANTE":"COMIENZA EN"}</small><strong data-testid="countdown">{closed?(state.sold||state.highest?"Vendida":"No vendida / desierta"):`${days?days+"d ":""}${String(hours).padStart(2,"0")} : ${String(minutes).padStart(2,"0")} : ${String(seconds).padStart(2,"0")}`}</strong><span>{dateLabel(closed||started?state.endsAt:state.startsAt)} · Guatemala</span></div>
 {user&&state.winning&&<div className="notice success" role="status" data-testid="position">{closed?"¡Ganaste esta subasta!":"¡Vas ganando esta subasta!"}</div>}
 {user&&state.outbid&&<div className="notice warning" role="status" data-testid="position">Tu oferta ha sido superada</div>}
 {!user?<div className="guest-bid"><p>Inicia sesión para participar en esta subasta.</p><Link className="button full" href="/ingresar">Ingresar para ofertar</Link><Link href="/registro">¿Sin cuenta? Regístrate</Link></div>:!closed?<form className="stack" onSubmit={bid}><label>Tu oferta (Q)<input aria-label="Tu oferta (Q)" inputMode="decimal" placeholder={state.minimum} value={amount} onChange={e=>setAmount(e.target.value)} required pattern="[0-9]+(\.[0-9]{1,2})?"/></label><small>Mínimo actual: <strong>{currency(state.minimum)}</strong></small><button className="button full" disabled={busy||!started||!!networkError||now-snapshot.received>15000}>{busy?"Registrando…":started?"Hacer oferta →":"La subasta aún no comienza"}</button></form>:null}
 {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success-text" role="status">{success}</p>}{networkError&&<p className="error" role="alert">{networkError}</p>}<p className="privacy-note">✓ Tu identidad permanece privada ante otros postores.</p><details><summary>¿Cómo funcionan las ofertas?</summary><p>La primera puede ser igual al monto base. Las siguientes deben superar la más alta en al menos 10 %, redondeado hacia arriba al centavo. El servidor confirma el horario y el monto al registrar cada oferta.</p></details></aside>;
}
export default function AuctionDetail({id}:{id:string}){
 const {user}=useSession();const [auction,setAuction]=useState<Auction|null>(null),[error,setError]=useState(""),[index,setIndex]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch("/api/subastas/"+id,{signal:controller.signal,cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(setAuction).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id,user]);
 if(error)return <main className="container"><div className="empty panel"><h1>No pudimos abrir la subasta</h1><p role="alert">{error}</p><Link href="/">Volver al inventario</Link></div></main>;
 if(!auction)return <main className="container loading">Cargando los detalles…</main>;
 const a=auction;
 return <main className="container detail-page"><div className="breadcrumb"><Link href="/">Inventario</Link><span>/</span><span>{a.marca} {a.modelo}</span></div><div className="detail-heading"><div><span className="eyebrow">LOTE #{a.id} · {a.tipo}</span><h1>{a.marca} {a.modelo} <span>{a.anio}</span></h1><p>{a.transmision} · {a.combustible} · {a.tren_manejo}</p></div><span className={`damage damage-${a.nivel_dano.toLowerCase()}`}>● Daño {a.nivel_dano.toLowerCase()}</span></div><div className="detail-grid"><div><section className="gallery panel" aria-label="Galería del vehículo"><div className="gallery-main"><VehicleImage key={a.photos[index]} src={a.photos[index]} alt={`${a.marca} ${a.modelo}, foto ${index+1}`}/><button className="gallery-arrow previous" aria-label="Foto anterior" onClick={()=>setIndex((index+a.photos.length-1)%a.photos.length)}>‹</button><button className="gallery-arrow next" aria-label="Foto siguiente" onClick={()=>setIndex((index+1)%a.photos.length)}>›</button><span className="gallery-counter">{index+1} / {a.photos.length}</span></div><div className="gallery-thumbnails">{a.photos.map((url,i)=><button key={url+i} aria-label={`Ver foto ${i+1}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><VehicleImage src={url} alt={`Miniatura ${i+1}`}/></button>)}</div></section><section className="panel specification"><h2>Conoce cada detalle</h2><p className="muted">Ficha técnica del vehículo</p><dl>{Object.entries({"Año":a.anio,"Tipo de artículo":a.tipo,"Marca":a.marca,"Modelo":a.modelo,"Motor":a.motor,"Transmisión":a.transmision,"Combustible":a.combustible,"Tren de manejo":a.tren_manejo,"Cilindros":a.numero_cilindros,"Nivel de daño":a.nivel_dano}).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><div className={`damage-note damage-${a.nivel_dano.toLowerCase()}`}><strong>Condición: {a.nivel_dano.toLowerCase()}</strong><p>{a.nivel_dano==="VERDE"?"Daño leve.":a.nivel_dano==="AMARILLO"?"Daño moderado.":"Daño alto."} Revisa todas las fotografías antes de ofertar.</p></div></section>{a.mine&&<div className="panel owner-box"><strong>Esta es tu publicación</strong>{a.editable?<Link className="button secondary" href={`/publicar?editar=${a.id}`}>Editar publicación</Link>:<p>La edición se bloquea al iniciar la subasta o al recibir ofertas.</p>}</div>}</div><LiveBidding auction={a}/></div></main>;
}

