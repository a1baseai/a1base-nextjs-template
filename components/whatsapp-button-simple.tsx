"use client";

import React, { useState } from "react";

interface WhatsAppButtonProps {
  agentNumber: string | undefined;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ agentNumber }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative inline-block">
      <a
        href={agentNumber ? `https://wa.me/${agentNumber.replace("+", "")}` : "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => !agentNumber && e.preventDefault()}
        onMouseEnter={() => !agentNumber && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`rounded-lg px-6 py-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white flex items-center gap-2 transition-all ${
          agentNumber 
            ? "hover:shadow-lg transform hover:-translate-y-1" 
            : "opacity-70 cursor-not-allowed"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
        </svg>
        Experience the Demo on WhatsApp
      </a>
      
      {showTooltip && !agentNumber && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-md bg-slate-800 text-white w-64">
          <p>Get the Pro Plan at <a href="https://www.a1base.com" className="underline" target="_blank" rel="noopener noreferrer">a1base.com</a> for WhatsApp integration</p>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};
