import React, { useState, useEffect } from 'react';
import LiabilityWaiver from './LiabilityWaiver';
import MediaRelease from './MediaRelease';

interface Event {
  id: string;
  name: string;
  type: string;
  dateInfo: string;
  timeInfo: string;
  price: number;
  capacity: number;
  spotsFilled: number;
  pendingSpots: number;
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

interface SavedAthlete {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  medicalInfo: string;
  tshirtSize?: string;
  waiverAgreed: boolean;
  photoReleaseAgreed: boolean;
}

export default function RegistrationForm({ 
  initialEvents, 
  userAthletes = [], 
  currentUser 
}: { 
  initialEvents: Event[],
  userAthletes?: SavedAthlete[],
  currentUser?: any
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [parentInfo, setParentInfo] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '', // This is the parent's general contact phone
    emergencyPhone: currentUser?.emergencyPhone || '', // Pre-fill with emergency contact from profile
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

  const getSelectedCount = (athleteIndex: number, tabId: string) => {
    return athletes[athleteIndex].selectedEvents.filter(id => {
      const event = initialEvents.find(e => e.id === id);
      if (!event) return false;
      
      if (tabId === 'camps') return event.type === 'camp';
      if (tabId === 'tryout-prep') return event.type === 'clinic' && event.id.includes('clinic-tryout-prep');
      if (tabId === 'clinics') return event.type === 'clinic' && !event.id.includes('clinic-tryout-prep');
      
      return false;
    }).length;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [total, setTotal] = useState(0);

  // Calculate total whenever athletes or event selection changes
  useEffect(() => {
    let newTotal = 0;
    const uniqueTrainingBlockIds = new Set<string>();

    athletes.forEach(athlete => {
      athlete.selectedEvents.forEach(eventId => {
        const event = initialEvents.find(e => e.id === eventId);
        if (!event) return;

        if (event.type === 'training-block') {
          uniqueTrainingBlockIds.add(eventId);
        } else {
          newTotal += event.price;
        }
      });
    });

    // Add unique training blocks once (flat fee)
    uniqueTrainingBlockIds.forEach(id => {
      const event = initialEvents.find(e => e.id === id);
      if (event) newTotal += event.price;
    });

    setTotal(newTotal);
  }, [athletes, initialEvents]);

  const addAthlete = () => {
    setAthletes(prev => [...prev, {
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
    setAthletes(prev => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const updateAthlete = (index: number, field: keyof Athlete, value: any) => {
    setAthletes(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleEvent = (athleteIndex: number, eventId: string) => {
    setAthletes(prev => {
      const next = [...prev];
      const eventList = next[athleteIndex].selectedEvents;
      if (eventList.includes(eventId)) {
        next[athleteIndex].selectedEvents = eventList.filter(id => id !== eventId);
      } else {
        next[athleteIndex].selectedEvents = [...eventList, eventId];
      }
      return next;
    });
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!parentInfo.name || !parentInfo.email || !parentInfo.phone || !parentInfo.emergencyPhone) {
        alert("Please complete all parent and emergency contact information.");
        return;
      }
      if (athletes.some(a => !a.firstName || !a.lastName || !a.grade || !a.medicalInfo)) {
        alert("Please complete all athlete details (names, grade, and medical info).");
        return;
      }
    } else if (currentStep === 2) {
      if (athletes.some(a => a.selectedEvents.length === 0)) {
        alert("Please select at least one event for each athlete.");
        return;
      }
    } else if (currentStep === 3) {
      if (athletes.some(a => !a.waiverAgreed)) {
        alert("Please sign the liability waiver for all athletes.");
        return;
      }
    }
    
    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 4) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    
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
      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="flex items-center justify-between relative">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex flex-col items-center relative z-10">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500
                ${currentStep >= s ? 'bg-brand-teal text-white shadow-glow-teal' : 'bg-white/5 border border-white/10 text-white/40'}
              `}>
                {s}
              </div>
              <span className={`mt-2 text-[8px] font-bold uppercase tracking-widest ${currentStep >= s ? 'text-brand-teal' : 'text-white/20'}`}>
                {s === 1 ? 'Info' : s === 2 ? 'Events' : s === 3 ? 'Waivers' : 'Review'}
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

      {currentStep === 1 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Parent Contact Section */}
          <section className="glass-card border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Parent / Guardian Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label htmlFor="parentName" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Full Name</label>
                <input 
                  id="parentName"
                  type="text" 
                  name="parentName"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.name}
                  onChange={e => setParentInfo(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="parentEmail" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Email Address</label>
                <input 
                  id="parentEmail"
                  type="email" 
                  name="parentEmail"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.email}
                  onChange={e => setParentInfo(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="parentPhone" className="text-[10px] font-bold uppercase tracking-widest text-white/50">Your Phone</label>
                <input 
                  id="parentPhone"
                  type="tel" 
                  name="parentPhone"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base md:text-sm focus:border-brand-teal outline-none transition-colors"
                  value={parentInfo.phone}
                  onChange={e => setParentInfo(prev => ({ ...prev, phone: e.target.value }))}
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
                  onChange={e => setParentInfo(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                />
              </div>
            </div>
          </section>

          {/* Athletes Section (Basic Info) */}
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

              {userAthletes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Quick Select Saved Player</p>
                  <div className="flex flex-wrap gap-2">
                    {userAthletes.map(sa => (
                      <button
                        key={sa.id}
                        type="button"
                        onClick={() => {
                          updateAthlete(index, 'firstName', sa.firstName);
                          updateAthlete(index, 'lastName', sa.lastName);
                          updateAthlete(index, 'grade', sa.grade);
                          updateAthlete(index, 'medicalInfo', sa.medicalInfo || '');
                          updateAthlete(index, 'waiverAgreed', sa.waiverAgreed || false);
                          updateAthlete(index, 'photoReleaseAgreed', sa.photoReleaseAgreed || false);
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
          ))}
          
          <div className="flex justify-center">
            <button 
              type="button"
              onClick={addAthlete}
              className="px-8 py-4 rounded-2xl border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-3"
            >
              <span className="text-brand-teal text-xl">+</span> Add Another Athlete
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Select Events</h2>
            <p className="text-white/40 text-sm font-medium">Choose camps and clinics for each athlete.</p>
          </div>
          {athletes.map((athlete, index) => (
            <section key={index} className="glass-card border-brand-teal/20 p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal font-bold">
                  {index + 1}
                </div>
                <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">
                  Events for {athlete.firstName || `Athlete #${index + 1}`}
                </h3>
              </div>

              {/* Event Selection */}
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    {[
                      { id: 'camps', label: 'Summer Camps', count: getSelectedCount(index, 'camps') },
                      { id: 'clinics', label: 'Skills Clinics', count: getSelectedCount(index, 'clinics') },
                      { id: 'tryout-prep', label: 'Tryout Prep', count: getSelectedCount(index, 'tryout-prep') }
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
                            const months = { 'May': 5, 'June': 6, 'July': 7, 'August': 8, 'October': 10, 'November': 11 };
                            const getMonthDay = (info: string) => {
                              const match = info.match(/(May|June|July|August|October|November)\s+(\d+)/);
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
                                const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
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
                                      {isFull ? (
                                        <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Waitlist Only</span>
                                      ) : (
                                        event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0)) <= 5 && (
                                          <span className="block text-[8px] font-bold text-brand-teal uppercase tracking-widest animate-pulse">
                                            Only {event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0))} spots left!
                                          </span>
                                        )
                                      )}
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

                  {/* Tryout Prep Grouping */}
                  {athleteTabStates[index] === 'tryout-prep' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {[
                        { title: 'Tryout Prep Clinics', pattern: 'clinic-tryout-prep' }
                      ].map(group => {
                        const groupEvents = initialEvents
                          .filter(e => e.type === 'clinic' && e.id.includes(group.pattern))
                          .sort((a, b) => {
                            const months = { 'May': 5, 'June': 6, 'July': 7, 'August': 8, 'October': 10, 'November': 11 };
                            const getMonthDay = (info: string) => {
                              const match = info.match(/(May|June|July|August|October|November)\s+(\d+)/);
                              if (!match) return 0;
                              return months[match[1] as keyof typeof months] * 100 + parseInt(match[2]);
                            };
                            return getMonthDay(a.dateInfo) - getMonthDay(b.dateInfo);
                          });

                        if (groupEvents.length === 0) return (
                          <div key={group.title} className="p-12 text-center glass-card border-white/5">
                            <p className="text-white/40 text-sm italic">No tryout prep clinics are currently available for registration.</p>
                          </div>
                        );

                        return (
                          <div key={group.title} className="space-y-3">
                            <h5 className="text-brand-teal text-[9px] font-bold uppercase tracking-widest px-2">{group.title}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {groupEvents.map(event => {
                                const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
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
                                      {isFull ? (
                                        <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Waitlist Only</span>
                                      ) : (
                                        event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0)) <= 5 && (
                                          <span className="block text-[8px] font-bold text-brand-teal uppercase tracking-widest animate-pulse">
                                            Only {event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0))} spots left!
                                          </span>
                                        )
                                      )}
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
                                const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
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
                                      {isFull ? (
                                        <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Waitlist Only</span>
                                      ) : (
                                        event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0)) <= 5 && (
                                          <span className="block text-[8px] font-bold text-brand-teal uppercase tracking-widest animate-pulse">
                                            Only {event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0))} spots left!
                                          </span>
                                        )
                                      )}
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
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Legal Waivers</h2>
            <p className="text-white/40 text-sm font-medium">Please review and sign the waivers for each athlete.</p>
          </div>
          {athletes.map((athlete, index) => (
            <section key={index} className="glass-card border-brand-teal/20 p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal font-bold">
                  {index + 1}
                </div>
                <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">
                  Waivers for {athlete.firstName} {athlete.lastName}
                </h3>
              </div>
              
              <div className="space-y-8">
                <MediaRelease 
                  athleteName={athlete.firstName} 
                  agreed={athlete.photoReleaseAgreed} 
                  onChange={(val) => updateAthlete(index, 'photoReleaseAgreed', val)} 
                />
                
                <LiabilityWaiver 
                  athleteName={athlete.firstName} 
                  agreed={athlete.waiverAgreed} 
                  onChange={(val) => updateAthlete(index, 'waiverAgreed', val)} 
                />
              </div>
            </section>
          ))}
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Verify Registration</h2>
            <p className="text-white/40 text-sm font-medium">Review your details before proceeding to payment.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Parent Summary */}
              <section className="glass-card border-white/10 p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-teal">Parent / Guardian</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Name</span>
                    <span className="text-white font-medium">{parentInfo.name}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Email</span>
                    <span className="text-white font-medium">{parentInfo.email}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Phone</span>
                    <span className="text-white font-medium">{parentInfo.phone}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-widest text-white/40 font-bold mb-1">Emergency</span>
                    <span className="text-brand-teal font-bold">{parentInfo.emergencyPhone}</span>
                  </div>
                </div>
              </section>

              {/* Athletes Summary */}
              {athletes.map((athlete, idx) => (
                <section key={idx} className="glass-card border-white/10 p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-brand-teal">Athlete: {athlete.firstName} {athlete.lastName}</h3>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-white/60 font-bold uppercase tracking-widest">Grade: {athlete.grade}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[8px] uppercase tracking-widest text-white/40 font-bold mb-2">Selected Events</span>
                      <div className="space-y-2">
                        {athlete.selectedEvents.map(eventId => {
                          const event = initialEvents.find(e => e.id === eventId);
                          return (
                            <div key={eventId} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                              <div>
                                <span className="block text-sm text-white font-medium">{event?.name}</span>
                                <span className="block text-[10px] text-white/40 uppercase tracking-widest font-bold">{event?.dateInfo}</span>
                              </div>
                              <span className="text-brand-teal font-bold">${((event?.price || 0) / 100).toFixed(0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="glass-card border-brand-teal/30 p-8 sticky top-24 space-y-6">
                <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">Order Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Total Athletes</span>
                    <span className="text-white font-bold">{athletes.length}</span>
                  </div>
                  <div className="h-px bg-white/10"></div>
                  <div className="flex justify-between items-end">
                    <span className="text-white/60 text-sm">Amount Due</span>
                    <span className="text-3xl font-heading font-bold text-brand-teal">${(total / 100).toFixed(0)}</span>
                  </div>
                </div>
                
                <div className="pt-6 space-y-4">
                  <div className="flex items-center gap-2 text-[10px] text-white/40 leading-tight">
                    <span className="text-brand-teal">✓</span> All waivers signed and verified
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 leading-tight">
                    <span className="text-brand-teal">✓</span> Secure checkout via Stripe
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Terms (Static) */}
      <div className="mt-12 pt-8 border-t border-white/5 mb-24">
        <p className="text-[10px] text-white/30 leading-relaxed max-w-lg mx-auto text-center">
          {currentStep === 4 
            ? 'By clicking "Secure Spot", you agree to our registration terms and will be redirected to Stripe to securely complete your payment.' 
            : 'Continue through the steps to complete your registration. Your spot is not reserved until payment is completed.'}
          <a href="/privacy-security" className="text-brand-teal hover:underline ml-1">Learn how we protect your data & privacy.</a>
        </p>
      </div>

      {/* Condensed Sticky Footer Summary */}
      <div className="sticky bottom-4 left-0 right-0 z-50 px-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="glass-card border-brand-teal/30 p-3 md:p-4 flex flex-row items-center justify-between gap-4 shadow-2xl backdrop-blur-xl bg-brand-charcoal/90">
            <div className="flex items-center gap-4 md:gap-8 ml-2">
              {currentStep > 1 && (
                <button 
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-3 rounded-lg border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Back
                </button>
              )}
              <div className="flex items-center gap-4">
                <div className="flex flex-col md:block">
                  <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none mb-1">Total</span>
                  <span className="text-lg md:text-2xl font-heading font-bold text-brand-teal leading-none block md:inline md:ml-2">${(total / 100).toFixed(0)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                type="submit"
                disabled={isSubmitting || (currentStep === 2 && total === 0)}
                className={`
                  px-6 md:px-10 py-3 rounded-lg font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg
                  ${isSubmitting || (currentStep === 2 && total === 0) ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-brand-teal text-white hover:shadow-glow-teal'}
                `}
              >
                {isSubmitting ? 'Wait...' : currentStep === 4 ? 'Secure Spot' : 'Next Step'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
