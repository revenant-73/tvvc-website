import React from 'react';
import type { ParentInfo, Athlete } from '../../lib/schemas';

interface Event {
  id: string;
  name: string;
  type: string;
  dateInfo: string;
  timeInfo: string;
  price: number;
}

interface ReviewSectionProps {
  parentInfo: ParentInfo;
  athletes: Athlete[];
  initialEvents: Event[];
  total: number;
  waitlistSelections?: string[][];
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  parentInfo,
  athletes,
  initialEvents,
  total,
  waitlistSelections = []
}) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Review Registration</h2>
        <p className="text-white/40 text-sm font-medium">Verify your details before proceeding to payment.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Parent Summary */}
          <section className="glass-card border-white/10 p-8 space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-teal">Contact Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-1">Parent Name</p>
                <p className="text-white font-bold">{parentInfo.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-1">Email Address</p>
                <p className="text-white font-bold">{parentInfo.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-1">Phone Number</p>
                <p className="text-white font-bold">{parentInfo.phone}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-1">Emergency Contact</p>
                <p className="text-brand-coral font-bold">{parentInfo.emergencyPhone}</p>
              </div>
            </div>
          </section>

          {/* Athletes Summary */}
          <div className="space-y-6">
            {athletes.map((athlete, idx) => (
              <section key={idx} className="glass-card border-brand-teal/10 p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">{athlete.firstName} {athlete.lastName}</h3>
                  <span className="text-[10px] font-bold uppercase text-brand-teal tracking-widest bg-brand-teal/10 px-3 py-1 rounded-full">{athlete.grade} Grade</span>
                </div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest">Selected Events</p>
                  <div className="grid grid-cols-1 gap-2">
                    {athlete.selectedEvents.map(eventId => {
                      const event = initialEvents.find(e => e.id === eventId);
                      return event ? (
                        <div key={eventId} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-bold text-white">{event.name}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{event.dateInfo} • {event.timeInfo}</p>
                          </div>
                          <p className="font-bold text-brand-teal">${(event.price / 100).toFixed(0)}</p>
                        </div>
                      ) : null;
                    })}
                    {(waitlistSelections[idx] || []).map(eventId => {
                      const event = initialEvents.find(e => e.id === eventId);
                      return event ? (
                        <div key={`waitlist-${eventId}`} className="flex justify-between items-center p-4 bg-amber-300/10 rounded-xl border border-amber-300/25">
                          <div>
                            <p className="text-sm font-bold text-white">{event.name}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{event.dateInfo} • {event.timeInfo}</p>
                          </div>
                          <p className="font-bold text-amber-300 uppercase tracking-widest text-[10px]">Waitlist</p>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="space-y-6">
          <section className="glass-card border-brand-teal/50 bg-brand-teal/5 p-8 sticky top-32">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-teal mb-8">Order Summary</h3>
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center text-white/60">
                <span className="text-xs uppercase font-bold tracking-widest">Subtotal</span>
                <span className="font-bold font-heading">${(total / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-white/60 border-b border-white/10 pb-4">
                <span className="text-xs uppercase font-bold tracking-widest">Processing Fee</span>
                <span className="font-bold font-heading">$0.00</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm uppercase font-bold tracking-widest text-white">Total Amount</span>
                <span className="text-3xl font-bold font-heading text-brand-teal">${(total / 100).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 mb-8">
              <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest leading-relaxed">
                {total > 0
                  ? 'Clicking "Complete Registration" will redirect you to Stripe for secure payment processing. Waitlist requests are saved without a charge.'
                  : 'Clicking "Join Waitlist" will save your waitlist request. You will not be charged unless TVVC opens a spot and you complete registration.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
