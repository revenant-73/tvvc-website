import React from 'react';

interface LiabilityWaiverProps {
  athleteName: string;
  agreed: boolean;
  onChange: (agreed: boolean) => void;
}

const LiabilityWaiver: React.FC<LiabilityWaiverProps> = ({ athleteName, agreed, onChange }) => {
  return (
    <div className="glass-card border-white/5 p-6 space-y-6">
      <div className="space-y-4 text-sm text-white/60 leading-relaxed max-h-[400px] overflow-y-auto pr-4 custom-scrollbar bg-black/20 p-6 rounded-2xl border border-white/5">
        <div className="text-center border-b border-white/10 pb-4 mb-6">
          <h3 className="text-lg font-heading font-bold text-white uppercase tracking-tight">TUALATIN VALLEY VOLLEYBALL CLUB, LLC</h3>
          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.2em] mt-2">
            Assumption of Risk, Waiver, Release of Liability, and Indemnification Agreement
          </p>
        </div>

        <p className="font-bold text-white italic text-center text-xs">
          Please read carefully. This document affects your legal rights.
        </p>

        <p>
          In consideration of being allowed to participate in any program, event, activity, training, or competition organized, operated, or sponsored by Tualatin Valley Volleyball Club, LLC (“TVVC”), including but not limited to club teams, tryouts, camps, clinics, lessons, open gyms, and strength or conditioning training (collectively referred to as the “Activities”), the undersigned acknowledges and agrees as follows:
        </p>

        <section className="space-y-3">
          <h4 className="text-white font-bold uppercase text-[10px] tracking-widest border-l-2 border-brand-teal pl-3">Acknowledgment and Assumption of Risk</h4>
          <p>
            I understand that participation in volleyball and related training activities involves inherent risks, including but not limited to: collisions with other participants, floor or equipment surfaces, overexertion, falls, ball impact, dehydration, and other potential causes of injury or illness.
          </p>
          <p>
            I further acknowledge that participation in strength and conditioning training may involve strenuous physical activity that could result in injury, disability, or in rare cases, death.
          </p>
          <p>
            I voluntarily assume full responsibility for any and all risks of bodily injury, property damage, or other harm that may result from participation in these Activities, whether caused by the negligence of TVVC, its owner(s), coaches, employees, agents, volunteers, or otherwise.
          </p>
        </section>

        <section className="space-y-3">
          <h4 className="text-white font-bold uppercase text-[10px] tracking-widest border-l-2 border-brand-teal pl-3">Release and Waiver of Liability</h4>
          <p>
            I hereby release, waive, discharge, and covenant not to sue Tualatin Valley Volleyball Club, LLC; its owner(s); coaches; employees; volunteers; and any facility owners or operators where Activities are held (collectively, the “Released Parties”) from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury (including death) that may occur while participating in, or traveling to or from, any Activity.
          </p>
          <p>
            This release includes, but is not limited to, any claims arising from the negligence of the Released Parties.
          </p>
        </section>

        <section className="space-y-3">
          <h4 className="text-white font-bold uppercase text-[10px] tracking-widest border-l-2 border-brand-teal pl-3">Indemnification</h4>
          <p>
            I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost they may incur due to participation by me or my child in any Activity, whether caused by the negligence of the Released Parties or otherwise.
          </p>
        </section>

        <section className="space-y-3">
          <h4 className="text-white font-bold uppercase text-[10px] tracking-widest border-l-2 border-brand-teal pl-3">Medical Authorization</h4>
          <p>
            In the event of an injury or medical emergency, I hereby authorize TVVC, its coaches, staff, or representatives to seek and obtain medical treatment deemed necessary for myself or my child. I assume full financial responsibility for any medical services provided as a result of such treatment.
          </p>
        </section>

        <section className="space-y-3">
          <h4 className="text-white font-bold uppercase text-[10px] tracking-widest border-l-2 border-brand-teal pl-3">Acknowledgment of Understanding</h4>
          <p className="font-bold text-white">
            I have read this waiver in its entirety, fully understand its terms, and acknowledge that I am signing it freely and voluntarily. I understand that by signing this agreement, I am waiving certain legal rights, including the right to sue.
          </p>
        </section>
      </div>

      <div className="pt-4 border-t border-white/5">
        <label className={`flex items-start gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${agreed ? 'bg-brand-teal/10 border-brand-teal shadow-glow-teal/20' : 'bg-brand-coral/5 border-brand-coral/30 hover:border-brand-coral'}`}>
          <input 
            type="checkbox" 
            required
            checked={agreed}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-1.5 accent-brand-teal w-5 h-5 shrink-0"
          />
          <div>
            <span className="block font-bold text-white text-base">I Agree to the Liability Waiver</span>
            <span className="block text-xs text-white/40 leading-tight mt-1">
              Required for {athleteName || 'this athlete'} to participate in TVVC programs.
            </span>
          </div>
        </label>
      </div>
    </div>
  );
};

export default LiabilityWaiver;
