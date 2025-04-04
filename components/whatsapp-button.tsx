"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhatsAppButtonProps {
  agentNumber: string | undefined;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ agentNumber }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={agentNumber ? `https://wa.me/${agentNumber.replace("+", "")}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => !agentNumber && e.preventDefault()}
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
        </TooltipTrigger>
        {!agentNumber && (
          <TooltipContent className="bg-slate-800 text-white">
            <p>Get the Pro Plan at <a href="https://www.a1base.com" className="underline" target="_blank" rel="noopener noreferrer">a1base.com</a> for WhatsApp integration</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};
