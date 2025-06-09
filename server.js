const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
// const { generateChatSummary } = require('./lib/workflows/chat_workflow');

// Temporary stub function until we can properly handle TypeScript files
async function generateChatSummary(chatId) {
  console.log(`[SOCKET.IO] Chat summary requested for ${chatId} - using placeholder`);
  return null; // This will skip the summary message
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0'; // Listen on all interfaces
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active connections and rooms
const rooms = new Map(); // chatId -> Set of participant info
const userSockets = new Map(); // userId -> socket.id

app.prepare().then(() => {
  console.log('[INFO] Next.js app prepared. Setting up server...');
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO with production-ready configuration
  const io = new Server(server, {
    cors: {
      // WARNING: This allows all origins. For a production environment, it's recommended
      // to implement a whitelist of allowed domains.
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    // Production optimizations
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  });

  // Add error handling for Socket.IO
  io.on('connection_error', (err) => {
    console.error('[SOCKET.IO] Connection error:', err.message);
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('[SOCKET.IO] New connection:', socket.id);

    // Add rate limiting for production
    let messageCount = 0;
    const MESSAGE_RATE_LIMIT = 30; // messages per minute
    const rateLimitReset = setInterval(() => {
      messageCount = 0;
    }, 60000); // Reset every minute

    // Handle user joining a chat room
    socket.on('join-chat', async (data) => {
      try {
        const { chatId, userId, userName } = data;
        
        if (!chatId || !userId || !userName) {
          socket.emit('error', { message: 'Missing required data' });
          return;
        }

        // Validate inputs
        if (typeof chatId !== 'string' || chatId.length > 100) {
          socket.emit('error', { message: 'Invalid chat ID' });
          return;
        }

        console.log(`[SOCKET.IO] User ${userName} (${userId}) joining chat ${chatId}`);

        // Leave any previous rooms
        const previousRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        previousRooms.forEach(room => {
          socket.leave(room);
        });

        // Join the new room
        socket.join(chatId);
        
        // Store user socket mapping
        userSockets.set(userId, socket.id);

        // Get or create room participants
        if (!rooms.has(chatId)) {
          rooms.set(chatId, new Set());
        }
        const participants = rooms.get(chatId);
        
        // Add participant info
        const participantInfo = { userId, userName, socketId: socket.id };
        participants.add(JSON.stringify(participantInfo));

        // Ensure AI agent is always a participant
        const currentParticipants = Array.from(participants).map(p => JSON.parse(p));
        const aiAgentExists = currentParticipants.some(p => p.userId === 'ai-agent');
        if (!aiAgentExists) {
          // The agent's name will be derived from its profile on the client-side
          const aiParticipantInfo = { userId: 'ai-agent', userName: 'AI Assistant', socketId: 'ai-agent' };
          participants.add(JSON.stringify(aiParticipantInfo));
        }

        // Emit updated participants list to all users in the room
        const finalParticipantsList = Array.from(participants).map(p => JSON.parse(p));
        io.to(chatId).emit('participants-update', { participants: finalParticipantsList });

        // Emit join message to other users
        socket.to(chatId).emit('user-joined', {
          userId,
          userName,
          timestamp: new Date().toISOString()
        });

        // Send acknowledgment to the joining user
        socket.emit('joined-chat', {
          chatId,
          participants: finalParticipantsList
        });

        // Automatically send a welcome summary from the AI agent
        if (userId !== 'ai-agent') {
          console.log(`[SOCKET.IO] User ${userName} joined. Fetching summary for chat ${chatId}...`);
          
          generateChatSummary(chatId)
            .then(summary => {
              if (summary) {
                const welcomeMessage = {
                  id: `summary-${Date.now()}`,
                  content: `Welcome, ${userName}! 👋 Here's a quick summary of what's happened so far:\n\n${summary}`,
                  role: 'assistant',
                  timestamp: new Date().toISOString()
                };

                // Emit the message directly to the user who just joined
                socket.emit('new-message', {
                  id: welcomeMessage.id,
                  content: welcomeMessage.content,
                  role: welcomeMessage.role,
                  timestamp: welcomeMessage.timestamp,
                  senderName: 'Felicie',
                  senderId: 'ai-agent'
                });
                
                console.log(`[SOCKET.IO] Sent summary to ${userName} in chat ${chatId}`);
              }
            })
            .catch(error => {
              console.error('[SOCKET.IO] Failed to fetch chat summary:', error);
            });
        }
      } catch (error) {
        console.error('[SOCKET.IO] Error in join-chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        // Rate limiting
        messageCount++;
        if (messageCount > MESSAGE_RATE_LIMIT) {
          socket.emit('error', { message: 'Rate limit exceeded. Please slow down.' });
          return;
        }

        const { chatId, message, userId, userName } = data;
        
        if (!chatId || !message) {
          socket.emit('error', { message: 'Missing message data' });
          return;
        }

        // Validate message content
        if (typeof message.content !== 'string' || message.content.length > 10000) {
          socket.emit('error', { message: 'Invalid message content' });
          return;
        }

        console.log(`[SOCKET.IO] Message from ${userName} in chat ${chatId}: ${message.content.substring(0, 50)}...`);

        // If this is an AI agent message, ensure it's in the participants list
        if (userId === 'ai-agent') {
          if (!rooms.has(chatId)) {
            rooms.set(chatId, new Set());
          }
          const participants = rooms.get(chatId);
          
          // Check if AI agent is already in participants
          const participantsArray = Array.from(participants).map(p => JSON.parse(p));
          const aiAgentExists = participantsArray.some(p => p.userId === 'ai-agent');
          
          if (!aiAgentExists) {
            // Add AI agent to participants
            const aiParticipantInfo = { userId: 'ai-agent', userName, socketId: 'ai-agent' };
            participants.add(JSON.stringify(aiParticipantInfo));
            
            // Emit updated participants list
            const updatedParticipantsList = Array.from(participants).map(p => JSON.parse(p));
            io.to(chatId).emit('participants-update', { participants: updatedParticipantsList });
          }
        }

        // Broadcast message to all users in the room (including sender)
        io.to(chatId).emit('new-message', {
          id: message.id,
          content: message.content,
          role: message.role,
          timestamp: message.timestamp || new Date().toISOString(),
          senderName: userName,
          senderId: userId
        });
      } catch (error) {
        console.error('[SOCKET.IO] Error in send-message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      try {
        const { chatId, userId, userName, isTyping } = data;
        
        // Validate inputs
        if (!chatId || !userId || !userName || typeof isTyping !== 'boolean') {
          return;
        }
        
        // Broadcast typing status to other users in the room
        socket.to(chatId).emit('user-typing', {
          userId,
          userName,
          isTyping
        });
      } catch (error) {
        console.error('[SOCKET.IO] Error in typing:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('[SOCKET.IO] User disconnected:', socket.id);
      
      // Clear rate limit interval
      clearInterval(rateLimitReset);
      
      // Find and remove user from all rooms
      rooms.forEach((participants, chatId) => {
        const participantsArray = Array.from(participants);
        const userParticipant = participantsArray.find(p => {
          const parsed = JSON.parse(p);
          return parsed.socketId === socket.id;
        });

        if (userParticipant) {
          const parsed = JSON.parse(userParticipant);
          participants.delete(userParticipant);
          userSockets.delete(parsed.userId);

          // Notify others in the room
          const remainingParticipants = Array.from(participants).map(p => JSON.parse(p));
          io.to(chatId).emit('participants-update', { participants: remainingParticipants });
          io.to(chatId).emit('user-left', {
            userId: parsed.userId,
            userName: parsed.userName,
            timestamp: new Date().toISOString()
          });

          // Clean up empty rooms
          if (participants.size === 0) {
            rooms.delete(chatId);
          }
        }
      });
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    console.log('> Socket.IO server running');
    console.log('> Environment:', dev ? 'development' : 'production');
  });
}); 