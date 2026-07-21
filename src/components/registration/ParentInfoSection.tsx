import React from 'react';
import type { ParentInfo } from '../../lib/schemas';

interface ParentInfoSectionProps {
  parentInfo: ParentInfo;
  setParentInfo: React.Dispatch<React.SetStateAction<ParentInfo>>;
}

export const ParentInfoSection: React.FC<ParentInfoSectionProps> = ({ parentInfo, setParentInfo }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParentInfo(prev => ({ ...prev, [name]: value }));
  };

  return (
    <section className="glass-card border-white/10 p-8 space-y-6">
      <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Parent / Guardian Information</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label htmlFor="parentName" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Full Name</label>
          <input 
            id="parentName"
            type="text" 
            name="name"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
            value={parentInfo.name}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="parentEmail" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Email Address</label>
          <input 
            id="parentEmail"
            type="email" 
            name="email"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
            value={parentInfo.email}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="parentPhone" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Your Phone</label>
          <input 
            id="parentPhone"
            type="tel" 
            name="phone"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
            value={parentInfo.phone}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="emergencyPhone" className="text-[10px] font-bold uppercase tracking-widest text-white/60 text-brand-teal">Emergency Phone</label>
          <input 
            id="emergencyPhone"
            type="tel" 
            name="emergencyPhone"
            required
            placeholder="503-555-0123"
            className="w-full bg-brand-teal/5 border border-brand-teal/20 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors placeholder:text-white/20"
            value={parentInfo.emergencyPhone}
            onChange={handleChange}
          />
        </div>
      </div>
    </section>
  );
};
