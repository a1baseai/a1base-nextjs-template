# 🤖 A1Base AI Chat Agent Template

A professional, production-ready template for building AI-powered chat agents using [A1Base](https://a1base.com) and [Next.js](https://nextjs.org). This template enables multi-channel communication through WhatsApp, Email, Slack, Teams, and SMS, with a focus on WhatsApp integration.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-Powered-blue)](https://openai.com)
[![A1Base](https://img.shields.io/badge/A1Base-Integration-green)](https://a1base.com)

</div>

## ✨ Features

- **🧠 Advanced AI Integration** - Powered by OpenAI's GPT-4
- **📱 Multi-Channel Support** - WhatsApp, Email, Slack, Teams, and SMS
- **💾 Persistent Chat History** - Complete message tracking and storage
- **⚡ Modern Architecture** - Built on Next.js 14 with TypeScript
- **🔐 Secure Configuration** - Environment-based security setup
- **📦 Quick Deployment** - Simple npm-based installation
- **🛡️ Safety First** - Configurable safety settings and content filtering
- **🎯 Customizable Workflows** - Flexible message handling and routing

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- A1Base account with API credentials
- OpenAI API key
- WhatsApp business number (via A1Base)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/a1base-nextjs-template
   cd a1base-nextjs-template
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your credentials:

   ```env
   A1BASE_API_KEY=your_api_key            # From A1Base Dashboard 
   A1BASE_API_SECRET=your_api_secret      # From A1Base Dashboard 
   A1BASE_ACCOUNT_ID=your_account_id      # From A1Base Dashboard 
   A1BASE_AGENT_NUMBER=your_agent_number  # From A1Base Dashboard 
   A1BASE_AGENT_NAME=your_agent_name      # From A1Base Dashboard 
   A1BASE_AGENT_EMAIL=email@a1send.com    # From A1Base Dashboard
   OPENAI_API_KEY=your_openai_key         # From OpenAI Dashboard
   CRON_SECRET=your_generated_secret      # Generate your own secure random string
   ```

4. **Set up A1Base credentials**
   - Register at [A1Base Dashboard](https://dashboard.a1base.com)
   - Access Settings > API Keys for credentials
   - Locate Account ID in Dashboard overview
   - Configure WhatsApp business number

5. **Launch development server**
   ```bash
   npm run dev
   ```

Your agent will be available at `http://localhost:3000`

## 🔧 Webhook Configuration

### Setting up Message Reception

1. **Expose Local Server**
   ```bash
   ngrok http 3000
   ```

2. **Configure A1Base Webhook**
   - Navigate to Settings > Webhooks in A1Base Dashboard
   - Set Webhook URL: `https://your-ngrok-url/api/whatsapp/incoming`
   - Save configuration

3. **Verify Setup**
   - Send test message to WhatsApp business number
   - Confirm AI response
   - Review console logs for debugging

## 🛠️ Customization

- **Agent Personality**: Modify `lib/agent-profile/agent-profile-settings.json`
- **Safety Settings**: Update `lib/safety-config/safety-settings.json`
- **AI Response Logic**: Customize `lib/services/openai.ts`
- **Message Handling**: Adjust `lib/ai-triage/triage-logic.ts`
- **Workflows**: Enhance `lib/workflows/basic_workflow.ts`
- **Interface**: Modify `app/page.tsx`

### 📬 Message Flow

When a message arrives through the webhook, here's the complete flow through the codebase:

1. **Webhook Entry Point** (`app/api/whatsapp/incoming/route.ts`)
   - Receives incoming webhook POST request
   - Validates and parses webhook payload
   - Extracts message details (sender, content, thread info)
   ```typescript:app/api/whatsapp/incoming/route.ts
   startLine: 33
   endLine: 76
   ```

2. **Message Handler** (`lib/ai-triage/handle-whatsapp-incoming.ts`)
   - Manages message storage and user data
   - Updates conversation history
   - Triggers message triage
   ```typescript:lib/ai-triage/handle-whatsapp-incoming.ts
   startLine: 199
   endLine: 260
   ```

3. **Message Triage** (`lib/ai-triage/triage-logic.ts`)
   - Analyzes message intent using OpenAI
   - Routes to appropriate workflow:
     - Simple responses
     - Identity verification
     - Email handling
     - [Add your own custom triage logic here]
   ```typescript:lib/ai-triage/triage-logic.ts
   startLine: 52
   endLine: 191
   ```

4. **Workflow Execution** (`lib/workflows/basic_workflow.ts`)
   - Handles different types of responses:
     - Default replies
     - Identity verification
     - Email composition and sending
     - [Add your own custom workflows here]
   ```typescript:lib/workflows/basic_workflow.ts
   startLine: 125
   endLine: 203
   ```

5. **OpenAI Integration** (`lib/services/openai.ts`)
   - Generates AI responses
   - Analyzes message intent
   - Creates email drafts
   ```typescript:lib/services/openai.ts
   startLine: 22
   endLine: 53
   ```

Each component can be customized to modify the bot's behavior:
- Adjust webhook handling in the entry point
- Modify message storage and history management
- Update triage logic and workflow routing
- Customize individual workflow implementations
- Fine-tune AI response generation

The system uses environment variables for configuration and can be integrated with Supabase for persistent storage. Safety settings and agent profile configurations can be adjusted through their respective configuration files.

## 🔄 Scheduled Tasks

The template includes a cron job system for automated tasks:
- Configure in `app/api/cron/route.ts`
- Set up scheduled tasks in `lib/cron-job/cron-job.ts`
- Secure with CRON_SECRET environment variable

## 👥 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **A1Base Integration**: [Documentation](https://docs.a1base.com)
- **Template Issues**: [GitHub Issues](https://github.com/yourusername/a1base-nextjs-template/issues)
- **General Inquiries**: [A1Base Support](https://a1base.com/support)

---

<div align="center">
Made with ❤️ by the A1Base Community
</div>
