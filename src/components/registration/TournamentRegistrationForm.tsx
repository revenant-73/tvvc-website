import React, { useState, useRef } from 'react';
import LiabilityWaiver from './LiabilityWaiver';

interface Event {
  id: string;
  name: string;
  type: string;
  dateInfo: string;
  timeInfo: string;
  price: number;
}

interface Player {
  firstName: string;
  lastName: string;
  grade: string;
  medicalInfo: string;
}

export default function TournamentRegistrationForm({ event }: { event: Event }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [parentInfo, setParentInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [players, setPlayers] = useState<Player[]>([
    { firstName: '', lastName: '', grade: '', medicalInfo: '' },
    { firstName: '', lastName: '', grade: '', medicalInfo: '' },
  ]);

  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const total = event.price * 2;

  const updatePlayer = (index: number, field: keyof Player, value: any) => {
    const next = [...players];
    next[index] = { ...next[index], [field]: value };
    setPlayers(next);
  };

  const scrollToForm = () => {
    if (formRef.current) {
      const offset = 120; // Adjust for sticky header
      const elementPosition = formRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!parentInfo.name || !parentInfo.email || !parentInfo.phone) {
        alert("Please complete all parent information.");
        return;
      }
      if (players.some(p => !p.firstName || !p.lastName || !p.grade)) {
        alert("Please complete all player names and grades.");
        return;
      }
    } else if (currentStep === 2) {
      if (!waiverAgreed) {
        alert("You must agree to the liability waiver.");
        return;
      }
    }
    
    setCurrentStep(prev => prev + 1);
    setTimeout(scrollToForm, 10);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    setTimeout(scrollToForm, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Map players to athletes for the existing API
      const athletes = players.map(p => ({
        ...p,
        selectedEvents: [event.id],
        photoReleaseAgreed: true, // Defaulting for tournament
        waiverAgreed: waiverAgreed
      }));

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentInfo, athletes }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-12 scroll-mt-32">
      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="flex items-center justify-between relative">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center relative z-10">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500
                ${currentStep >= s ? 'bg-brand-teal text-white shadow-glow-teal' : 'bg-white/5 border border-white/10 text-white/40'}
              `}>
                {s}
              </div>
              <span className={`mt-2 text-[8px] font-bold uppercase tracking-widest ${currentStep >= s ? 'text-brand-teal' : 'text-white/20'}`}>
                {s === 1 ? 'Team Info' : s === 2 ? 'Waivers' : 'Review'}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5 -z-0"></div>
          <div 
            className="absolute top-5 left-0 h-[2px] bg-brand-teal transition-all duration-500 -z-0"
            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
          ></div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="glass-card border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Parent / Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Contact Name</label>
                <input 
                  type="text" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.name}
                  onChange={e => setParentInfo({ ...parentInfo, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email Address</label>
                <input 
                  type="email" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.email}
                  onChange={e => setParentInfo({ ...parentInfo, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone Number</label>
                <input 
                  type="tel" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.phone}
                  onChange={e => setParentInfo({ ...parentInfo, phone: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="glass-card border-brand-teal/20 p-8 space-y-8 bg-brand-teal/5">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Team Roster</h2>
                <p className="text-brand-teal text-xs font-bold uppercase tracking-widest">Two players required for doubles tournament</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {players.map((player, i) => (
                <div key={i} className="space-y-6 p-6 rounded-2xl border border-white/5 bg-black/20">
                  <h3 className="text-lg font-heading font-bold text-white uppercase">Player #{i + 1}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">First Name</label>
                      <input 
                        type="text" required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-teal outline-none"
                        value={player.firstName}
                        onChange={e => updatePlayer(i, 'firstName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Last Name</label>
                      <input 
                        type="text" required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-teal outline-none"
                        value={player.lastName}
                        onChange={e => updatePlayer(i, 'lastName', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Grade (Fall '26)</label>
                    <select 
                      required
                      className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-teal outline-none"
                      value={player.grade}
                      onChange={e => updatePlayer(i, 'grade', e.target.value)}
                    >
                      <option value="">Select Grade</option>
                      {['6th', '7th', '8th', '9th', '10th', '11th', '12th'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Medical Info / Allergies</label>
                    <textarea 
                      placeholder="Write 'None' if applicable"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-brand-teal outline-none min-h-[80px]"
                      value={player.medicalInfo}
                      onChange={e => updatePlayer(i, 'medicalInfo', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Legal Waiver</h2>
            <p className="text-white/40 text-sm font-medium">Please review and sign for the team.</p>
          </div>
          <LiabilityWaiver 
            athleteName="both participants"
            agreed={waiverAgreed}
            onChange={setWaiverAgreed}
          />
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card border-brand-teal/20 p-8 text-center space-y-6">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Review Registration</h2>
            <div className="max-w-md mx-auto space-y-4 text-left">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40 text-xs uppercase font-bold">Event</span>
                <span className="text-white text-xs font-bold uppercase">{event.name}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40 text-xs uppercase font-bold">Players</span>
                <span className="text-white text-xs font-bold uppercase">{players[0].firstName} & {players[1].firstName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40 text-xs uppercase font-bold">Price</span>
                <span className="text-brand-teal text-sm font-bold">${(total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center max-w-4xl mx-auto pt-8">
        {currentStep > 1 ? (
          <button type="button" onClick={prevStep} className="btn border border-white/10 text-white !px-8">
            Back
          </button>
        ) : <div />}
        
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="btn btn-primary !px-12 relative overflow-hidden group"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Processing...
            </span>
          ) : (
            currentStep === 3 ? `Pay $${(total / 100).toFixed(2)}` : 'Continue'
          )}
        </button>
      </div>
    </form>
  );
}
