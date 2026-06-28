import React, { useState } from 'react';

interface Event {
  id: string;
  name: string;
  type: string;
  dateInfo: string;
  timeInfo: string;
  price: number;
  capacity: number;
  spotsFilled: number;
  description?: string;
}

interface TrainingBookingFormProps {
  availableBlocks: Event[];
}

export default function TrainingBookingForm({ availableBlocks }: TrainingBookingFormProps) {
  const [step, setStep] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [parentInfo, setParentInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [athletes, setAthletes] = useState([
    { firstName: '', lastName: '', grade: 'N/A', medicalInfo: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBlocks = availableBlocks.filter(b => selectedBlockIds.includes(b.id));
  // Total is calculated once per block, regardless of athlete count (flat fee)
  const totalAmount = selectedBlocks.reduce((sum, b) => sum + b.price, 0);

  const toggleBlock = (id: string) => {
    setSelectedBlockIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const updateAthleteCount = (count: number) => {
    setAthletes(prev => {
      const next = [...prev];
      if (count > prev.length) {
        for (let i = prev.length; i < count; i++) {
          next.push({ firstName: '', lastName: '', grade: 'N/A', medicalInfo: '' });
        }
      } else {
        next.splice(count);
      }
      return next;
    });
  };

  const updateAthlete = (index: number, field: string, value: string) => {
    const next = [...athletes];
    next[index] = { ...next[index], [field]: value };
    setAthletes(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBlockIds.length === 0 || !parentInfo.email || athletes.some(a => !a.firstName)) return;

    setIsSubmitting(true);
    
    const payload = {
      parentInfo,
      athletes: athletes.map(a => ({
        ...a,
        selectedEvents: selectedBlockIds,
        waiverAgreed: true,
        photoReleaseAgreed: true,
      }))
    };

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Booking failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="flex justify-between mb-12">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step >= s ? 'bg-brand-teal text-black' : 'bg-white/5 text-white/20'}`}>
              {s}
            </div>
            <span className="text-[8px] uppercase tracking-widest font-bold text-white/40">
              {s === 1 ? 'Select Block' : s === 2 ? 'Details' : 'Confirm'}
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Select your <span className="text-brand-teal italic">Training Block</span></h2>
            <p className="text-white/40 text-xs mt-2 uppercase tracking-widest font-bold">Choose an available 90-minute slot</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {availableBlocks.filter(b => b.spotsFilled! < b.capacity!).length === 0 ? (
              <div className="glass-card p-12 text-center border-white/5">
                <p className="text-white/40 text-sm uppercase tracking-widest font-bold">No blocks currently available</p>
              </div>
            ) : (
              <>
                {availableBlocks
                  .filter(b => b.spotsFilled! < b.capacity!)
                  .slice(0, showAll ? undefined : 8)
                  .map(block => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => toggleBlock(block.id)}
                      className={`glass-card !p-4 text-left border transition-all duration-300 flex items-center justify-between ${selectedBlockIds.includes(block.id) ? 'border-brand-teal bg-brand-teal/5' : 'border-white/5 hover:border-white/20'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedBlockIds.includes(block.id) ? 'bg-brand-teal border-brand-teal' : 'border-white/20'}`}>
                          {selectedBlockIds.includes(block.id) && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          )}
                        </div>
                        <div>
                          <h3 className="text-white text-xs font-bold uppercase tracking-wide">{block.dateInfo}</h3>
                          <p className="text-brand-teal text-[10px] font-bold">{block.timeInfo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-heading font-bold text-sm">${(block.price / 100).toFixed(2)}</p>
                        {block.capacity - (block.spotsFilled || 0) <= 5 && (
                          <p className="text-[8px] font-bold text-brand-teal uppercase tracking-widest animate-pulse mt-1">
                            Only {block.capacity - (block.spotsFilled || 0)} left!
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                }
                
                {!showAll && availableBlocks.length > 8 && (
                  <button 
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 hover:text-brand-teal transition-colors border border-dashed border-white/10 rounded-xl mt-2"
                  >
                    + Show {availableBlocks.length - 8} more available blocks
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex justify-center pt-4">
            <button
              disabled={selectedBlockIds.length === 0}
              onClick={() => setStep(2)}
              className="btn btn-primary !px-12 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Player Details
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Booking <span className="text-brand-teal italic">Details</span></h2>
            <p className="text-white/40 text-xs mt-2 uppercase tracking-widest font-bold">Information for contact and athlete safety</p>
          </div>

          <div className="space-y-8">
            <section className="glass-card border-white/10 p-8 space-y-6">
              <h3 className="text-lg font-heading font-bold text-white uppercase tracking-tight border-b border-white/5 pb-4">Contact Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Parent Name</label>
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

            <section className="glass-card border-brand-teal/20 p-8 space-y-8">
              <h3 className="text-lg font-heading font-bold text-white uppercase tracking-tight border-b border-white/5 pb-4">Athlete Info</h3>
              
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">How many athletes are attending?</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => updateAthleteCount(num)}
                      className={`w-10 h-10 rounded-lg font-bold transition-all ${athletes.length === num ? 'bg-brand-teal text-black shadow-glow-teal' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {athletes.map((athlete, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Athlete #{idx + 1} First Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-teal outline-none"
                        value={athlete.firstName}
                        onChange={e => updateAthlete(idx, 'firstName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Athlete #{idx + 1} Last Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-brand-teal outline-none"
                        value={athlete.lastName}
                        onChange={e => updateAthlete(idx, 'lastName', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Group Medical Info / Allergies</label>
                <textarea
                  required
                  placeholder="Important medical notes for any attending athlete, or 'None'"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-brand-teal outline-none min-h-[80px]"
                  value={athletes[0].medicalInfo}
                  onChange={e => {
                    // Update medical info for all athletes in the group for consistency
                    const val = e.target.value;
                    setAthletes(prev => prev.map(a => ({ ...a, medicalInfo: val })));
                  }}
                />
              </div>
            </section>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Back</button>
            <button
              disabled={!parentInfo.email || athletes.some(a => !a.firstName)}
              onClick={() => setStep(3)}
              className="btn btn-primary flex-[2] disabled:opacity-50"
            >
              Continue to Review
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedBlocks.length > 0 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h2 className="text-2xl font-heading font-bold text-white uppercase tracking-tight">Review <span className="text-brand-teal italic">Booking</span></h2>
            <p className="text-white/40 text-xs mt-2 uppercase tracking-widest font-bold">Please confirm your selection and details</p>
          </div>

          <div className="glass-card border-brand-teal/20 p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-white/5 pb-8">
              <div className="space-y-4 flex-1">
                <span className="text-[10px] font-bold text-brand-teal uppercase tracking-widest block">Selected Blocks</span>
                <div className="space-y-2">
                  {selectedBlocks.map(block => (
                    <div key={block.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wide">{block.dateInfo}</h4>
                        <p className="text-brand-teal text-[10px] font-bold">{block.timeInfo}</p>
                      </div>
                      <p className="text-white font-heading font-bold">${(block.price / 100).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-right md:w-48">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Total Cost</span>
                <p className="text-4xl font-heading font-bold text-white">${(totalAmount / 100).toFixed(2)}</p>
                <p className="text-[8px] uppercase tracking-widest text-white/20 mt-1 font-bold">{selectedBlocks.length} Training {selectedBlocks.length === 1 ? 'Block' : 'Blocks'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-4">Contact Information</span>
                <div className="space-y-1 text-sm">
                  <p className="text-white font-bold">{parentInfo.name}</p>
                  <p className="text-white/60">{parentInfo.email}</p>
                  <p className="text-white/60">{parentInfo.phone}</p>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-4">Athlete Information</span>
                <div className="space-y-4 text-sm">
                  {athletes.map((a, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40">{i+1}</div>
                      <p className="text-white font-bold">{a.firstName} {a.lastName}</p>
                    </div>
                  ))}
                  <p className="text-white/60 italic text-xs border-t border-white/5 pt-3">{athletes[0].medicalInfo || 'No medical alerts'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-teal/5 border border-brand-teal/20 p-6 rounded-2xl flex items-start gap-4">
             <div className="w-6 h-6 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal text-xs mt-0.5 font-bold">!</div>
             <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-wider font-medium">
               By clicking "Proceed to Payment", you agree that volleyball training involves physical activity and risk. You authorize TVVC to provide emergency medical care if needed and agree to the standard liability waiver.
             </p>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">Back</button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn btn-primary flex-[2] relative overflow-hidden group"
            >
              {isSubmitting ? 'Processing...' : 'Proceed to Stripe Payment'}
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </button>
          </div>
          
          <p className="text-center text-[10px] text-white/20 uppercase tracking-widest font-bold italic">
            Secure checkout powered by Stripe
          </p>
        </div>
      )}
    </div>
  );
}
