# 🤖 A1Framework

## The AI Framework for Conversational Agents That Work With You

**A1Framework** is a professional, production-ready framework for building AI-powered chat agents using [A1Base](https://a1base.com) and [Next.js](https://nextjs.org). It enables seamless multi-channel communication through WhatsApp, Email, Slack, Teams, and SMS, with a special focus on WhatsApp integration. Powered by OpenAI's GPT-4, A1Framework provides a robust foundation for creating intelligent, responsive, and customizable conversational agents.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-Powered-blue)](https://openai.com)
[![A1Base](https://img.shields.io/badge/A1Base-Integration-green)](https://a1base.com)
[![Discord](https://img.shields.io/badge/Discord-Community-blueviolet)](https://discord.gg/your-community-link)

</div>

---

## 🌟 Why Choose A1Framework?

A1Framework empowers developers with:

- **Effortless Multi-Channel Integration**: Connect with users across WhatsApp, Email, Slack, Teams, and SMS from one platform.
- **Advanced AI Capabilities**: Leverage OpenAI's GPT-4 for smart, context-aware conversations.
- **Persistent Conversations**: Maintain chat history for seamless user experiences.
- **Developer-Friendly Design**: Built with Next.js 14 and TypeScript for modern, scalable development.
- **Secure & Customizable**: Protect sensitive data and tailor your agent to your needs.

Whether you're creating customer support bots, virtual assistants, or interactive tools, A1Framework is your go-to solution.

---

## ✨ Features

### Core Capabilities
- **🧠 Advanced AI Integration**: Powered by OpenAI's GPT-4 for natural, intelligent responses.
- **📱 Multi-Channel Support**: Engage users on WhatsApp, Email, Slack, Teams, and SMS.
- **💾 Persistent Chat History**: Store messages for continuity across sessions.

### Technical Features
- **⚡ Modern Architecture**: Built on Next.js 14 with TypeScript for scalability.
- **🔐 Secure Configuration**: Environment-based setup to safeguard credentials.
- **📦 Quick Deployment**: Easy installation with npm.
- **🛡️ Safety First**: Configurable safety settings and content filtering.
- **🎯 Customizable Workflows**: Flexible message handling and routing.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 18.x or later
- **[A1Base Account](https://dashboard.a1base.com)**: With API credentials
- **[OpenAI API Key](https://platform.openai.com)**: For AI capabilities
- **WhatsApp Business Number**: Configured via A1Base

> **New User?** Sign up for [A1Base](https://dashboard.a1base.com) and [OpenAI](https://platform.openai.com) to get your credentials.

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/a1framework-nextjs-template
   cd a1framework-nextjs-template

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
- **Template Issues**: [GitHub Issues](https://github.com/yourusername/a1framework-nextjs-template/issues)
- **General Inquiries**: [A1Base Support](https://a1base.com/support)

---

<div align="center">
Made with ❤️ by the A1Base Community
</div>
