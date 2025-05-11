/**
 * Shared route configuration for Next.js API routes
 * 
 * This ensures consistent configuration across all API routes
 * and prevents Next.js from trying to access environment variables during build time.
 */

export const routeConfig = {
  // Force dynamic mode to ensure API routes are not statically optimized
  dynamic: 'force-dynamic',
  
  // Specify Node.js runtime (not edge runtime)
  runtime: 'nodejs'
};
