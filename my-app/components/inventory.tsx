"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import type { Auction,Catalogs } from "@/lib/domain";
import { currency,dateLabel } from "@/lib/domain";
import { useSession } from "./session";
import { VehicleImage } from "./vehicle-image";
const empty={marca:"",modelo:"",anio:"",combustible:"",dano:"",q:""};
export default function Inventory({mine=false}:{mine?:boolean}){
 const {user,loading:sessionLoading}=useSession();
 const [catalogs,setCatalogs]=useState<Catalogs|null>(null),[filters,setFilters]=useState(empty),[query,setQuery]=useState(""),[page,setPage]=useState(1);
 const [data,setData]=useState<{items:Auction[];total:number;pages:number}|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch("/api/catalogos").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setCatalogs).catch(()=>setError("No se pudieron cargar los catálogos."));},[]);
 useEffect(()=>{
  if(mine&&sessionLoading)return;
  if(mine&&!user)return;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function load(){try{
   const r=await fetch("/api/subastas?"+query+"&page="+page+(mine?"&mine=1":""),{cache:"no-store",signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(d.error);
   if(!controller.signal.aborted){setData(d);setError("");}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"No fue posible cargar el inventario.");}
  finally{if(!controller.signal.aborted){setLoading(false);timer=setTimeout(load,10000);}}}
  void load();return()=>{controller.abort();clearTimeout(timer);};
 },[query,page,mine,user,sessionLoading]);
 function submit(e:React.FormEvent){e.preventDefault();setPage(1);const p=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v)p.set(k,v);});setQuery(p.toString());}
 if(mine&&!sessionLoading&&!user)return <main className="container"><div className="empty panel"><h1>Tu inventario personal</h1><p>Inicia sesión para ver y administrar tus publicaciones.</p><Link className="button" href="/ingresar">Ingresar</Link></div></main>;
 return <main className="container">
 {!mine?<section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="live-dot"/> SUBASTAS EN GUATEMALA</span><h1>Encuentra un vehículo.<br/><em>Hazlo tuyo.</em></h1><p>Explora oportunidades, revisa cada detalle y participa con confianza. Tu próxima historia empieza aquí.</p><a className="button" href="#inventario">Explorar inventario <span>↗</span></a></div><div className="hero-aside"><span className="mini-label">ASÍ DE SIMPLE</span><ol><li><span>01</span><div><strong>Encuentra tu oportunidad</strong><p>Filtra por marca, año y condición.</p></div></li><li><span>02</span><div><strong>Conoce todos los detalles</strong><p>Ficha técnica y galería completa.</p></div></li><li><span>03</span><div><strong>Haz tu mejor oferta</strong><p>Sigue tu posición sin recargar.</p></div></li></ol><div className="hero-caption"><span className="shield">✓</span>Ofertas privadas · Estado actualizado</div></div></section>:<section className="page-heading"><span className="eyebrow">TU ESPACIO</span><h1>Mis publicaciones</h1><p>Administra tus vehículos antes del inicio de cada subasta.</p><Link className="button" href="/publicar">+ Publicar vehículo</Link></section>}
 <section id="inventario"><div className="section-heading"><div><span className="eyebrow">{mine?"TUS VEHÍCULOS":"DESCUBRE EL INVENTARIO"}</span><h2>{mine?"Todas tus publicaciones":"Oportunidades para tu próximo camino"}</h2></div><span className="count-pill">{data?.total??0} vehículos</span></div>
 <form className="filters panel" onSubmit={submit}>
 <label className="search-field">Buscar<input placeholder="Marca, modelo, año…" value={filters.q} maxLength={100} onChange={e=>setFilters({...filters,q:e.target.value})}/></label>
 <label>Marca<select aria-label="Marca" value={filters.marca} onChange={e=>setFilters({...filters,marca:e.target.value,modelo:""})}><option value="">Todas las marcas</option>{catalogs?.marcas.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select></label>
 <label>Modelo<select aria-label="Modelo" value={filters.modelo} onChange={e=>setFilters({...filters,modelo:e.target.value})}><option value="">Todos los modelos</option>{catalogs?.modelos.filter(o=>!filters.marca||String(o.marca_id)===filters.marca).map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select></label>
 <label>Año<input type="number" placeholder="Cualquiera" min={1900} max={new Date().getFullYear()+2} value={filters.anio} onChange={e=>setFilters({...filters,anio:e.target.value})}/></label>
 <label>Combustible<select aria-label="Combustible" value={filters.combustible} onChange={e=>setFilters({...filters,combustible:e.target.value})}><option value="">Todos</option>{catalogs?.combustibles.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</select></label>
 <label>Daño<select aria-label="Daño" value={filters.dano} onChange={e=>setFilters({...filters,dano:e.target.value})}><option value="">Todos los niveles</option><option value="VERDE">Verde · Leve</option><option value="AMARILLO">Amarillo · Moderado</option><option value="ROJO">Rojo · Alto</option></select></label>
 <button className="button" type="submit">Aplicar filtros</button><button className="text-button" type="button" onClick={()=>{setFilters(empty);setQuery("");setPage(1);}}>Limpiar</button>
 </form>
 {error&&<p className="error" role="alert">{error}</p>}
 {loading?<div className="loading" role="status">Buscando oportunidades…</div>:!data?.items.length?<div className="empty panel"><span className="empty-icon">◇</span><h3>{mine?"Aún no tienes publicaciones":"No hay vehículos con estos filtros"}</h3><p>{mine?"Publica tu primer vehículo y encuentra a su próximo dueño.":"Prueba otra combinación o vuelve pronto para encontrar nuevas oportunidades."}</p>{user&&<Link className="button secondary" href="/publicar">Publicar un vehículo</Link>}</div>:
 <div className="vehicle-grid">{data.items.map(a=><article className="vehicle-card" key={a.id}><Link href={`/subastas/${a.id}`} className="vehicle-photo"><VehicleImage src={a.photos[0]} alt={`${a.marca} ${a.modelo} ${a.anio}`}/><span className={`badge status-${a.state.status}`}>{a.state.status==="activa"?"● En subasta":a.state.status==="programada"?"Próximamente":"Cerrada"}</span><span className="photo-count">{a.photos.length} fotos</span></Link><div className="card-body"><div className="card-title"><h3><Link href={`/subastas/${a.id}`}>{a.marca} {a.modelo}</Link></h3><span>{a.anio}</span></div><p className="vehicle-meta">{a.transmision} <span>·</span> {a.combustible} <span>·</span> {a.tren_manejo}</p><span className={`damage damage-${a.nivel_dano.toLowerCase()}`}>● Daño {a.nivel_dano.toLowerCase()}</span><div className="card-price"><div><small>{a.state.highest?"Oferta más alta":"Monto base"}</small><strong>{currency(a.state.highest??a.state.base)}</strong></div><Link className="circle-link" aria-label={`Ver ${a.marca} ${a.modelo}`} href={`/subastas/${a.id}`}>↗</Link></div><p className="card-date">{a.state.status==="programada"?"Inicia":"Cierra"} {dateLabel(a.state.status==="programada"?a.state.startsAt:a.state.endsAt)}</p>{mine&&(a.editable?<Link className="button secondary full" href={`/publicar?editar=${a.id}`}>Editar publicación</Link>:<span className="muted small-text">Edición bloqueada: iniciada o con ofertas</span>)}</div></article>)}</div>}
 {data&&data.pages>1&&<div className="pagination"><button className="button secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page} de {data.pages}</span><button className="button secondary" disabled={page>=data.pages} onClick={()=>setPage(page+1)}>Siguiente</button></div>}
 </section><section className="trust-strip"><div><strong>Sin intermediarios</strong><span>Publica y oferta con tu cuenta.</span></div><div><strong>Información clara</strong><span>Condición, ficha técnica y fotografías.</span></div><div><strong>Ofertas privadas</strong><span>Tu identidad no se comparte con otros postores.</span></div></section></main>;
}
