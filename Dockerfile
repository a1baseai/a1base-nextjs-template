# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Set environment variables for build
ARG SUPABASE_URL
ARG SUPABASE_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_KEY=$SUPABASE_KEY

# Add dummy environment variables to prevent build failures
# These will be overridden at runtime with the actual secrets
ENV OPENAI_API_KEY=dummy-build-time-key
ENV ANTHROPIC_API_KEY=dummy-build-time-key 
ENV GROK_API_KEY=dummy-build-time-key
ENV A1BASE_API_KEY=dummy-build-time-key
ENV A1BASE_API_SECRET=dummy-build-time-key
ENV A1BASE_ACCOUNT_ID=dummy-build-time-key
ENV A1BASE_AGENT_NAME=Agent
ENV A1BASE_AGENT_NUMBER=+1234567890
ENV A1BASE_AGENT_EMAIL=agent@example.com

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/data ./data

# Set proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port - using 8080 to match your Railway config
EXPOSE 8080

# Set environment variables that can be overridden at runtime
ENV A1BASE_API_KEY=
ENV A1BASE_API_SECRET=
ENV A1BASE_ACCOUNT_ID=
ENV A1BASE_AGENT_NAME=
ENV A1BASE_AGENT_NUMBER=
ENV A1BASE_AGENT_EMAIL=
ENV OPENAI_API_KEY=
ENV PERPLEXITY_API_KEY=
ENV CRON_SECRET=
ENV SUPABASE_URL=
ENV SUPABASE_KEY=
ENV AGENT_PROFILE_SETTINGS=
ENV AGENT_BASE_INFORMATION=

# Start the application with custom server
CMD ["node", "server.js"] 