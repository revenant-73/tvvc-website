import React from 'react';
import type { Athlete } from '../../lib/schemas';
import LiabilityWaiver from './LiabilityWaiver';
import MediaRelease from './MediaRelease';

interface WaiverSectionProps {
  index: number;
  athlete: Athlete;
  updateAthlete: (index: number, field: keyof Athlete, value: any) => void;
  isExpanded: boolean;
  toggleWaiver: (index: number) => void;
}

export const WaiverSection: React.FC<WaiverSectionProps> = ({
  index,
  athlete,
  updateAthlete,
  isExpanded,
  toggleWaiver
}) => {
  return (
    <section className="glass-card border-brand-teal/20 p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">
          Waivers for {athlete.firstName} {athlete.lastName}
        </h3>
        <button 
          type="button"
          onClick={() => toggleWaiver(index)}
          className="text-[10px] font-bold uppercase tracking-widest text-brand-teal hover:underline"
        >
          {isExpanded ? 'Collapse' : 'Expand Details'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-4">
            <input 
              id={`waiver-${index}`}
              type="checkbox" 
              checked={athlete.waiverAgreed}
              onChange={e => updateAthlete(index, 'waiverAgreed', e.target.checked)}
              className="accent-brand-teal w-5 h-5"
            />
            <label htmlFor={`waiver-${index}`} className="text-sm font-bold text-white uppercase tracking-tight cursor-pointer">
              I agree to the Liability Waiver & Release
            </label>
          </div>
          {isExpanded && <div className="text-[10px] text-white/40 leading-relaxed max-h-[200px] overflow-y-auto pr-4"><LiabilityWaiver /></div>}
        </div>

        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center gap-4">
            <input 
              id={`photo-${index}`}
              type="checkbox" 
              checked={athlete.photoReleaseAgreed}
              onChange={e => updateAthlete(index, 'photoReleaseAgreed', e.target.checked)}
              className="accent-brand-teal w-5 h-5"
            />
            <label htmlFor={`photo-${index}`} className="text-sm font-bold text-white uppercase tracking-tight cursor-pointer">
              I agree to the Media Release (Optional)
            </label>
          </div>
          {isExpanded && <div className="text-[10px] text-white/40 leading-relaxed max-h-[200px] overflow-y-auto pr-4"><MediaRelease /></div>}
        </div>
      </div>
    </section>
  );
};
