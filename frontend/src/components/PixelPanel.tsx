import { useEffect, useRef, type ReactNode } from 'react';
type Props={variant:'clipboard'|'terminal'|'notice'|'alert';title:string;onClose?:()=>void;hidden?:boolean;children?:ReactNode};
export default function PixelPanel({variant,title,onClose,hidden=false,children}:Props){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(!hidden)heading.current?.focus();},[hidden,title]);
 useEffect(()=>{if(hidden||!onClose)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[hidden,onClose]);
 return <section className={`pixel-panel pixel-panel-${variant}`} role={variant==='alert'?'alert':'dialog'} aria-modal={variant==='alert'?undefined:'false'} aria-labelledby={variant==='alert'?undefined:'pixel-panel-title'} hidden={hidden}>
   {variant!=='alert'&&<h2 id="pixel-panel-title" ref={heading} tabIndex={-1}>{title}</h2>}
   {variant==='alert'&&<h2 ref={heading} tabIndex={-1}>{title}</h2>}
   {children}{onClose&&<button type="button" className="button button-ghost" onClick={onClose}>Close</button>}
 </section>;
}
