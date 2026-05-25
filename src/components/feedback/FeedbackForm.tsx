import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const teams = [
  "14 White", "14 Black", "14 Coral", "14 Teal",
  "16 Black", "16 Coral", "16 Teal",
  "18 Black", "18 Coral", "18 Teal",
  "Other / Not sure"
];

const ratings = [1, 2, 3, 4, 5];

const steps = [
  { id: 1, title: "Who Are You?", color: "brand-teal" },
  { id: 2, title: "Overall Experience", color: "brand-coral" },
  { id: 3, title: "Coaching & Team", color: "brand-teal" },
  { id: 4, title: "Communication", color: "brand-coral" },
  { id: 5, title: "Cost & Value", color: "brand-teal" },
  { id: 6, title: "Player Growth", color: "brand-coral" },
  { id: 7, title: "Future Direction", color: "brand-teal" },
  { id: 8, title: "Final Thoughts", color: "white" }
];

export default function FeedbackForm() {
  const formRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    user_type: '',
    team: '',
    name: '',
    overall_rating: '',
    best_parts: '',
    frustrating_parts: '',
    keep_doing: '',
    consider_changing: '',
    coaching_positive: '',
    coaching_growth: '',
    practices_useful: '',
    encouraged_problem_solving: '',
    coaching_well: '',
    coaching_improve: '',
    team_environment: '',
    club_communication: '',
    team_communication: '',
    easy_to_understand: '',
    communication_well: '',
    communication_improve: '',
    confusion_moments: '',
    good_value: '',
    time_commitment: '',
    tournament_schedule: '',
    better_value: '',
    unclear_logistics: '',
    volleyball_growth: '',
    personal_growth: '',
    noticeable_growth: '',
    support_needed: '',
    return_likelihood: '',
    return_incentive: '',
    additional_opportunities: [] as string[],
    important_opportunities: '',
    future_hope: '',
    leadership_understanding: '',
    appreciation: '',
    advice: '',
    anything_else: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (opt: string) => {
    setFormData(prev => {
      const current = prev.additional_opportunities;
      if (current.includes(opt)) {
        return { ...prev, additional_opportunities: current.filter(i => i !== opt) };
      } else {
        return { ...prev, additional_opportunities: [...current, opt] };
      }
    });
  };

  const nextStep = () => {
    // Basic validation for required fields in current step
    if (currentStep === 1) {
      if (!formData.user_type || !formData.team || !formData.name) {
        alert("Please answer the required questions before continuing.");
        return;
      }
    }
    if (currentStep === 2 && !formData.overall_rating) {
       alert("Please provide an overall rating.");
       return;
    }
    // Add more validation if needed
    
    setCurrentStep(prev => Math.min(prev + 1, steps.length));
    if (formRef.current) {
      const offset = 100; // Account for fixed header
      const top = formRef.current.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    if (formRef.current) {
      const offset = 100;
      const top = formRef.current.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'additional_opportunities') {
          (value as string[]).forEach(opt => form.append('additional_opportunities', opt));
        } else {
          form.append(key, value as string);
        }
      });

      const response = await fetch('', {
        method: 'POST',
        body: form
      });

      if (response.ok) {
        setIsSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (err) {
      setError("Something went wrong. Please try again or contact us directly.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card border-brand-teal/30 p-12 text-center max-w-2xl mx-auto"
      >
        <div className="w-20 h-20 bg-brand-teal/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-teal"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2 className="text-3xl font-heading font-bold text-white mb-4 uppercase tracking-widest">Thank You!</h2>
        <p className="text-white/60 mb-8 leading-relaxed">
          We are not trying to build a perfect club. Perfect is suspicious and usually wearing matching polos. <br/><br/>
          We are trying to build a club that keeps learning, keeps adapting, and keeps getting better for athletes and families.
        </p>
        <p className="text-brand-teal font-bold uppercase tracking-widest text-xs mb-8">Notice. Adapt. Commit.</p>
        <a href="/" className="btn btn-primary px-8">Back to Home</a>
      </motion.div>
    );
  }

  const progress = (currentStep / steps.length) * 100;

  return (
    <div ref={formRef} className="glass-card border-white/10 p-5 sm:p-8 md:p-12 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/5 rounded-full blur-[100px] -z-10"></div>
      
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-brand-teal font-bold uppercase tracking-widest text-[10px] block mb-1">Step {currentStep} of {steps.length}</span>
            <h3 className="text-white font-heading font-bold uppercase tracking-wider">{steps[currentStep-1].title}</h3>
          </div>
          <span className="text-white/40 text-[10px] font-bold">{Math.round(progress)}% Complete</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-brand-teal shadow-glow-teal"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-brand-coral/10 border border-brand-coral/20 text-brand-coral p-4 sm:p-6 rounded-2xl mb-8 md:mb-12 text-sm font-bold flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">I am filling this out as a…</label>
                    <div className="grid grid-cols-1 gap-2">
                      {["Player", "Parent/Guardian", "Both player and parent together", "Coach", "Other"].map(type => (
                        <label key={type} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${formData.user_type === type ? 'border-brand-teal bg-brand-teal/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                          <input 
                            type="radio" 
                            name="user_type" 
                            value={type} 
                            checked={formData.user_type === type}
                            onChange={handleChange}
                            required 
                            className="accent-brand-teal" 
                          />
                          <span className={`text-sm ${formData.user_type === type ? 'text-white' : 'text-white/70'}`}>{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label htmlFor="team" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Which team were you connected to this season?</label>
                    <div className="relative">
                      <select 
                        id="team" 
                        name="team" 
                        value={formData.team}
                        onChange={handleChange}
                        required 
                        className="w-full bg-brand-charcoal border border-white/10 rounded-xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select your team</option>
                        {teams.map(t => <option key={t} value={t} className="bg-brand-charcoal">{t}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8 border-t border-white/5 pt-8">
                  <div className="space-y-4">
                    <label htmlFor="name" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Your Name</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors" 
                      placeholder="Enter your name"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral">Overall, how would you rate your TVVC experience this season?</label>
                    <div className="flex gap-4 text-[10px] md:text-xs font-bold uppercase text-white/30 tracking-widest">
                      <span>1 = Not Good</span>
                      <span>5 = Excellent</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 md:gap-2">
                    {ratings.map(num => (
                      <label key={num} className="flex-1">
                        <input 
                          type="radio" 
                          name="overall_rating" 
                          value={num} 
                          checked={formData.overall_rating === String(num)}
                          onChange={handleChange}
                          required 
                          className="sr-only peer" 
                        />
                        <div className="text-center py-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-coral peer-checked:border-brand-coral text-white font-bold transition-all hover:scale-[1.02] active:scale-95">
                          {num}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label htmlFor="best_parts" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral">What were the best parts of your TVVC experience this season?</label>
                    <textarea 
                      id="best_parts" 
                      name="best_parts" 
                      value={formData.best_parts}
                      onChange={handleChange}
                      rows={4} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"
                    ></textarea>
                  </div>
                  <div className="space-y-4">
                    <label htmlFor="frustrating_parts" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral">What were the most frustrating or disappointing parts of your TVVC experience this season?</label>
                    <textarea 
                      id="frustrating_parts" 
                      name="frustrating_parts" 
                      value={formData.frustrating_parts}
                      onChange={handleChange}
                      rows={4} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"
                    ></textarea>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label htmlFor="keep_doing" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral">What is one thing TVVC should absolutely keep doing?</label>
                    <textarea 
                      id="keep_doing" 
                      name="keep_doing" 
                      value={formData.keep_doing}
                      onChange={handleChange}
                      rows={4} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"
                    ></textarea>
                  </div>
                  <div className="space-y-4">
                    <label htmlFor="consider_changing" className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral">What is one thing TVVC should seriously consider changing?</label>
                    <textarea 
                      id="consider_changing" 
                      name="consider_changing" 
                      value={formData.consider_changing}
                      onChange={handleChange}
                      rows={4} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  {[
                    { label: "The coaching environment felt positive and supportive.", name: "coaching_positive" },
                    { label: "I feel like I grew as a player under my coaches this season.", name: "coaching_growth" },
                    { label: "Practices were well-organized and useful.", name: "practices_useful" },
                    { label: "Coaches encouraged problem-solving and athlete autonomy.", name: "encouraged_problem_solving" }
                  ].map((q) => (
                    <div key={q.name} className="space-y-4">
                      <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/50">{q.label}</label>
                      <div className="flex gap-1.5 md:gap-2">
                        {ratings.map(num => (
                          <label key={num} className="flex-1">
                            <input 
                              type="radio" 
                              name={q.name} 
                              value={num} 
                              checked={formData[q.name as keyof typeof formData] === String(num)}
                              onChange={handleChange}
                              required 
                              className="sr-only peer" 
                            />
                            <div className="text-center py-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-teal peer-checked:border-brand-teal text-white font-bold transition-all active:scale-95 text-xs">
                              {num}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">What did your coaches do well this season?</label>
                    <textarea name="coaching_well" value={formData.coaching_well} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">What could your coaches have done better?</label>
                    <textarea name="coaching_improve" value={formData.coaching_improve} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">How would you describe your team environment/culture this season?</label>
                  <textarea name="team_environment" value={formData.team_environment} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  {[
                    { label: "Club-wide communication (from Loren/Admin) was clear and timely.", name: "club_communication" },
                    { label: "Team-specific communication (from Coaches/Team Parent) was helpful.", name: "team_communication" },
                    { label: "Club logistics (schedules, locations, events) were easy to understand.", name: "easy_to_understand" }
                  ].map((q) => (
                    <div key={q.name} className="space-y-4">
                      <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/50">{q.label}</label>
                      <div className="flex gap-1.5 md:gap-2">
                        {ratings.map(num => (
                          <label key={num} className="flex-1">
                            <input 
                              type="radio" 
                              name={q.name} 
                              value={num} 
                              checked={formData[q.name as keyof typeof formData] === String(num)}
                              onChange={handleChange}
                              required 
                              className="sr-only peer" 
                            />
                            <div className="text-center py-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-coral peer-checked:border-brand-coral text-white font-bold transition-all active:scale-95 text-xs">
                              {num}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/30">What did we do well in terms of communication this season?</label>
                    <textarea name="communication_well" value={formData.communication_well} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/30">What could we have communicated better or differently?</label>
                    <textarea name="communication_improve" value={formData.communication_improve} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"></textarea>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/30">Were there any specific moments of confusion this season?</label>
                  <textarea name="confusion_moments" value={formData.confusion_moments} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"></textarea>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  {[
                    { label: "The season felt like a good value for the cost.", name: "good_value" },
                    { label: "The time commitment (practices + tournaments) felt appropriate.", name: "time_commitment" },
                    { label: "The tournament schedule was well-balanced and organized.", name: "tournament_schedule" }
                  ].map((q) => (
                    <div key={q.name} className="space-y-4">
                      <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/50">{q.label}</label>
                      <div className="flex gap-1.5 md:gap-2">
                        {ratings.map(num => (
                          <label key={num} className="flex-1">
                            <input 
                              type="radio" 
                              name={q.name} 
                              value={num} 
                              checked={formData[q.name as keyof typeof formData] === String(num)}
                              onChange={handleChange}
                              required 
                              className="sr-only peer" 
                            />
                            <div className="text-center py-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-teal peer-checked:border-brand-teal text-white font-bold transition-all active:scale-95 text-xs">
                              {num}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">What would have made the season feel like a better value?</label>
                    <textarea name="better_value" value={formData.better_value} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">Were there any logistics that felt unclear or frustrating?</label>
                    <textarea name="unclear_logistics" value={formData.unclear_logistics} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  {[
                    { label: "I (or my athlete) grew significantly in volleyball skills this season.", name: "volleyball_growth" },
                    { label: "The season contributed positively to my (or my athlete's) personal growth/confidence.", name: "personal_growth" }
                  ].map((q) => (
                    <div key={q.name} className="space-y-4">
                      <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/50">{q.label}</label>
                      <div className="flex gap-1.5 md:gap-2">
                        {ratings.map(num => (
                          <label key={num} className="flex-1">
                            <input 
                              type="radio" 
                              name={q.name} 
                              value={num} 
                              checked={formData[q.name as keyof typeof formData] === String(num)}
                              onChange={handleChange}
                              required 
                              className="sr-only peer" 
                            />
                            <div className="text-center py-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-coral peer-checked:border-brand-coral text-white font-bold transition-all active:scale-95 text-xs">
                              {num}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/30">What growth did you notice this season?</label>
                    <textarea name="noticeable_growth" value={formData.noticeable_growth} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-coral/30">What areas still need more support?</label>
                    <textarea name="support_needed" value={formData.support_needed} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-coral outline-none transition-colors"></textarea>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 7 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                      <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">How likely are you to return to TVVC next season?</label>
                      <div className="flex gap-4 text-[10px] md:text-xs font-bold uppercase text-white/30 tracking-widest">
                        <span>1 = Unlikely</span>
                        <span>5 = Very likely</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 md:gap-2">
                      {ratings.map(num => (
                        <label key={num} className="flex-1">
                          <input 
                            type="radio" 
                            name="return_likelihood" 
                            value={num} 
                            checked={formData.return_likelihood === String(num)}
                            onChange={handleChange}
                            required 
                            className="sr-only peer" 
                          />
                          <div className="text-center py-4 rounded-xl border border-white/10 bg-white/5 cursor-pointer peer-checked:bg-brand-teal peer-checked:border-brand-teal text-white font-bold transition-all active:scale-95 text-xs">
                            {num}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/50">What would make you more likely to return?</label>
                    <textarea name="return_incentive" value={formData.return_incentive} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                </div>

                <div className="space-y-6 pt-8 border-t border-white/5">
                  <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">What additional opportunities would you like TVVC to consider offering? (Select all that apply)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      "Out-of-state travel tournament opportunities for top teams", "More tournaments overall", 
                      "Beach or grass doubles league/training", "Strength and movement training",
                      "More position-specific clinics", "More small group training opportunities",
                      "More open gyms", "Recruiting education for older athletes/families",
                      "Parent education sessions", "Youth beginner programs", "Other"
                    ].map(opt => (
                      <label key={opt} className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${formData.additional_opportunities.includes(opt) ? 'border-brand-teal bg-brand-teal/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                        <input 
                          type="checkbox" 
                          checked={formData.additional_opportunities.includes(opt)}
                          onChange={() => handleCheckboxChange(opt)}
                          className="accent-brand-teal w-5 h-5" 
                        />
                        <span className={`text-xs font-bold leading-tight ${formData.additional_opportunities.includes(opt) ? 'text-white' : 'text-white/60'}`}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">If you selected any of the above, which ones feel most important to you and why?</label>
                    <textarea name="important_opportunities" value={formData.important_opportunities} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-brand-teal/30">What do you hope TVVC becomes over the next few years?</label>
                    <textarea name="future_hope" value={formData.future_hope} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-brand-teal outline-none transition-colors"></textarea>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 8 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-white/30">What is something you wish TVVC leadership understood better?</label>
                    <textarea name="leadership_understanding" value={formData.leadership_understanding} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-white/50 outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-white/30">What is something you appreciated that maybe didn’t get said enough?</label>
                    <textarea name="appreciation" value={formData.appreciation} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-white/50 outline-none transition-colors"></textarea>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-white/30">If you could give Loren and the TVVC staff one piece of advice, what would it be?</label>
                    <textarea name="advice" value={formData.advice} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-white/50 outline-none transition-colors"></textarea>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-white/30">Anything else you want us to know?</label>
                    <textarea name="anything_else" value={formData.anything_else} onChange={handleChange} rows={4} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-white/50 outline-none transition-colors"></textarea>
                  </div>
                </div>

                <div className="pt-8 text-center space-y-6">
                  <p className="text-white/60 text-sm leading-relaxed max-w-xl mx-auto italic">
                    We are not trying to build a perfect club. Perfect is suspicious and usually wearing matching polos. <br/>
                    We are trying to build a club that keeps learning, keeps adapting, and keeps getting better for athletes and families.
                  </p>
                  <p className="text-brand-teal font-bold uppercase tracking-[0.3em] text-xs">Notice. Adapt. Commit.</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-4 pt-8 border-t border-white/5">
          {currentStep > 1 && (
            <button 
              type="button" 
              onClick={prevStep}
              className="px-8 py-4 rounded-xl border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all"
            >
              Back
            </button>
          )}
          
          {currentStep < steps.length ? (
            <button 
              type="button" 
              onClick={nextStep}
              className="flex-1 btn btn-primary py-4 uppercase tracking-widest font-heading font-extrabold shadow-glow-teal"
            >
              Next Step
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 btn btn-primary py-4 uppercase tracking-widest font-heading font-extrabold shadow-glow-teal disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
