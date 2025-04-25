// This file contains configuration for all API routes to prevent prerendering during build

// Forces Next.js to treat the route as dynamic and only render it at request time 
// instead of during build, which prevents environment variable issues
export const dynamic = 'force-dynamic';

// Ensures the route runs on Node.js runtime instead of Edge runtime
export const runtime = 'nodejs';

// Sets a reasonable timeout limit for API routes
export const maxDuration = 30;
