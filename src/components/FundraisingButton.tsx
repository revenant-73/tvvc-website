import React, { useState } from 'react';
import FundraisingModal from './FundraisingModal';

interface FundraisingButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'coral';
}

export default function FundraisingButton({ className = '', variant = 'primary' }: FundraisingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'btn btn-secondary';
      case 'coral':
        return 'px-8 py-3 rounded-2xl bg-brand-coral/10 border border-brand-coral/30 text-brand-coral font-bold uppercase tracking-widest text-[10px] hover:bg-brand-coral hover:text-white transition-all';
      default:
        return 'btn btn-primary';
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`${getVariantClass()} ${className}`}
      >
        View Fundraising Options
      </button>

      <FundraisingModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
