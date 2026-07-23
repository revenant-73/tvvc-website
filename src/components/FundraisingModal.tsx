import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FundraisingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FundraisingModal({ isOpen, onClose }: FundraisingModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] cursor-pointer"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card border-brand-teal/30 bg-black/90 w-full max-w-3xl max-h-[90vh] overflow-hidden pointer-events-auto relative shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between bg-brand-teal/5">
                <div>
                  <span className="text-brand-teal font-bold uppercase tracking-widest text-[10px] mb-2 block">Family Resource</span>
                  <h2 className="text-2xl md:text-3xl font-heading font-extrabold text-white uppercase tracking-tight">
                    Fundraising <span className="text-brand-teal italic">Options</span>
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                <section>
                  <p className="text-white/80 leading-relaxed mb-6">
                    TVVC keeps season dues close to the actual cost of running each team. Families can combine a customized payment plan with independent fundraising to create a realistic path forward.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FundraisingOption 
                      title="Ask Your Circle"
                      description="Share your goals with friends and family. A clear personal request often earns more than selling items. (e.g. 12 supporters x $25 = $300)."
                      icon="🤝"
                    />
                    <FundraisingOption 
                      title="Offer Services"
                      description="Yard work, pet care, car washing, or tech help. Set a price or invite people to pay what they can."
                      icon="🛠️"
                    />
                    <FundraisingOption 
                      title="Business Sponsors"
                      description="Ask local businesses to support your athlete. Contact TVVC first for approved marketing packages."
                      icon="🏢"
                    />
                    <FundraisingOption 
                      title="Online Campaigns"
                      description="Use crowdfunding pages to reach extended circles. Be transparent about your goals."
                      icon="💻"
                    />
                  </div>
                </section>

                <section className="bg-brand-coral/5 border border-brand-coral/20 rounded-2xl p-6">
                  <h3 className="text-brand-coral font-bold uppercase tracking-widest text-xs mb-4">A $600 Gap Example</h3>
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between text-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-white font-bold">$250</span>
                      <span className="text-white/40 text-[10px] uppercase">1 Local Sponsor</span>
                    </div>
                    <span className="text-white/20 text-xl">+</span>
                    <div className="flex flex-col items-center">
                      <span className="text-white font-bold">$250</span>
                      <span className="text-white/40 text-[10px] uppercase">5 Service Jobs ($50)</span>
                    </div>
                    <span className="text-white/20 text-xl">+</span>
                    <div className="flex flex-col items-center">
                      <span className="text-white font-bold">$100</span>
                      <span className="text-white/40 text-[10px] uppercase">5 Supporters ($20)</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold uppercase tracking-widest text-xs">Important Boundaries</h3>
                  <ul className="space-y-3">
                    {[
                      "These are family-managed efforts, not official TVVC fundraisers.",
                      "Do not use TVVC logo/branding or promise club benefits without approval.",
                      "Fundraising does not replace payment obligations until funds are received.",
                      "Contact TVVC early to arrange a workable payment plan."
                    ].map((text, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/60">
                        <span className="text-brand-teal shrink-0">•</span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Choose a goal & start today</p>
                <button
                  onClick={onClose}
                  className="btn btn-primary !py-3 !px-8 text-xs"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function FundraisingOption({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-teal/20 transition-all group">
      <span className="text-2xl mb-3 block group-hover:scale-110 transition-transform">{icon}</span>
      <h4 className="text-white font-bold text-sm mb-2">{title}</h4>
      <p className="text-white/50 text-xs leading-relaxed">{description}</p>
    </div>
  );
}
