import React from 'react';
import type { Athlete } from '../../lib/schemas';

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
  waitlistEnabled?: boolean;
}

interface EventSelectionSectionProps {
  index: number;
  athlete: Athlete;
  initialEvents: Event[];
  athleteTabState: string;
  setAthleteTab: (index: number, tab: string) => void;
  toggleEvent: (athleteIndex: number, eventId: string) => void;
  waitlistedEventIds: string[];
  toggleWaitlistEvent: (athleteIndex: number, eventId: string) => void;
  getSelectedCount: (athleteIndex: number, tabId: string) => number;
}

export const EventSelectionSection: React.FC<EventSelectionSectionProps> = ({
  index,
  athlete,
  initialEvents,
  athleteTabState,
  setAthleteTab,
  toggleEvent,
  waitlistedEventIds,
  toggleWaitlistEvent,
  getSelectedCount
}) => {
  const categoryHasEvents = {
    camps: initialEvents.some(e => e.type === 'camp'),
    clinics: initialEvents.some(e => e.type === 'clinic' && !e.id.includes('clinic-tryout-prep')),
    'tryout-prep': initialEvents.some(e => e.type === 'clinic' && e.id.includes('clinic-tryout-prep'))
  };

  const tabs = [
    { id: 'camps', label: 'Summer Camps', count: getSelectedCount(index, 'camps') },
    { id: 'clinics', label: 'Skills Clinics', count: getSelectedCount(index, 'clinics') },
    { id: 'tryout-prep', label: 'Tryout Prep', count: getSelectedCount(index, 'tryout-prep') }
  ].filter(tab => categoryHasEvents[tab.id as keyof typeof categoryHasEvents]);

  const clinicGroups = [
    { title: 'Hitting Clinics', pattern: 'clinic-hitting' },
    { title: 'Serving Clinics', pattern: 'clinic-serving' },
    { title: 'Defense & Receive Clinics', pattern: 'clinic-serve-receive-defense' }
  ];

  const sortByDate = (a: Event, b: Event) => {
    const months = { 'May': 5, 'June': 6, 'July': 7, 'August': 8, 'October': 10, 'November': 11 };
    const getMonthDay = (info: string) => {
      const match = info.match(/(May|June|July|August|October|November)\s+(\d+)/);
      if (!match) return 0;
      return months[match[1] as keyof typeof months] * 100 + parseInt(match[2]);
    };
    return getMonthDay(a.dateInfo) - getMonthDay(b.dateInfo);
  };

  return (
    <section className="glass-card border-brand-teal/20 p-8 space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal font-bold">
          {index + 1}
        </div>
        <h3 className="text-xl font-heading font-bold text-white uppercase tracking-tight">
          Events for {athlete.firstName || `Athlete #${index + 1}`}
        </h3>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAthleteTab(index, tab.id)}
                className={`
                  px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2
                  ${athleteTabState === tab.id ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20' : 'text-white/40 hover:text-white/60'}
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`
                    flex items-center justify-center w-4 h-4 rounded-full text-[8px]
                    ${athleteTabState === tab.id ? 'bg-white text-brand-teal' : 'bg-brand-teal text-white'}
                  `}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="min-h-[300px]">
          {tabs.length === 0 && (
            <div className="glass rounded-xl border border-white/10 p-8 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-white/50">No registrations are open right now.</p>
            </div>
          )}

          {athleteTabState === 'clinics' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {clinicGroups.map(group => {
                const groupEvents = initialEvents
                  .filter(e => e.type === 'clinic' && e.id.includes(group.pattern))
                  .sort(sortByDate);

                if (groupEvents.length === 0) return null;

                return (
                  <div key={group.title} className="space-y-3">
                    <h5 className="text-brand-teal text-[9px] font-bold uppercase tracking-widest px-2">{group.title}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupEvents.map(event => {
                        const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
                        const isSelected = athlete.selectedEvents.includes(event.id);
                        const waitlistAvailable = isFull && Boolean(event.waitlistEnabled);
                        const isWaitlisted = waitlistedEventIds.includes(event.id);
                        
                        return (
                          <label 
                            key={event.id}
                            className={`
                              flex items-center justify-between p-4 rounded-xl border transition-all
                              ${isFull && !waitlistAvailable ? 'opacity-40 grayscale cursor-not-allowed bg-white/5 border-white/5' : 'cursor-pointer'}
                              ${isWaitlisted ? 'bg-amber-300/10 border-amber-300/50 shadow-[0_0_20px_rgba(252,211,77,0.08)]' : ''}
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
                              {waitlistAvailable ? (
                                <button
                                  type="button"
                                  onClick={(clickEvent) => {
                                    clickEvent.preventDefault();
                                    toggleWaitlistEvent(index, event.id);
                                  }}
                                  className={`mt-1 rounded-md border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${isWaitlisted ? 'border-amber-300 bg-amber-300 text-brand-charcoal' : 'border-amber-300/40 text-amber-300 hover:bg-amber-300/10'}`}
                                >
                                  {isWaitlisted ? 'Waitlisted' : 'Join Waitlist'}
                                </button>
                              ) : isFull ? (
                                <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Full</span>
                              ) : (
                                event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0)) <= 5 && (
                                  <span className="block text-[8px] font-bold text-brand-teal uppercase tracking-widest animate-pulse">
                                    Only {event.capacity - ((event.spotsFilled || 0) + (event.pendingSpots || 0))} spots!
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

          {athleteTabState === 'camps' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {initialEvents.filter(e => e.type === 'camp').sort(sortByDate).map(event => {
                    const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
                    const isSelected = athlete.selectedEvents.includes(event.id);
                    const waitlistAvailable = isFull && Boolean(event.waitlistEnabled);
                    const isWaitlisted = waitlistedEventIds.includes(event.id);
                    return (
                      <label 
                        key={event.id}
                        className={`
                          flex items-center justify-between p-4 rounded-xl border transition-all
                          ${isFull && !waitlistAvailable ? 'opacity-40 grayscale cursor-not-allowed bg-white/5 border-white/5' : 'cursor-pointer'}
                          ${isWaitlisted ? 'bg-amber-300/10 border-amber-300/50 shadow-[0_0_20px_rgba(252,211,77,0.08)]' : ''}
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
                          {waitlistAvailable ? (
                            <button
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.preventDefault();
                                toggleWaitlistEvent(index, event.id);
                              }}
                              className={`mt-1 rounded-md border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${isWaitlisted ? 'border-amber-300 bg-amber-300 text-brand-charcoal' : 'border-amber-300/40 text-amber-300 hover:bg-amber-300/10'}`}
                            >
                              {isWaitlisted ? 'Waitlisted' : 'Join Waitlist'}
                            </button>
                          ) : isFull && <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Full</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
             </div>
          )}

          {athleteTabState === 'tryout-prep' && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {initialEvents.filter(e => e.type === 'clinic' && e.id.includes('clinic-tryout-prep')).sort(sortByDate).map(event => {
                    const isFull = (event.spotsFilled || 0) + (event.pendingSpots || 0) >= event.capacity;
                    const isSelected = athlete.selectedEvents.includes(event.id);
                    const waitlistAvailable = isFull && Boolean(event.waitlistEnabled);
                    const isWaitlisted = waitlistedEventIds.includes(event.id);
                    return (
                      <label 
                        key={event.id}
                        className={`
                          flex items-center justify-between p-4 rounded-xl border transition-all
                          ${isFull && !waitlistAvailable ? 'opacity-40 grayscale cursor-not-allowed bg-white/5 border-white/5' : 'cursor-pointer'}
                          ${isWaitlisted ? 'bg-amber-300/10 border-amber-300/50 shadow-[0_0_20px_rgba(252,211,77,0.08)]' : ''}
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
                          {waitlistAvailable ? (
                            <button
                              type="button"
                              onClick={(clickEvent) => {
                                clickEvent.preventDefault();
                                toggleWaitlistEvent(index, event.id);
                              }}
                              className={`mt-1 rounded-md border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${isWaitlisted ? 'border-amber-300 bg-amber-300 text-brand-charcoal' : 'border-amber-300/40 text-amber-300 hover:bg-amber-300/10'}`}
                            >
                              {isWaitlisted ? 'Waitlisted' : 'Join Waitlist'}
                            </button>
                          ) : isFull && <span className="block text-[8px] font-bold text-brand-coral uppercase tracking-widest">Full</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
             </div>
          )}
        </div>
      </div>
    </section>
  );
};
