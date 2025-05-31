/**
 * Health Check Endpoint
 * 
 * Simple endpoint for monitoring and cron job testing
 */
import { NextResponse } from "next/server";

export async function GET() {
  const healthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "a1foundermode",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0"
  };

  return NextResponse.json(healthStatus);
}

export async function POST() {
  // Also support POST for cron jobs that might use POST method
  return GET();
} 