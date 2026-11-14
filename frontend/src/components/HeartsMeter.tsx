export default function HeartsMeter({ hearts, max }: { hearts: number; max: number }) {
 return <div className="hearts-meter" aria-label={`Attention: ${hearts} of ${max} hearts left`} role="img">{Array.from({length:max},(_,index)=><span key={index} aria-hidden="true" data-heart={index<hearts?'full':'empty'}>{index<hearts?'♥':'♡'}</span>)}<span>{hearts} of {max}</span></div>;
}
