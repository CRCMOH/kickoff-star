import type { CaptaincyStory } from '../engine/captaincy'
export default function CaptaincyStoryCard({story,onDismiss}:{story:CaptaincyStory;onDismiss:()=>void}){
 return <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center px-5">
  <div className="w-full max-w-md rounded-2xl border border-ks-gold/40 bg-[#0f0f0d] p-6 text-center shadow-2xl">
   <div className="text-3xl mb-3">©</div>
   <div className="text-[10px] uppercase tracking-[0.3em] text-ks-gold font-display mb-2">{story.kind.includes('appointed')?'Leadership Appointment':'Leadership Update'}</div>
   <h2 className="font-display text-xl text-ks-ink mb-3">{story.title}</h2>
   <p className="text-sm text-ks-muted leading-relaxed mb-6">{story.body}</p>
   <button onClick={onDismiss} className="w-full rounded-xl bg-ks-gold text-black font-display py-3 tracking-wide">Continue</button>
  </div>
 </div>
}
