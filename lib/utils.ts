import { type ClassValue } from "class-variance-authority"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines and merges Tailwind CSS classes efficiently.
 * 
 * This utility function combines multiple class names using clsx for
 * conditional classes and tailwind-merge to handle Tailwind-specific
 * class conflicts and overrides.
 * 
 * @param inputs - Array of class names, objects, or arrays to combine
 * @returns Merged and deduped class string
 * @example
 * cn('px-2 py-1', condition && 'text-red', ['bg-blue', 'rounded'])
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
