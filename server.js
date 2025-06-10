// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { loadProfileSettingsFromFile } = require('./lib/storage/server-file-storage');
const { generateChatSummary } = require('./lib/workflows/chat_workflow');
const { extractEmailFromMessage, sendGroupChatLinkEmail, requestEmailAfterSummary } = require('./lib/workflows/group-chat-email-workflow');

// Temporary stub function until we can properly handle TypeScript files
// Remove this stub - we now have a proper implementation
// async function generateChatSummary(chatId) {
//   console.log(`[SOCKET.IO] Chat summary requested for ${chatId} - using placeholder`);
//   return null; // This will skip the summary message
// }

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0'; // Listen on all interfaces
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active connections and rooms
const rooms = new Map(); // chatId -> Set of participant info
const userSockets = new Map(); // userId -> socket.id
const userEmailRequested = new Map(); // userId -> boolean (tracks if we've asked for email)

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
      // TODO: LATER FOR SECURITY
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    // Production optimizations
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    // Additional settings for Railway/proxy environments
    allowEIO3: true,
    path: '/socket.io/',
    serveClient: false,
    // Enable WebSocket compression
    perMessageDeflate: {
      threshold: 1024
    },
    // Increase upgrade timeout for slow connections
    upgradeTimeout: 30000,
    // Allow request buffering
    allowBuffers: true,
    // Maximum buffer size
    maxHttpBufferSize: 1e6
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

        // Automatically send a welcome message from the AI agent
        if (userId !== 'ai-agent') {
          console.log(`[SOCKET.IO] User ${userName} joined chat ${chatId}. Checking if welcome message needed...`);
          
          // For new chats, send an introductory message
          // For existing chats, try to send a summary
          const isFirstUser = finalParticipantsList.filter(p => p.userId !== 'ai-agent').length === 1;
          
          if (isFirstUser) {
            // This is a new chat - send introductory message
            console.log(`[SOCKET.IO] First user in chat ${chatId}. Sending introduction...`);
            
            // Load agent profile to customize the message
            const profileSettings = await loadProfileSettingsFromFile();
            const agentName = profileSettings?.name || 'Felicie';
            const respondOnlyWhenMentioned = profileSettings?.groupChatPreferences?.respond_only_when_mentioned;
            
            let mentionInstructions = "I'll respond to every message in this chat. You can change this in my settings.";
            if (respondOnlyWhenMentioned) {
              mentionInstructions = `To talk to me, just mention me by name: @${agentName}. You can change this in my settings.`;
            }

            const introMessage = {
              id: `intro-${Date.now()}`,
              content: `Hello ${userName}! 👋 I'm ${agentName}, your A1 Zap.\n\nI'm here to help you with:\n• Answering questions and providing information\n• Creative brainstorming and problem-solving\n• Learning and exploring new topics together\n\n${mentionInstructions}\n\nYou can invite others to join us and coordinate tasks together using the "Share Chat Link" button. ! 🚀\n\nWhat can I help you with today?`,
              role: 'assistant',
              timestamp: new Date().toISOString()
            };

            // Emit the introductory message to all users in the room
            io.to(chatId).emit('new-message', {
              id: introMessage.id,
              content: introMessage.content,
              role: introMessage.role,
              timestamp: introMessage.timestamp,
              senderName: agentName,
              senderId: 'ai-agent'
            });
            
            console.log(`[SOCKET.IO] Sent introduction to ${userName} in chat ${chatId}`);
          } else {
            // Existing chat - try to generate a summary
            console.log(`[SOCKET.IO] User ${userName} joined existing chat. Fetching summary for chat ${chatId}...`);
            
            // Load agent profile for the name
            const profileSettings = await loadProfileSettingsFromFile();
            const agentName = profileSettings?.name || 'Felicie';
            
            generateChatSummary(chatId)
              .then(summary => {
                if (summary) {
                  const welcomeMessage = {
                    id: `summary-${Date.now()}`,
                    content: `Welcome, ${userName}! 👋 Here's a quick summary of what's happened in the chat so far:\n\n${summary}`,
                    role: 'assistant',
                    timestamp: new Date().toISOString()
                  };

                  // Emit the message directly to the user who just joined
                  socket.emit('new-message', {
                    id: welcomeMessage.id,
                    content: welcomeMessage.content,
                    role: welcomeMessage.role,
                    timestamp: welcomeMessage.timestamp,
                    senderName: agentName,
                    senderId: 'ai-agent'
                  });
                  
                  console.log(`[SOCKET.IO] Sent summary to ${userName} in chat ${chatId}`);
                  
                  // Request email after summary if we haven't already
                  if (!userEmailRequested.get(userId)) {
                    userEmailRequested.set(userId, true);
                    requestEmailAfterSummary(io, chatId, userId, userName, agentName);
                  }
                }
              })
              .catch(error => {
                console.error('[SOCKET.IO] Failed to fetch chat summary:', error);
              });
          }
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

        // Check if this is a user message and we've requested their email
        let emailHandled = false;
        if (userId !== 'ai-agent' && userEmailRequested.get(userId)) {
          const extractedEmail = await extractEmailFromMessage(message.content);
          
          if (extractedEmail) {
            console.log(`[SOCKET.IO] User ${userName} provided email: ${extractedEmail}`);
            emailHandled = true;
            
            // Load agent profile for the name
            const profileSettings = await loadProfileSettingsFromFile();
            const agentName = profileSettings?.name || 'Felicie';
            
            // Send acknowledgment message
            const ackMessage = {
              id: `email-ack-${Date.now()}`,
              content: `Great! I'm sending the group chat link to ${extractedEmail} right now... 📧`,
              role: 'assistant',
              timestamp: new Date().toISOString()
            };
            
            io.to(chatId).emit('new-message', {
              id: ackMessage.id,
              content: ackMessage.content,
              role: ackMessage.role,
              timestamp: ackMessage.timestamp,
              senderName: agentName,
              senderId: 'ai-agent'
            });
            
            // Send the email
            const emailSent = await sendGroupChatLinkEmail(extractedEmail, chatId, userName);
            
            // Send confirmation or error message
            const confirmMessage = {
              id: `email-confirm-${Date.now()}`,
              content: emailSent 
                ? `✅ I've sent the group chat link to ${extractedEmail}! Check your inbox for easy access to return to this conversation anytime.`
                : `❌ I had trouble sending the email. Please make sure the email address is correct and try again.`,
              role: 'assistant',
              timestamp: new Date().toISOString()
            };
            
            io.to(chatId).emit('new-message', {
              id: confirmMessage.id,
              content: confirmMessage.content,
              role: confirmMessage.role,
              timestamp: confirmMessage.timestamp,
              senderName: agentName,
              senderId: 'ai-agent'
            });
            
            // Mark that we've handled this user's email
            if (emailSent) {
              userEmailRequested.delete(userId);
              // Don't return early - allow the message to be broadcast normally
              // The AI response will be prevented by the group-ai-response API
            }
          }
        }

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
          userEmailRequested.delete(parsed.userId); // Clean up email request tracking

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