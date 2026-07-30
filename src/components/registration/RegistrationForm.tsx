import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { registrationSchema, type Athlete, type ParentInfo } from '../../lib/schemas';
import { StepIndicator } from './StepIndicator';
import { ParentInfoSection } from './ParentInfoSection';
import { AthleteInfoSection } from './AthleteInfoSection';
import { EventSelectionSection } from './EventSelectionSection';
import { WaiverSection } from './WaiverSection';
import { ReviewSection } from './ReviewSection';

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

interface SavedAthlete {
  id: number;
  firstName: string;
  lastName: string;
  grade: string;
  medicalInfo: string;
  tshirtSize?: string;
  waiverAgreed?: boolean;
  photoReleaseAgreed?: boolean;
}

export default function RegistrationForm({ 
  initialEvents, 
  userAthletes = [], 
  currentUser,
  initialTab = 'camps'
}: { 
  initialEvents: Event[],
  userAthletes?: SavedAthlete[],
  currentUser?: any,
  initialTab?: string
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [parentInfo, setParentInfo] = useState<ParentInfo>({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
    emergencyPhone: currentUser?.emergencyPhone || '',
  });

  const [athletes, setAthletes] = useState<Athlete[]>([
    {
      firstName: '',
      lastName: '',
      grade: '',
      medicalInfo: '',
      selectedEvents: [],
      photoReleaseAgreed: false,
      waiverAgreed: false as any, // Cast to any because Zod expects true
    }
  ]);

  const [athleteTabStates, setAthleteTabStates] = useState<string[]>(
    ['camps'].map(() => ['camps', 'clinics', 'tryout-prep'].includes(initialTab) ? initialTab : 'camps')
  );
  const [expandedWaivers, setExpandedWaivers] = useState<boolean[]>([false]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Sync tab states and expanded waivers when athletes count changes
  useEffect(() => {
    const tabToUse = ['camps', 'clinics', 'tryout-prep'].includes(initialTab) ? initialTab : 'camps';
    
    setAthleteTabStates(prev => {
      if (prev.length === athletes.length) return prev;
      if (athletes.length > prev.length) {
        return [...prev, ...Array(athletes.length - prev.length).fill(tabToUse)];
      }
      return prev.slice(0, athletes.length);
    });
    
    setExpandedWaivers(prev => {
      if (prev.length === athletes.length) return prev;
      if (athletes.length > prev.length) {
        return [...prev, ...Array(athletes.length - prev.length).fill(false)];
      }
      return prev.slice(0, athletes.length);
    });
  }, [athletes.length, initialTab]);

  // Calculate total
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
      waiverAgreed: false as any,
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

  const setAthleteTab = (index: number, tab: string) => {
    setAthleteTabStates(prev => {
      const next = [...prev];
      next[index] = tab;
      return next;
    });
  };

  const toggleWaiver = (index: number) => {
    setExpandedWaivers(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
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

  const nextStep = () => {
    if (currentStep === 1) {
      const step1Schema = registrationSchema.pick({ parentInfo: true }).extend({
        athletes: registrationSchema.shape.athletes.element.pick({
            firstName: true,
            lastName: true,
            grade: true,
            medicalInfo: true
        }).array()
      });

      const validation = step1Schema.safeParse({ parentInfo, athletes });
      if (!validation.success) {
        const errors = validation.error.flatten().fieldErrors;
        const firstError = Object.values(errors).flat()[0];
        toast.error(firstError || "Please check your information.");
        return;
      }
    } else if (currentStep === 2) {
      if (athletes.some(a => a.selectedEvents.length === 0)) {
        toast.error("Please select at least one event for each athlete.");
        return;
      }
    } else if (currentStep === 3) {
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
    if (currentStep < 4) {
      nextStep();
      return;
    }

    const validation = registrationSchema.safeParse({ parentInfo, athletes });
    if (!validation.success) {
      toast.error("Registration data is invalid. Please review your entries.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
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
    <form onSubmit={handleSubmit} className="space-y-12" noValidate data-hydrated={isHydrated}>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {initialTab === 'tryout-prep' && (
            <div className="glass-card border-brand-teal/20 bg-brand-teal/5 p-6 text-center">
              <p className="text-brand-teal font-bold uppercase tracking-widest text-[10px] mb-2">Registration Started</p>
              <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">Tryout Prep Clinics</h3>
              <p className="text-white/40 text-xs mt-2 italic">Fill out your contact info below to select your clinic sessions in the next step.</p>
            </div>
          )}

          <ParentInfoSection parentInfo={parentInfo} setParentInfo={setParentInfo} />

          {athletes.map((athlete, index) => (
            <AthleteInfoSection 
              key={index}
              index={index}
              athlete={athlete}
              athletesCount={athletes.length}
              updateAthlete={updateAthlete}
              removeAthlete={removeAthlete}
              userAthletes={userAthletes}
            />
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
            <EventSelectionSection 
              key={index}
              index={index}
              athlete={athlete}
              initialEvents={initialEvents}
              athleteTabState={athleteTabStates[index]}
              setAthleteTab={setAthleteTab}
              toggleEvent={toggleEvent}
              getSelectedCount={getSelectedCount}
            />
          ))}
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Liability Waivers</h2>
            <p className="text-white/40 text-sm font-medium">Please review and sign for each athlete.</p>
          </div>
          {athletes.map((athlete, index) => (
            <WaiverSection 
              key={index}
              index={index}
              athlete={athlete}
              updateAthlete={updateAthlete}
              isExpanded={expandedWaivers[index]}
              toggleWaiver={toggleWaiver}
            />
          ))}
        </div>
      )}

      {currentStep === 4 && (
        <ReviewSection 
          parentInfo={parentInfo}
          athletes={athletes}
          initialEvents={initialEvents}
          total={total}
        />
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse md:flex-row gap-4 justify-between items-center max-w-4xl mx-auto pt-12 border-t border-white/5">
        {currentStep > 1 ? (
          <button 
            type="button"
            onClick={prevStep}
            className="w-full md:w-auto px-10 py-5 rounded-2xl border border-white/10 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
          >
            Back
          </button>
        ) : <div className="hidden md:block w-32" />}

        <button 
          type="submit"
          disabled={isSubmitting}
          className={`
            w-full md:w-auto px-12 py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs transition-all duration-300
            ${isSubmitting ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-brand-teal text-white hover:scale-105 active:scale-95 shadow-glow-teal'}
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Processing...
            </span>
          ) : (
            currentStep === 4 ? 'Complete Registration' : 'Continue'
          )}
        </button>
      </div>
    </form>
  );
}
