# Group Chat Deployment Guide

This guide covers deploying the group chat feature in production environments, including ngrok tunneling for development sharing.

## Environment Variables

Create a `.env.local` file (or set these in your production environment):

```bash
# Server Configuration
NODE_ENV=production
PORT=8080
HOSTNAME=0.0.0.0

# CORS Configuration (comma-separated list)
# For production, specify exact domains
# ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# For development with ngrok //TODO: SECURITY UPGRADE THIS LATER
# ALLOWED_ORIGINS=http://localhost:3000,https://*.ngrok.io

# Existing variables (keep these)
OPENAI_API_KEY=your_openai_key
A1BASE_API_KEY=your_a1base_key
A1BASE_AGENT_NUMBER=your_agent_number
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Development with ngrok

### 1. Start the server
```bash
npm run dev
```

### 2. Start ngrok tunnel
```bash
ngrok http 3000
```

### 3. Share the URL
Share the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) with others.
They can access group chats at: `https://abc123.ngrok.io/chat/[chatId]`

## Production Deployment

### Option 1: Deploy to Vercel (Recommended)

Since Socket.IO requires a persistent server, you'll need to deploy the Socket.IO server separately:

1. **Deploy Next.js app to Vercel** (without Socket.IO)
2. **Deploy Socket.IO server separately** (e.g., Heroku, Railway, DigitalOcean)

### Option 2: Deploy to a VPS (Full Control)

1. **Install Node.js** (v18+ recommended)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Clone and setup**
```bash
git clone your-repo
cd your-project
npm install
npm run build
```

3. **Use PM2 for process management**
```bash
npm install -g pm2
pm2 start server.js --name "group-chat"
pm2 save
pm2 startup
```

4. **Configure Nginx as reverse proxy**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

5. **Enable SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Option 3: Deploy to Railway/Render

1. **Create a new project** on Railway or Render
2. **Connect your GitHub repository**
3. **Set environment variables** in the dashboard
4. **Deploy** - The platform will automatically detect Node.js and run `npm start`

## Security Considerations

### 1. CORS Configuration
- In production, always specify exact allowed origins
- Never use `*` for CORS in production
- The server now validates origins dynamically

### 2. Rate Limiting
- The server implements rate limiting (30 messages/minute per connection)
- Consider adding Redis for distributed rate limiting at scale

### 3. Input Validation
- Message content is limited to 10,000 characters
- Chat IDs are limited to 100 characters
- All inputs are validated before processing

### 4. SSL/TLS
- Always use HTTPS in production
- Socket.IO will automatically use WSS (WebSocket Secure) over HTTPS

## Monitoring & Debugging

### Enable debug logs
```bash
DEBUG=socket.io:* npm start
```

### Health check endpoint
The server responds to GET requests at the root path, useful for monitoring:
```bash
curl http://localhost:3000
```

### Common Issues

1. **WebSocket connection fails**
   - Check ALLOWED_ORIGINS configuration
   - Ensure your reverse proxy forwards WebSocket headers
   - Check firewall rules for WebSocket traffic

2. **CORS errors**
   - Verify ALLOWED_ORIGINS includes your domain
   - Check browser console for specific origin being blocked

3. **Messages not syncing**
   - Check Supabase connection and credentials
   - Verify database schema is up to date
   - Check server logs for database errors

## Scaling Considerations

For high traffic applications:

1. **Use Redis Adapter for Socket.IO**
```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

2. **Implement sticky sessions** for load balancing
3. **Use a CDN** for static assets
4. **Consider message queue** for AI responses (e.g., BullMQ)

## Performance Optimizations

The server includes several production optimizations:
- Increased ping timeout (60s) and interval (25s)
- Support for both WebSocket and polling transports
- Efficient participant management
- Message content truncation in logs

Remember to test your deployment thoroughly before going live! 