import React, { useState, useEffect } from 'react';
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
}

interface Athlete {
  firstName: string;
  lastName: string;
  grade: string;
  medicalInfo: string;
  tshirtSize: string;
  selectedEvents: string[];
  photoReleaseAgreed: boolean;
  waiverAgreed: boolean;
}

const tshirtSizes = ['Youth S', 'Youth M', 'Youth L', 'Adult S', 'Adult M', 'Adult L', 'Adult XL'];
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
      tshirtSize: '',
      selectedEvents: [],
      photoReleaseAgreed: false,
      waiverAgreed: false,
    }
  ]);

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
      tshirtSize: '',
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
    const hasIncompleteAthletes = athletes.some(a => 
      !a.firstName || !a.lastName || !a.grade || a.selectedEvents.length === 0 || !a.waiverAgreed
    );

    if (hasIncompleteAthletes) {
      alert("Please complete all athlete details, select at least one event per athlete, and agree to the waivers.");
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Full Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
              value={parentInfo.name}
              onChange={e => setParentInfo({ ...parentInfo, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
              value={parentInfo.email}
              onChange={e => setParentInfo({ ...parentInfo, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone Number</label>
            <input 
              type="tel" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">First Name</label>
              <input 
                type="text" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                value={athlete.firstName}
                onChange={e => updateAthlete(index, 'firstName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Last Name</label>
              <input 
                type="text" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                value={athlete.lastName}
                onChange={e => updateAthlete(index, 'lastName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Grade (Fall '26)</label>
              <select 
                required
                className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                value={athlete.grade}
                onChange={e => updateAthlete(index, 'grade', e.target.value)}
              >
                <option value="">Select Grade</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">T-Shirt Size</label>
              <select 
                required
                className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none"
                value={athlete.tshirtSize}
                onChange={e => updateAthlete(index, 'tshirtSize', e.target.value)}
              >
                <option value="">Select Size</option>
                {tshirtSizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Medical Info / Allergies</label>
            <textarea 
              placeholder="List any critical medical information or allergies. Write 'None' if not applicable."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[100px]"
              value={athlete.medicalInfo}
              onChange={e => updateAthlete(index, 'medicalInfo', e.target.value)}
            />
          </div>

          {/* Event Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Select Camps & Clinics for {athlete.firstName || `Athlete #${index + 1}`}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {initialEvents.map(event => {
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

          {/* Media Release */}
          <MediaRelease 
            athleteName={athlete.firstName || `Athlete #${index + 1}`}
            agreed={athlete.photoReleaseAgreed}
            onChange={(val) => updateAthlete(index, 'photoReleaseAgreed', val)}
          />

          {/* Liability Waiver */}
          <div className="glass-card border-brand-coral/20 p-6 bg-brand-coral/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 text-brand-coral">Waiver of Liability & Release</h3>
            <div className="text-[11px] text-white/50 leading-relaxed mb-6 space-y-4 h-48 overflow-y-auto pr-4 border-b border-white/5 pb-4 custom-scrollbar">
              <p className="font-bold text-white uppercase">TUALATIN VALLEY VOLLEYBALL CLUB, LLC</p>
              <p className="font-bold text-white underline">Assumption of Risk, Waiver, Release of Liability, and Indemnification Agreement</p>
              <p>Please read carefully. This document affects your legal rights.</p>
              
              <p>In consideration of being allowed to participate in any program, event, activity, training, or competition organized, operated, or sponsored by Tualatin Valley Volleyball Club, LLC (“TVVC”), including but not limited to club teams, tryouts, camps, clinics, lessons, open gyms, and strength or conditioning training (collectively referred to as the “Activities”), the undersigned acknowledges and agrees as follows:</p>
              
              <p className="font-bold text-white">Acknowledgment and Assumption of Risk</p>
              <p>I understand that participation in volleyball and related training activities involves inherent risks, including but not limited to: collisions with other participants, floor or equipment surfaces, overexertion, falls, ball impact, dehydration, and other potential causes of injury or illness. I further acknowledge that participation in strength and conditioning training may involve strenuous physical activity that could result in injury, disability, or in rare cases, death.</p>
              <p>I voluntarily assume full responsibility for any and all risks of bodily injury, property damage, or other harm that may result from participation in these Activities, whether caused by the negligence of TVVC, its owner(s), coaches, employees, agents, volunteers, or otherwise.</p>
              
              <p className="font-bold text-white">Release and Waiver of Liability</p>
              <p>I hereby release, waive, discharge, and covenant not to sue Tualatin Valley Volleyball Club, LLC; its owner(s); coaches; employees; volunteers; and any facility owners or operators where Activities are held (collectively, the “Released Parties”) from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury (including death) that may occur while participating in, or traveling to or from, any Activity.</p>
              <p>This release includes, but is not limited to, any claims arising from the negligence of the Released Parties.</p>
              
              <p className="font-bold text-white">Indemnification</p>
              <p>I agree to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost they may incur due to participation by me or my child in any Activity, whether caused by the negligence of the Released Parties or otherwise.</p>
              
              <p className="font-bold text-white">Medical Authorization</p>
              <p>In the event of an injury or medical emergency, I hereby authorize TVVC, its coaches, staff, or representatives to seek and obtain medical treatment deemed necessary for myself or my child. I assume full financial responsibility for any medical services provided as a result of such treatment.</p>
              
              <p className="font-bold text-white">Acknowledgment of Understanding</p>
              <p>I have read this waiver in its entirety, fully understand its terms, and acknowledge that I am signing it freely and voluntarily. I understand that by signing this agreement, I am waiving certain legal rights, including the right to sue. which needs to be included with every registration.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                required
                className="accent-brand-coral w-4 h-4"
                checked={athlete.waiverAgreed}
                onChange={e => updateAthlete(index, 'waiverAgreed', e.target.checked)}
              />
              <span className="text-xs font-bold text-white group-hover:text-brand-coral transition-colors">
                I have read and agree to the TVVC Assumption of Risk & Waiver of Liability
              </span>
            </label>
          </div>
        </section>
      ))}

      <div className="flex flex-col items-center gap-6 pt-12">
        <button 
          type="button"
          onClick={addAthlete}
          className="btn border border-brand-teal/20 hover:border-brand-teal text-brand-teal py-3 px-8 text-xs uppercase tracking-widest font-bold"
        >
          + Add Another Athlete
        </button>

        <div className="w-full max-w-lg glass-card border-brand-teal p-8 text-center space-y-6">
          <div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] block mb-2">Registration Total</span>
            <span className="text-6xl font-heading font-bold text-white">${(total / 100).toFixed(0)}</span>
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting || total === 0}
            className="btn btn-primary w-full py-5 text-lg uppercase tracking-widest font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-teal"
          >
            {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
          </button>
          
          <p className="text-[10px] text-white/30 leading-relaxed">
            By clicking "Proceed to Payment", you will be redirected to Stripe to securely complete your registration.
          </p>
        </div>
      </div>
    </form>
  );
}
