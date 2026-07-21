import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { id: 1, label: 'Info' },
    { id: 2, label: 'Events' },
    { id: 3, label: 'Waivers' },
    { id: 4, label: 'Review' }
  ];

  return (
    <div className="max-w-4xl mx-auto mb-12">
      <div className="flex items-center justify-between relative">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col items-center relative z-10">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500
              ${currentStep >= s.id ? 'bg-brand-teal text-white shadow-glow-teal' : 'bg-white/5 border border-white/10 text-white/40'}
            `}>
              {s.id}
            </div>
            <span className={`mt-2 text-[8px] font-bold uppercase tracking-widest ${currentStep >= s.id ? 'text-brand-teal' : 'text-white/20'}`}>
              {s.label}
            </span>
          </div>
        ))}
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5 -z-0"></div>
        <div 
          className="absolute top-5 left-0 h-[2px] bg-brand-teal transition-all duration-500 -z-0"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};
