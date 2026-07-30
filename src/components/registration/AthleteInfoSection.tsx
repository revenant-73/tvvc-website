import React from 'react';
import type { Athlete } from '../../lib/schemas';

const grades = ['4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

interface AthleteInfoSectionProps {
  index: number;
  athlete: Athlete;
  athletesCount: number;
  updateAthlete: (index: number, field: keyof Athlete, value: any) => void;
  removeAthlete: (index: number) => void;
  userAthletes?: any[];
}

export const AthleteInfoSection: React.FC<AthleteInfoSectionProps> = ({ 
  index, 
  athlete, 
  athletesCount, 
  updateAthlete, 
  removeAthlete,
  userAthletes = []
}) => {
  return (
    <section className="glass-card border-brand-teal/20 p-8 space-y-8 relative">
      {athletesCount > 1 && (
        <button 
          type="button"
          onClick={() => removeAthlete(index)}
          className="absolute top-8 right-8 text-brand-coral hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
        >
          Remove Athlete
        </button>
      )}
      
      <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">
        Athlete #{index + 1} Details
      </h2>

      {userAthletes.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Quick Select Saved Player</p>
          <div className="flex flex-wrap gap-2">
            {userAthletes.map(sa => (
              <button
                key={sa.id}
                type="button"
                onClick={() => {
                  updateAthlete(index, 'profileId', sa.id);
                  updateAthlete(index, 'firstName', sa.firstName);
                  updateAthlete(index, 'lastName', sa.lastName);
                  updateAthlete(index, 'grade', sa.grade);
                  updateAthlete(index, 'medicalInfo', sa.medicalInfo || '');
                }}
                className="bg-white/5 hover:bg-brand-teal/20 border border-white/10 hover:border-brand-teal/50 rounded-xl px-4 py-2 text-xs font-bold transition-all"
              >
                {sa.firstName} {sa.lastName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="space-y-2">
          <label htmlFor={`athlete-${index}-firstName`} className="text-[10px] font-bold uppercase tracking-widest text-white/50">First Name</label>
          <input 
            id={`athlete-${index}-firstName`}
            type="text" required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
            value={athlete.firstName}
            onChange={e => updateAthlete(index, 'firstName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`athlete-${index}-lastName`} className="text-[10px] font-bold uppercase tracking-widest text-white/50">Last Name</label>
          <input 
            id={`athlete-${index}-lastName`}
            type="text" required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
            value={athlete.lastName}
            onChange={e => updateAthlete(index, 'lastName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`athlete-${index}-grade`} className="text-[10px] font-bold uppercase tracking-widest text-white/50">Grade (Fall '26)</label>
          <select 
            id={`athlete-${index}-grade`}
            required
            className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors appearance-none cursor-pointer"
            value={athlete.grade}
            onChange={e => updateAthlete(index, 'grade', e.target.value)}
          >
            <option value="">Select Grade</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={`athlete-${index}-medicalInfo`} className="text-[10px] font-bold uppercase tracking-widest text-white/50">Medical Info / Allergies</label>
        <textarea 
          id={`athlete-${index}-medicalInfo`}
          required
          placeholder="List any critical medical information or allergies. Write 'None' if not applicable."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[100px]"
          value={athlete.medicalInfo}
          onChange={e => updateAthlete(index, 'medicalInfo', e.target.value)}
        />
      </div>
    </section>
  );
};
