import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import LiabilityWaiver from './LiabilityWaiver';

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
  profileId?: number;
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  grade: string;
  school: string;
  gradYear: string;
  experience: string;
  positions: string[];
  medicalInfo: string;
  selectedEvents: string[];
  waiverAgreed?: boolean;
}

const grades = ['5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', 'Other'];
const gradYears = ['2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', 'Other'];
const positions = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero / DS', 'Unsure'];

interface SavedAthlete {
  id: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  grade: string;
  school?: string;
  gradYear?: string;
  experience?: string;
  positions?: string; // Stored as comma-separated or JSON
  medicalInfo: string;
  waiverAgreed: boolean;
}

export default function TryoutRegistrationForm({ 
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
    phone: '',
    secondaryName: '',
    secondaryEmail: '',
    secondaryPhone: '',
    emergencyPhone: currentUser?.emergencyPhone || '',
  });

  const [athletes, setAthletes] = useState<Athlete[]>([
    {
      firstName: '',
      lastName: '',
      preferredName: '',
      dateOfBirth: '',
      gender: 'Girls',
      grade: '',
      school: '',
      gradYear: '',
      experience: '',
      positions: [],
      medicalInfo: '',
      selectedEvents: [],
      waiverAgreed: false,
    }
  ]);

  const [expandedWaivers, setExpandedWaivers] = useState<boolean[]>([false]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (expandedWaivers.length !== athletes.length) {
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [total, setTotal] = useState(0);

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
    setAthletes(prev => [...prev, {
      firstName: '',
      lastName: '',
      preferredName: '',
      dateOfBirth: '',
      gender: 'Girls',
      grade: '',
      school: '',
      gradYear: '',
      experience: '',
      positions: [],
      medicalInfo: '',
      selectedEvents: [],
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

  const togglePosition = (athleteIndex: number, position: string) => {
    setAthletes(prev => {
      const next = [...prev];
      const currentPositions = next[athleteIndex].positions;
      if (currentPositions.includes(position)) {
        next[athleteIndex].positions = currentPositions.filter(p => p !== position);
      } else {
        next[athleteIndex].positions = [...currentPositions, position];
      }
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
        toast.error("Please complete all required parent and emergency contact information.");
        return;
      }
    } else if (currentStep === 2) {
      if (athletes.some(a => !a.firstName || !a.lastName || !a.dateOfBirth || !a.grade || !a.school || !a.gradYear || !a.experience || a.positions.length === 0)) {
        toast.error("Please complete all required athlete details, including graduation year, experience, and positions.");
        return;
      }
    } else if (currentStep === 3) {
      if (athletes.some(a => a.selectedEvents.length === 0)) {
        toast.error("Please select at least one tryout session for each athlete.");
        return;
      }
    } else if (currentStep === 4) {
      if (athletes.some(a => !a.waiverAgreed)) {
        toast.error("Please sign the liability waiver for all athletes.");
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
    if (currentStep < 5) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Format positions for DB
      const formattedAthletes = athletes.map(a => ({
        ...a,
        positions: a.positions.join(', '),
      }));

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parentInfo: {
            ...parentInfo,
            secondaryParentName: parentInfo.secondaryName,
            secondaryParentEmail: parentInfo.secondaryEmail,
            secondaryParentPhone: parentInfo.secondaryPhone,
          }, 
          athletes: formattedAthletes 
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-12" data-hydrated={isHydrated}>
      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="flex items-center justify-between relative">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex flex-col items-center relative z-10">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500
                ${currentStep >= s ? 'bg-brand-teal text-white shadow-glow-teal' : 'bg-white/5 border border-white/10 text-white/40'}
              `}>
                {s}
              </div>
              <span className={`mt-2 text-[8px] font-bold uppercase tracking-widest ${currentStep >= s ? 'text-brand-teal' : 'text-white/20'}`}>
                {s === 1 ? 'Parent' : s === 2 ? 'Athlete' : s === 3 ? 'Sessions' : s === 4 ? 'Waivers' : 'Review'}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5 -z-0"></div>
          <div 
            className="absolute top-5 left-0 h-[2px] bg-brand-teal transition-all duration-500 -z-0"
            style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="glass-card border-white/10 p-8 space-y-8">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Parent / Guardian Information</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary Contact Name *</label>
                <input 
                  type="text" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                  value={parentInfo.name}
                  onChange={e => setParentInfo({ ...parentInfo, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary Email *</label>
                <input 
                  type="email" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                  value={parentInfo.email}
                  onChange={e => setParentInfo({ ...parentInfo, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary Phone *</label>
                <input 
                  type="tel" required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                  value={parentInfo.phone}
                  onChange={e => setParentInfo({ ...parentInfo, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">Emergency Phone *</label>
                <input 
                  type="tel" required
                  className="w-full bg-brand-teal/5 border border-brand-teal/20 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                  value={parentInfo.emergencyPhone}
                  onChange={e => setParentInfo({ ...parentInfo, emergencyPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-lg font-bold text-white/60 uppercase tracking-tight mb-6">Secondary Contact (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Secondary Name</label>
                  <input 
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                    value={parentInfo.secondaryName}
                    onChange={e => setParentInfo({ ...parentInfo, secondaryName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Secondary Email</label>
                  <input 
                    type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                    value={parentInfo.secondaryEmail}
                    onChange={e => setParentInfo({ ...parentInfo, secondaryEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Secondary Phone</label>
                  <input 
                    type="tel"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                    value={parentInfo.secondaryPhone}
                    onChange={e => setParentInfo({ ...parentInfo, secondaryPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </section>
          
          <div className="flex justify-end">
            <button type="button" onClick={nextStep} className="btn btn-primary px-12">Next: Athlete Info</button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {athletes.map((athlete, index) => (
            <section key={index} className="glass-card border-brand-teal/20 p-8 space-y-8 relative">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Athlete #{index + 1}</h2>
                {athletes.length > 1 && (
                  <button type="button" onClick={() => removeAthlete(index)} className="text-brand-coral text-xs font-bold uppercase tracking-widest">Remove</button>
                )}
              </div>

              {userAthletes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Select Saved Player</p>
                  <div className="flex flex-wrap gap-2">
                    {userAthletes.map(sa => (
                      <button
                        key={sa.id}
                        type="button"
                        onClick={() => {
                          updateAthlete(index, 'profileId', sa.id);
                          updateAthlete(index, 'firstName', sa.firstName);
                          updateAthlete(index, 'lastName', sa.lastName);
                          updateAthlete(index, 'preferredName', sa.preferredName || '');
                          updateAthlete(index, 'dateOfBirth', sa.dateOfBirth || '');
                          updateAthlete(index, 'gender', sa.gender || 'Girls');
                          updateAthlete(index, 'grade', sa.grade);
                          updateAthlete(index, 'school', sa.school || '');
                          updateAthlete(index, 'gradYear', sa.gradYear || '');
                          updateAthlete(index, 'experience', sa.experience || '');
                          updateAthlete(index, 'medicalInfo', sa.medicalInfo || '');
                        }}
                        className="bg-white/5 hover:bg-brand-teal/20 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold transition-all"
                      >
                        {sa.firstName} {sa.lastName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">First Name *</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.firstName} onChange={e => updateAthlete(index, 'firstName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Last Name *</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.lastName} onChange={e => updateAthlete(index, 'lastName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Preferred Name</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.preferredName} onChange={e => updateAthlete(index, 'preferredName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Date of Birth *</label>
                  <input type="date" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.dateOfBirth} onChange={e => updateAthlete(index, 'dateOfBirth', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Grade (Fall '26) *</label>
                  <select required className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.grade} onChange={e => updateAthlete(index, 'grade', e.target.value)}>
                    <option value="">Select Grade</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">School *</label>
                  <input type="text" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.school} onChange={e => updateAthlete(index, 'school', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">High School Graduation Year *</label>
                  <select required className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.gradYear} onChange={e => updateAthlete(index, 'gradYear', e.target.value)}>
                    <option value="">Select Year</option>
                    {gradYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Gender Division Registering for *</label>
                  <select required className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none" value={athlete.gender} onChange={e => updateAthlete(index, 'gender', e.target.value)}>
                    <option value="Girls">Girls</option>
                    <option value="Boys">Boys</option>
                    <option value="Other">Other / Contact Club</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary Position(s) Interested In *</label>
                <div className="flex flex-wrap gap-3">
                  {positions.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePosition(index, p)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${athlete.positions.includes(p) ? 'bg-brand-teal border-brand-teal text-white' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Volleyball Background / Experience *</label>
                <textarea 
                  required
                  placeholder="Tell us about previous club experience, school teams, or years played."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[100px]"
                  value={athlete.experience}
                  onChange={e => updateAthlete(index, 'experience', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 text-brand-coral">Medical Info / Allergies *</label>
                <textarea 
                  required
                  placeholder="List any critical medical information or allergies. Write 'None' if not applicable."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[100px]"
                  value={athlete.medicalInfo}
                  onChange={e => updateAthlete(index, 'medicalInfo', e.target.value)}
                />
              </div>
            </section>
          ))}
          
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <button type="button" onClick={addAthlete} className="text-brand-teal font-bold uppercase tracking-widest text-xs hover:text-white transition-colors">+ Add Another Athlete</button>
            <div className="flex gap-4">
              <button type="button" onClick={prevStep} className="btn btn-secondary px-8">Back</button>
              <button type="button" onClick={nextStep} className="btn btn-primary px-12">Next: Sessions</button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {athletes.map((athlete, index) => (
            <section key={index} className="glass-card border-brand-teal/20 p-8 space-y-8">
              <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Select Tryout for {athlete.firstName}</h2>
              
              <div className="bg-brand-teal/5 border border-brand-teal/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">📅</span>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">Age Eligibility Reminder</h4>
                </div>
                <p className="text-sm text-white/70 leading-relaxed mb-4">
                  For the 2026-2027 Season, players are grouped by their age as of <span className="text-brand-teal font-bold underline underline-offset-4">June 30, 2027</span>. 
                  Athletes may play in their designated age division or older, but <span className="text-brand-coral font-bold italic">never younger</span>. 
                  For example, a player who turns 16 by June 30, 2027, is eligible for 16U or higher.
                </p>
                <p className="text-sm text-white/70 leading-relaxed border-t border-white/5 pt-4">
                  <span className="text-brand-coral font-bold">Note:</span> Players who want to try out for an age group older than what they qualify for must get permission from the club director before registering.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {initialEvents.map(event => (
                  <button
                    key={event.id}
                    type="button"
                    disabled={event.spotsFilled >= event.capacity}
                    onClick={() => toggleEvent(index, event.id)}
                    className={`text-left p-6 rounded-2xl border transition-all ${athlete.selectedEvents.includes(event.id) ? 'bg-brand-teal/10 border-brand-teal shadow-glow-teal/20' : 'bg-white/5 border-white/10 hover:border-white/20'} ${event.spotsFilled >= event.capacity ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">{event.name}</span>
                      <span className="text-xs font-bold text-white">${(event.price / 100).toFixed(0)}</span>
                    </div>
                    <div className="text-lg font-heading font-bold text-white mb-1">{event.dateInfo}</div>
                    <div className="text-xs text-white/40 mb-4">{event.timeInfo}</div>
                    {event.spotsFilled >= event.capacity && <div className="text-[10px] font-bold text-brand-coral uppercase tracking-widest">Session Full</div>}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <div className="flex justify-end gap-4">
            <button type="button" onClick={prevStep} className="btn btn-secondary px-8">Back</button>
            <button type="button" onClick={nextStep} className="btn btn-primary px-12">Next: Waivers</button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {athletes.map((athlete, index) => (
            <section key={index} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal font-bold text-xs">{index + 1}</div>
                <h2 className="text-xl font-heading font-bold text-white uppercase tracking-tight">Liability Waiver: {athlete.firstName} {athlete.lastName}</h2>
              </div>
              <LiabilityWaiver athleteName={`${athlete.firstName} ${athlete.lastName}`} agreed={athlete.waiverAgreed} onChange={agreed => updateAthlete(index, 'waiverAgreed', agreed)} />
            </section>
          ))}

          <div className="flex justify-end gap-4">
            <button type="button" onClick={prevStep} className="btn btn-secondary px-8">Back</button>
            <button type="button" onClick={nextStep} className="btn btn-primary px-12">Next: Review</button>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section className="glass-card border-white/10 p-8 space-y-8">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Registration Summary</h2>
            <div className="space-y-6">
              {athletes.map((athlete, index) => (
                <div key={index} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0">
                  <div>
                    <h4 className="font-bold text-white">{athlete.firstName} {athlete.lastName}</h4>
                    <p className="text-xs text-white/40 uppercase tracking-widest mt-1">
                      {athlete.selectedEvents.map(id => initialEvents.find(e => e.id === id)?.name).join(', ')}
                    </p>
                  </div>
                  <div className="text-brand-teal font-bold">
                    ${(athlete.selectedEvents.reduce((acc, id) => acc + (initialEvents.find(e => e.id === id)?.price || 0), 0) / 100).toFixed(0)}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-6">
                <span className="text-xl font-heading font-bold text-white uppercase tracking-tighter">Total Amount</span>
                <span className="text-2xl font-heading font-extrabold text-brand-teal shadow-glow-teal/20">${(total / 100).toFixed(2)}</span>
              </div>
            </div>
          </section>

          <div className="flex flex-col sm:flex-row justify-end gap-4">
            <button type="button" onClick={prevStep} className="btn btn-secondary px-8" disabled={isSubmitting}>Back</button>
            <button type="submit" className="btn btn-primary px-12" disabled={isSubmitting}>
              {isSubmitting ? 'Redirecting to Payment...' : 'Confirm & Pay'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
