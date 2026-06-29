import React from 'react';

interface MediaReleaseProps {
  athleteName: string;
  agreed: boolean;
  onChange: (agreed: boolean) => void;
}

const MediaRelease: React.FC<MediaReleaseProps> = ({ athleteName, agreed, onChange }) => {
  return (
    <div className="glass-card border-white/5 p-6 space-y-6">
      <div className="space-y-4 text-sm text-white/60 leading-relaxed">
        <div className="border-b border-white/10 pb-4 mb-4">
          <h3 className="text-lg font-heading font-bold text-white uppercase tracking-tight">Media Release & Consent</h3>
          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.2em] mt-1">Optional</p>
        </div>
        
        <p>
          At Tualatin Valley Volleyball Club, we love celebrating our athletes, our teams, and the joy of the game. 
          Photos and videos taken during practices, games, tournaments, and events often capture the spirit of learning, 
          teamwork, and community that define who we are.
        </p>
        <p>
          We’d like to use these images and videos to share the stories and successes of our players through official 
          TVVC channels — including our website, social media accounts, newsletters, and promotional materials.
        </p>
        
        <div className="bg-brand-teal/5 p-4 rounded-xl border border-brand-teal/10">
          <h4 className="text-brand-teal font-bold uppercase text-[10px] tracking-widest mb-2">Our Commitment</h4>
          <p className="text-xs">
            TVVC values the privacy and dignity of every athlete and family. Any images shared will always reflect 
            the positive, respectful environment that our program strives to create — one centered on growth, 
            teamwork, and joy in learning.
          </p>
        </div>

        <div className="space-y-2 text-xs italic opacity-80 border-l-2 border-white/10 pl-4">
          <p>• I give permission for TVVC to take, use, and share photographs and/or videos of my child for promotional or educational purposes.</p>
          <p>• I understand these images may appear on the club’s website, social media, and printed materials.</p>
          <p>• I understand there will be no financial compensation for the use of these images.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={agreed}
          className={`
            flex items-center gap-3 p-4 rounded-xl border transition-all text-left
            ${agreed ? 'bg-brand-teal/10 border-brand-teal shadow-glow-teal/20' : 'bg-white/5 border-white/10 hover:border-white/20'}
          `}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${agreed ? 'border-brand-teal bg-brand-teal' : 'border-white/20'}`} aria-hidden="true">
            {agreed && <span className="text-white text-[10px]">✓</span>}
          </div>
          <div>
            <span className="block font-bold text-white text-sm">Agree</span>
            <span className="block text-[9px] text-white/50 leading-tight">
              Permission granted
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={!agreed}
          className={`
            flex items-center gap-3 p-4 rounded-xl border transition-all text-left
            ${!agreed ? 'bg-brand-coral/10 border-brand-coral shadow-glow-coral/20' : 'bg-white/5 border-white/10 hover:border-white/20'}
          `}
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${!agreed ? 'border-brand-coral bg-brand-coral' : 'border-white/20'}`} aria-hidden="true">
            {!agreed && <span className="text-white text-[10px]">✓</span>}
          </div>
          <div>
            <span className="block font-bold text-white text-sm">Decline</span>
            <span className="block text-[9px] text-white/50 leading-tight">
              No public media
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default MediaRelease;
