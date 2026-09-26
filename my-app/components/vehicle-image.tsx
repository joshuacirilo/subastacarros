"use client";
import {useState} from "react";
export function VehicleImage({src,alt}:{src?:string;alt:string}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return <div className="image-placeholder" role="img" aria-label={alt}><svg viewBox="0 0 160 70" aria-hidden="true"><path d="M20 45h120l-8-20-22-5-17-15H52L34 25l-14 5z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="m42 25 14-14h33l15 14z" fill="currentColor" opacity=".18"/><circle cx="45" cy="47" r="11" fill="currentColor"/><circle cx="116" cy="47" r="11" fill="currentColor"/></svg><span>Fotografía no disponible</span></div>;
 // Public HTTPS URLs are served directly from the persistent image provider.
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}

