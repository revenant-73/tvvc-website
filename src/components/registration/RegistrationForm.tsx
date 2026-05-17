import React, { useState, useEffect } from 'react';
import WaiverModal from './WaiverModal';

interface Event {
  id: string;
  name: string;
  type: string;
  dateInfo: string;
  timeInfo: string;
  price: number;
  capacity: number;
  spotsFilled: number;
}

interface Athlete {
  firstName: string;
  lastName: string;
  grade: string;
  medicalInfo: string;
  selectedEvents: string[];
  photoReleaseAgreed: boolean;
  waiverAgreed: boolean;
}

const grades = ['4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

export default function RegistrationForm({ initialEvents }: { initialEvents: Event[] }) {
  const [parentInfo, setParentInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [athletes, setAthletes] = useState<Athlete[]>([
    {
      firstName: '',
      lastName: '',
      grade: '',
      medicalInfo: '',
      selectedEvents: [],
      photoReleaseAgreed: false,
      waiverAgreed: false,
    }
  ]);

  const [athleteTabStates, setAthleteTabStates] = useState<string[]>(['camps']);
  const [expandedWaivers, setExpandedWaivers] = useState<boolean[]>([false]);

  // Update states if athletes are added/removed
  useEffect(() => {
    if (athleteTabStates.length !== athletes.length) {
      setAthleteTabStates(prev => {
        const next = [...prev];
        if (athletes.length > prev.length) {
          for (let i = prev.length; i < athletes.length; i++) next.push('camps');
        } else {
          next.splice(athletes.length);
        }
        return next;
      });
      
      setExpandedWaivers(prev => {
        const next = [...prev];
        if (athletes.length > prev.length) {
          for (let i = prev.length; i < athletes.length; i++) next.push(false);
        } else {
          next.splice(athletes.length);
        }
        return next;
      });
    }
  }, [athletes]);

  const toggleWaiver = (index: number) => {
    const next = [...expandedWaivers];
    next[index] = !next[index];
    setExpandedWaivers(next);
  };

  const setAthleteTab = (index: number, tab: string) => {
    const next = [...athleteTabStates];
    next[index] = tab;
    setAthleteTabStates(next);
  };

  const getSelectedCount = (athleteIndex: number, type: 'camp' | 'clinic') => {
    return athletes[athleteIndex].selectedEvents.filter(id => {
      const event = initialEvents.find(e => e.id === id);
      return event?.type === type;
    }).length;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [total, setTotal] = useState(0);

  // Calculate total whenever athletes or event selection changes
  useEffect(() => {
    let newTotal = 0;
    athletes.forEach(athlete => {
      athlete.selectedEvents.forEach(eventId => {
        const event = initialEvents.find(e => e.id === eventId);
        if (event) newTotal += event.price;
      });
    });
    setTotal(newTotal);
  }, [athletes, initialEvents]);

  const addAthlete = () => {
    setAthletes([...athletes, {
      firstName: '',
      lastName: '',
      grade: '',
      medicalInfo: '',
      selectedEvents: [],
      photoReleaseAgreed: false,
      waiverAgreed: false,
    }]);
  };

  const removeAthlete = (index: number) => {
    if (athletes.length > 1) {
      const newAthletes = [...athletes];
      newAthletes.splice(index, 1);
      setAthletes(newAthletes);
    }
  };

  const updateAthlete = (index: number, field: keyof Athlete, value: any) => {
    const newAthletes = [...athletes];
    newAthletes[index] = { ...newAthletes[index], [field]: value };
    setAthletes(newAthletes);
  };

  const toggleEvent = (athleteIndex: number, eventId: string) => {
    const newAthletes = [...athletes];
    const eventList = newAthletes[athleteIndex].selectedEvents;
    if (eventList.includes(eventId)) {
      newAthletes[athleteIndex].selectedEvents = eventList.filter(id => id !== eventId);
    } else {
      newAthletes[athleteIndex].selectedEvents = [...eventList, eventId];
    }
    setAthletes(newAthletes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Validation
    const isParentInfoComplete = parentInfo.name && parentInfo.email && parentInfo.phone;
    const hasIncompleteAthletes = athletes.some(a => 
      !a.firstName || !a.lastName || !a.grade || !a.medicalInfo || a.selectedEvents.length === 0 || !a.waiverAgreed
    );

    if (!isParentInfoComplete || hasIncompleteAthletes) {
      alert("Please complete all parent information, athlete details (including medical info), select at least one event per athlete, and agree to the waivers.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentInfo, athletes }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {/* Parent Contact Section */}
      <section className="glass-card border-white/10 p-8 space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Parent / Guardian Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Full Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
              value={parentInfo.name}
              onChange={e => setParentInfo({ ...parentInfo, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
              value={parentInfo.email}
              onChange={e => setParentInfo({ ...parentInfo, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone Number</label>
            <input 
              type="tel" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
              value={parentInfo.phone}
              onChange={e => setParentInfo({ ...parentInfo, phone: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Athletes Section */}
      {athletes.map((athlete, index) => (
        <section key={index} className="glass-card border-brand-teal/20 p-8 space-y-8 relative">
          {athletes.length > 1 && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">First Name</label>
              <input 
                type="text" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
                value={athlete.firstName}
                onChange={e => updateAthlete(index, 'firstName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Last Name</label>
              <input 
                type="text" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
                value={athlete.lastName}
                onChange={e => updateAthlete(index, 'lastName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Grade (Fall '26)</label>
              <select 
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Medical Info / Allergies</label>
            <textarea 
              required
              placeholder="List any critical medical information or allergies. Write 'None' if not applicable."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[100px]"
              value={athlete.medicalInfo}
              onChange={e => updateAthlete(index, 'medicalInfo', e.target.value)}
            />
          </div>

          {/* Waivers Section (Inline Accordion) - MOVED UP */}
          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Action Required: Waivers</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleWaiver(index)}
              className={`
                w-full p-4 md:p-6 rounded-2xl border transition-all flex flex-row items-center justify-between gap-4
                ${athlete.waiverAgreed ? 'bg-brand-teal/5 border-brand-teal/30 hover:border-brand-teal' : 'bg-brand-coral/5 border-brand-coral/30 hover:border-brand-coral'}
              `}
            >
              <div className="text-left">
                <span className={`block font-bold text-xs md:text-sm uppercase tracking-widest ${athlete.waiverAgreed ? 'text-brand-teal' : 'text-brand-coral'}`}>
                  {athlete.waiverAgreed ? '✓ Waivers Completed' : '⚠ Sign Waivers'}
                </span>
                <span className="block text-[8px] md:text-[10px] text-white/40 mt-1 uppercase tracking-widest font-bold">
                  Liability Release & Media Consent for {athlete.firstName || `Athlete #${index + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`hidden md:block px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${athlete.waiverAgreed ? 'border-brand-teal/50 text-brand-teal' : 'bg-brand-coral text-white border-transparent'}`}>
                  {athlete.waiverAgreed ? 'Review' : 'Sign Now'}
                </div>
                <span className={`text-xl transition-transform duration-300 ${expandedWaivers[index] ? 'rotate-180' : ''}`}>
                  {expandedWaivers[index] ? '−' : '+'}
                </span>
              </div>
            </button>

            {expandedWaivers[index] && (
              <div className="glass-card border-white/10 p-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                
                {/* 1. Media Release (Optional) */}
                <section className="space-y-4">
                  <h4 className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-teal/20 flex items-center justify-center">1</span>
                    Media Release (Optional)
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    We use photos/videos of athletes for promotional purposes (website, social media). These images always reflect a positive, respectful environment.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateAthlete(index, 'photoReleaseAgreed', true)}
                      className={`p-3 rounded-xl border text-center transition-all ${athlete.photoReleaseAgreed ? 'bg-brand-teal/10 border-brand-teal' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <span className="block font-bold text-white text-xs">Agree</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAthlete(index, 'photoReleaseAgreed', false)}
                      className={`p-3 rounded-xl border text-center transition-all ${!athlete.photoReleaseAgreed ? 'bg-brand-coral/10 border-brand-coral' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    >
                      <span className="block font-bold text-white text-xs">Decline</span>
                    </button>
                  </div>
                </section>

                {/* 2. Liability Waiver (Required) */}
                <section className="space-y-4 pt-6 border-t border-white/5">
                  <h4 className="text-[10px] font-bold text-brand-coral uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-coral/20 flex items-center justify-center">2</span>
                    Liability Waiver (Required)
                  </h4>
                  <div className="text-[10px] text-white/40 leading-relaxed bg-black/20 p-4 rounded-xl h-40 overflow-y-auto border border-white/5 custom-scrollbar">
                    <p className="font-bold text-white mb-2 uppercase">Assumption of Risk & Release of Liability</p>
                    <p className="mb-4">Participation in TVVC programs involves inherent risks (collisions, falls, impact). I voluntarily assume all responsibility for any bodily injury or harm.</p>
                    <p className="mb-4">I hereby release TVVC, its owners, and staff from any liability or claims arising from participation.</p>
                    <p className="font-bold text-white italic">I have read this waiver in its entirety, understand its terms, and agree freely.</p>
                  </div>
                  <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${athlete.waiverAgreed ? 'bg-brand-teal/10 border-brand-teal' : 'bg-brand-coral/5 border-brand-coral/30'}`}>
                    <input 
                      type="checkbox"
                      required
                      checked={athlete.waiverAgreed}
                      onChange={(e) => updateAthlete(index, 'waiverAgreed', e.target.checked)}
                      className="accent-brand-teal w-5 h-5 shrink-0"
                    />
                    <span className="text-[11px] font-bold text-white leading-tight">
                      I agree to the Liability Waiver & Release
                    </span>
                  </label>
                </section>

                <button
                  type="button"
                  onClick={() => toggleWaiver(index)}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Minimize Waivers
                </button>
              </div>
            )}
          </div>

          {/* Event Selection */}
          <div className="space-y-6 pt-8 border-t border-white/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Select Events for {athlete.firstName || `Athlete #${index + 1}`}</h3>
              
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {[
                  { id: 'camps', label: 'Summer Camps', count: getSelectedCount(index, 'camp') },
                  { id: 'clinics', label: 'Skills Clinics', count: getSelectedCount(index, 'clinic') }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAthleteTab(index, tab.id)}
                    className={`
                      px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2
                      ${athleteTabStates[index] === tab.id ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20' : 'text-white/40 hover:text-white/60'}
                    `}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`
                        flex items-center justify-center w-4 h-4 rounded-full text-[8px]
                        ${athleteTabStates[index] === tab.id ? 'bg-white text-brand-teal' : 'bg-brand-teal text-white'}
                      `}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="min-h-[300px]">
              {/* Clinics Grouping */}
              {athleteTabStates[index] === 'clinics' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {[
                    { title: 'Hitting Clinics', pattern: 'clinic-hitting' },
                    { title: 'Serving Clinics', pattern: 'clinic-serving' },
                    { title: 'Defense & Receive Clinics', pattern: 'clinic-serve-receive-defense' }
                  ].map(group => {
                    const groupEvents = initialEvents
                      .filter(e => e.type === 'clinic' && e.id.includes(group.pattern))
                      .sort((a, b) => {
                        const months = { 'May': 5, 'June': 6, 'July': 7, 'August': 8 };
                        const getMonthDay = (info: string) => {
                          const match = info.match(/(May|June|July|August)\s+(\d+)/);
                          if (!match) return 0;
                          return months[match[1] as keyof typeof months] * 100 + parseInt(match[2]);
                        };
                        return getMonthDay(a.dateInfo) - getMonthDay(b.dateInfo);
                      });

                    if (groupEvents.length === 0) return null;

                    return (
                      <div key={group.title} className="space-y-3">
                        <h5 className="text-brand-teal text-[9px] font-bold uppercase tracking-widest px-2">{group.title}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {groupEvents.map(event => {
                            const isFull = event.spotsFilled >= event.capacity;
                            const isSelected = athlete.selectedEvents.includes(event.id);
                            
                            return (
                              <label 
                                key={event.id}
                                className={`
                                  flex items-center justify-between p-4 rounded-xl border transition-all
                                  ${isFull ? 'opacity-40 grayscale cursor-not-allowed bg-white/5 border-white/5' : 'cursor-pointer'}
                                  ${isSelected ? 'bg-brand-teal/10 border-brand-teal shadow-glow-teal' : 'bg-white/5 border-white/10 hover:border-white/30'}
                                `}
                              >
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="checkbox"
                                    disabled={isFull}
                                    checked={isSelected}
                                    onChange={() => toggleEvent(index, event.id)}
                                    className="accent-brand-teal w-4 h-4"
                                  />
                                  <div>
                                    <span className="block font-bold text-white text-sm">{event.name}</span>
                                    <span className="block text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                      {event.dateInfo} • {event.timeInfo}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="block font-bold text-brand-teal">${(event.price / 100).toFixed(0)}</span>
                                  {isFull && <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Waitlist Only</span>}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Camps Grouping */}
              {athleteTabStates[index] === 'camps' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {[
                    { title: 'Foundations & Performance (6th-8th Grade)', pattern: 'camp-foundations', pattern2: 'camp-performance' },
                    { title: 'Hitting Focus Camps', pattern: 'camp-hitting' },
                    { title: 'High School Tryout Prep', pattern: 'camp-hs-prep' },
                    { title: 'Youth Ignition (4th-6th Grade)', pattern: 'camp-ignition' }
                  ].map(group => {
                    const groupEvents = initialEvents
                      .filter(e => e.type === 'camp' && (e.id.includes(group.pattern) || (group.pattern2 && e.id.includes(group.pattern2))))
                      .sort((a, b) => {
                        const months = { 'May': 5, 'June': 6, 'July': 7, 'August': 8 };
                        const getMonthDay = (info: string) => {
                          const match = info.match(/(May|June|July|August)\s+(\d+)/);
                          if (!match) return 0;
                          return months[match[1] as keyof typeof months] * 100 + parseInt(match[2]);
                        };
                        return getMonthDay(a.dateInfo) - getMonthDay(b.dateInfo);
                      });

                    if (groupEvents.length === 0) return null;

                    return (
                      <div key={group.title} className="space-y-3">
                        <h5 className="text-brand-teal text-[9px] font-bold uppercase tracking-widest px-2">{group.title}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {groupEvents.map(event => {
                            const isFull = event.spotsFilled >= event.capacity;
                            const isSelected = athlete.selectedEvents.includes(event.id);
                            
                            return (
                              <label 
                                key={event.id}
                                className={`
                                  flex items-center justify-between p-4 rounded-xl border transition-all
                                  ${isFull ? 'opacity-40 grayscale cursor-not-allowed bg-white/5 border-white/5' : 'cursor-pointer'}
                                  ${isSelected ? 'bg-brand-teal/10 border-brand-teal shadow-glow-teal' : 'bg-white/5 border-white/10 hover:border-white/30'}
                                `}
                              >
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="checkbox"
                                    disabled={isFull}
                                    checked={isSelected}
                                    onChange={() => toggleEvent(index, event.id)}
                                    className="accent-brand-teal w-4 h-4"
                                  />
                                  <div>
                                    <span className="block font-bold text-white text-sm">{event.name}</span>
                                    <span className="block text-[10px] text-white/40 uppercase tracking-widest font-bold">
                                      {event.dateInfo} • {event.timeInfo}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="block font-bold text-brand-teal">${(event.price / 100).toFixed(0)}</span>
                                  {isFull && <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Waitlist Only</span>}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      ))}

      {/* Registration Terms (Static) */}
      <div className="mt-12 pt-8 border-t border-white/5 mb-24">
        <p className="text-[10px] text-white/30 leading-relaxed max-w-lg mx-auto text-center">
          By clicking "Secure Spot", you agree to our registration terms and will be redirected to Stripe to securely complete your payment. 
          <a href="/privacy-security" className="text-brand-teal hover:underline ml-1">Learn how we protect your data & privacy.</a>
        </p>
      </div>

      {/* Condensed Sticky Footer Summary */}
      <div className="sticky bottom-4 left-0 right-0 z-50 px-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="glass-card border-brand-teal/30 p-3 md:p-4 flex flex-row items-center justify-between gap-4 shadow-2xl backdrop-blur-xl bg-brand-charcoal/90">
            <div className="flex items-center gap-4 md:gap-8 ml-2">
              <div className="flex flex-col md:block">
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none mb-1">Athletes</span>
                <span className="text-lg md:text-2xl font-heading font-bold text-white leading-none block md:inline md:ml-2">{athletes.length}</span>
              </div>
              <div className="w-px h-6 md:h-8 bg-white/10"></div>
              <div className="flex flex-col md:block">
                <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none mb-1">Total</span>
                <span className="text-lg md:text-2xl font-heading font-bold text-brand-teal leading-none block md:inline md:ml-2">${(total / 100).toFixed(0)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={addAthlete}
                className="hidden sm:block px-4 py-3 rounded-lg border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all whitespace-nowrap"
              >
                + Add Athlete
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || total === 0}
                className={`
                  px-6 md:px-8 py-3 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg
                  ${isSubmitting || total === 0 ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-brand-teal text-white hover:shadow-glow-teal'}
                `}
              >
                {isSubmitting ? 'Wait...' : 'Secure Spot'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
