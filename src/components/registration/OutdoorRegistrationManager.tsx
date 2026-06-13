import React, { useState } from 'react';
import TournamentRegistrationForm from './TournamentRegistrationForm';
import FamilyChallengeRegistrationForm from './FamilyChallengeRegistrationForm';

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

export default function OutdoorRegistrationManager({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (selectedEventId && selectedEvent) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-between items-center mb-12">
            <button 
                onClick={() => setSelectedEventId(null)}
                className="text-white/40 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back to Events
            </button>
            <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-teal block mb-1">Registering For</span>
                <span className="text-white font-heading font-bold uppercase text-lg">{selectedEvent.name}</span>
            </div>
        </div>

        {selectedEvent.type === 'family-challenge' ? (
            <FamilyChallengeRegistrationForm event={selectedEvent} />
        ) : (
            <TournamentRegistrationForm event={selectedEvent} />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {events.map((event, i) => {
        const isFull = event.spotsFilled >= event.capacity;
        const imagePath = event.id === 'tournament-grass-series-1' 
            ? '/assets/images/summer-series-1.png'
            : event.id === 'tournament-grass-series-2'
            ? '/assets/images/summer-series -2.png'
            : '/assets/images/family-challenge.png';
        
        return (
          <div key={event.id} className="glass-card h-full flex flex-col justify-between border-white/5 hover:border-brand-teal/30 group relative overflow-hidden transition-all duration-500 !p-0">
            <div className="relative h-48 overflow-hidden">
                <img 
                    src={imagePath} 
                    alt={event.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal to-transparent"></div>
                <div className="absolute top-4 left-4 flex gap-2">
                    <span className="bg-brand-teal text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{event.dateInfo}</span>
                    <span className="bg-white/90 text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider text-shadow-none">Doubles (2v2)</span>
                </div>
            </div>

            <div className="p-8 flex-1 flex flex-col">
              <div className="flex-1">
                <h3 className="text-2xl font-heading font-bold mb-2 text-white">{event.name}</h3>
                <p className="text-[10px] text-brand-teal font-bold uppercase mb-4 tracking-widest">
                  {event.type === 'family-challenge' ? 'Youth (18 & under) + Adult (30 & over)' : 'Middle School & High School (2v2)'}
                </p>
                <p className="text-sm text-white/50 leading-relaxed mb-8">
                  {event.type === 'family-challenge' 
                    ? 'Includes Competitive and Fun Family divisions. Focused on connection, community, and family fun on the grass.'
                    : 'Featuring A (Competitive) and B (Developmental) divisions. Pool play into brackets ensures plenty of matches for all skill levels.'}
                </p>
              </div>
              
              <div className="mt-auto pt-6 border-t border-white/5">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    <span>Cost</span>
                    <span>Capacity</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-white mb-6">
                    <span>${(event.price * 2 / 100)} per team</span>
                    <span className="text-brand-teal">
                        {isFull ? (
                          "Sold Out"
                        ) : (
                          event.capacity - (event.spotsFilled || 0) <= 5 ? (
                            <span className="animate-pulse text-brand-teal">Only {event.capacity - (event.spotsFilled || 0)} left!</span>
                          ) : (
                            `Max ${event.capacity} Teams`
                          )
                        )}
                    </span>
                 </div>
                 
                 {isFull ? (
                   <button disabled className="btn btn-secondary w-full !py-2.5 !text-[10px] opacity-50 cursor-not-allowed uppercase tracking-widest font-bold">
                      Sold Out
                   </button>
                 ) : (
                   <button 
                     onClick={() => setSelectedEventId(event.id)}
                     className="btn btn-primary w-full !py-2.5 !text-[10px] uppercase tracking-widest font-bold"
                   >
                      Register Team
                   </button>
                 )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
