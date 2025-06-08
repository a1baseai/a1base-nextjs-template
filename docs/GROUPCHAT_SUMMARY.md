Spec: Multi-User, Shareable Web UI Chat

1. Project Goals

The primary objective is to transform the web UI chat from a single-user, session-based demo into a persistent, multi-user, and shareable application. Users will start conversations that are saved to the database, and they can invite others to join via a shareable link. Each new browser session will be treated as a unique anonymous user, ensuring privacy and simplicity.

2. Core Concepts & Data Model

We will leverage your existing Supabase schema. The core architectural shift is from an ephemeral, in-memory store to a persistent database model for all web UI chats.

A. User Identification (Session-Based Anonymous Users):

Concept: We will create a persistent identity for each user within their browser. This requires no login. A user opening the site in a new browser or an incognito window will be treated as a new user, fulfilling the "new session" requirement.

Mechanism:

When a user first visits the chat page, the client-side code will check localStorage for a web_user_id.

If web_user_id does not exist, it will call a new API endpoint to create a new user in the conversation_users table.

The API will return the new user's id. This ID will be stored in localStorage as web_user_id for all future visits from that browser.

Database Impact:

We will use the conversation_users table.

For web users, service will be 'web-ui' and phone_number will be null.

The user name can be a fun, randomly generated name. The user has an option to change their randomly generated name

B. Chat, Message, and Participant Persistence:

chats table: Each new conversation will create a row in this table. The id of this row is the chatId. The type can be 'group', and service will be 'web-ui'.

messages table: Every message sent will be saved here, linked via chat_id and the sender's sender_id (which is their id from the conversation_users table).

chat_participants table: This is the key to multi-user functionality. It's a join table that links chat_id and user_id. This table tells us which users have joined which chat.

3. URL Structure

We will adopt a clean, RESTful URL structure that is inherently shareable.

/chat: The main page, displaying a list of all chats the current user has joined.

/chat/new: A simple route that creates a new chat and redirects the user to /chat/[chatId].

/chat/[chatId]: The view for a specific conversation. This is the shareable link.

4. Component & UI Breakdown

A. ChatLayout (New or Modified app/chat/layout.tsx):

Responsibility:

Manages the current user's identity (fetches or creates the web_user_id and stores it in a React Context).

Fetches the list of chats for the current user from the backend.

Renders the ChatSidebar.

Contains:

ChatSidebar component.

The main content area to render the selected chat page (/chat/[chatId]/page.tsx).

B. ChatSidebar (New Component):

Responsibility:

Receives the list of chats from ChatLayout.

Displays each chat as a clickable item. The item should show the chat name (e.g., "Chat with 3 people") and perhaps a last message snippet.

Provides a "New Chat" button that navigates to /chat/new.

Highlights the currently active chat based on the URL.

C. ChatView (app/chat/[chatId]/page.tsx):

Responsibility:

Fetches and displays all messages for the chatId from the URL.

Renders messages, differentiating between the current user and other users (e.g., align messages left/right, show user's generated name).

Contains the message input form. When a message is sent, it calls the API with the chatId and the user's web_user_id.

Includes a "Share" or "Invite" button which copies the current URL (/chat/[chatId]) to the clipboard.

5. API Endpoint Design

We will remove the old logic from app/api/chat/route.ts and create a new set of API routes to support this persistent model.

A. User Management

POST /api/web/users

Purpose: Creates a new anonymous user for the web UI. Called once per new browser session.

Action: Creates a row in conversation_users with service: 'web-ui' and a generated name.

Returns: { success: true, user: { id: "...", name: "..." } }.

B. Chat Management

GET /api/web/chats

Purpose: Fetches all chats the current user participates in (for the sidebar).

Auth: Reads the web_user_id from a custom request header (e.g., x-user-id).

Action: Queries chat_participants for user_id, then joins with chats.

Returns: { success: true, chats: [...] }.

POST /api/web/chats

Purpose: Creates a new chat thread.

Auth: Reads x-user-id from header.

Action:

Creates a new row in the chats table.

Adds the creating user to the chat_participants table.

Returns: { success: true, chat: { id: "...", name: "..." } }.

GET /api/web/chats/[chatId]

Purpose: Fetches all messages for a specific chat.

Auth: x-user-id in header.

Action:

Verify the user is a participant in chatId. If not, return an error (they must join first).

Fetch all messages from messages where chat_id matches.

Returns: { success: true, messages: [...] }.

POST /api/web/chats/[chatId]/messages

Purpose: Adds a new message to a chat.

Auth: x-user-id in header.

Body: { content: "Hello world!" }.

Action:

Verify the user is a participant.

Create a new row in messages with chat_id and sender_id.

Pass the message content to the existing AI triage logic for response generation.

Save the AI's response to the messages table as well.

Returns: { success: true, message: { ... } } (the newly created user message).

POST /api/web/chats/[chatId]/join

Purpose: Adds the current user to a chat they've navigated to via a shared link.

Auth: x-user-id in header.

Action: Adds a row to chat_participants linking the user_id and chatId. Does nothing if the user is already a participant.

Returns: { success: true }.

6. Step-by-Step Implementation Plan

Phase 1: Backend (Data Layer & API)

Update Supabase Adapter (lib/supabase/adapter.ts):

Add new functions: createWebUser(), getChatsForUser(userId), createChat(creatorId), getChatMessages(chatId, userId), addMessageToChat(chatId, senderId, content), addUserToChat(chatId, userId).

Create API Routes:

Create the new API endpoints under app/api/web/... as defined above. These routes will use the new Supabase adapter functions.

Crucially, modify the existing triageMessage and handleWhatsAppIncoming logic to completely remove the in-memory handling for service: 'web-ui'. All web UI chat data must now flow through the new, persistent API routes.

Phase 2: Frontend (UI & State Management)

Create UserProvider Context:

This React Context will wrap the main chat layout.

On load, it checks localStorage for web_user_id. If it's missing, it calls POST /api/web/users and stores the new ID.

It provides the userId to all child components.

Refactor Chat Page Structure:

Move app/chat/page.tsx's content to app/chat/[chatId]/page.tsx.

Create a new app/chat/page.tsx that serves as a landing page (e.g., "Select a chat or start a new one").

Create app/chat/layout.tsx to host the UserProvider and render the ChatSidebar.

Build UI Components:

ChatSidebar: Fetches data from GET /api/web/chats and renders the list of chats. Its "New Chat" button should hit POST /api/web/chats and then use the router to navigate to the new chat's URL.

ChatView (/chat/[chatId]/page.tsx):

On mount, it should call POST /api/web/chats/[chatId]/join to ensure the user is a participant.

It then fetches messages from GET /api/web/chats/[chatId].

The message input form will POST to /api/web/chats/[chatId]/messages.