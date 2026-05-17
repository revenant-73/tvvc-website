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
        <h3 className="text-lg font-heading font-bold text-white uppercase tracking-tight">Media Release & Consent</h3>
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

        <div className="space-y-2 text-xs italic">
          <p>• I give permission for TVVC to take, use, and share photographs and/or videos of my child for promotional or educational purposes.</p>
          <p>• I understand these images may appear on the club’s website, social media, and printed materials.</p>
          <p>• I understand there will be no financial compensation for the use of these images.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
        <label className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${agreed ? 'bg-brand-teal/10 border-brand-teal' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
          <input 
            type="radio" 
            name={`media-release-${athleteName}`}
            checked={agreed === true}
            onChange={() => onChange(true)}
            className="mt-1 accent-brand-teal"
          />
          <div>
            <span className="block font-bold text-white text-sm">I Agree</span>
            <span className="block text-[10px] text-white/40 leading-tight mt-1">
              TVVC may use photos/videos of {athleteName} for public promotional materials.
            </span>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${!agreed ? 'bg-brand-coral/10 border-brand-coral' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
          <input 
            type="radio" 
            name={`media-release-${athleteName}`}
            checked={agreed === false}
            onChange={() => onChange(false)}
            className="mt-1 accent-brand-coral"
          />
          <div>
            <span className="block font-bold text-white text-sm">I Do Not Agree</span>
            <span className="block text-[10px] text-white/40 leading-tight mt-1">
               {athleteName} will still be in team/internal photos, but they will NOT be shared publicly.
            </span>
          </div>
        </label>
      </div>
    </div>
  );
};

export default MediaRelease;
