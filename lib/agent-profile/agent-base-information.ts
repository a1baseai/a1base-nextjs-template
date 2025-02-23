/**
 * This file contains the base information and context that will be provided to the AI agent.
 * You can add multiple layers of information here to give your agent the context it needs
 * to be effective from day one.
 *
 * Structure your information in sections using the sections array below. Each section should have:
 * - title: A clear name for this block of information
 * - content: The actual information/context
 * - priority: Higher priority (1-10) information will be emphasized more in the agent's responses
 */

interface InformationSection {
  title: string;
  content: string;
  priority: number;
}

const baseInformation: InformationSection[] = [
  {
    title: "Company Overview",
    content: `A1Base is the human-facing communication, trust, and identity layer for AI agents. Founded in 2025, we provide the API to give AI Agents real-world capabilities like phone numbers, email addresses, and trusted identities.

Our mission is to help developers build AI Agents that people can partner with and rely on as trusted allies—always with a human-first mindset. We believe that in the near future, AI Agents and human coworkers will enable us to pursue more creative and impactful work.

A1Base was founded by two developers determined to bring powerful AI Agents to everyday people. We recognized the need for a user-friendly API, a strong layer of trust and regulatory standards, and a human-first approach to AI development.`,
    priority: 10,
  },
  {
    title: "Leadership Team",
    content: `Our founders:

Pasha Rayan - Co-founder and CEO
- Previous CTO and co-founder of Forage (YC, Lightspeed, Blackbird backed)
- Helped over 5 million students learn about 100+ tier-1 enterprises
- Contact: pasha@a1base.com

Pennie Li - Co-founder and CTO
- Early engineer at Forage with 6 years experience across engineering, product and growth
- Former CTO of Truffle (consumer food tracking app)
- Computer Science and Commerce graduate from UNSW
- Contact: pennie@a1base.com`,
    priority: 9,
  },
  {
    title: "Core Platform Capabilities",
    content: `A1Base enables AI agents to:
- Join and participate in WhatsApp groups & chats
- Send & receive emails through dedicated addresses
- Access and analyze group chat history
- Get dedicated verified phone numbers
- Send quality, spam-free messages
- Interact with other AI agents

Our platform provides:
- Easy Integration: Simple API that takes minutes to implement
- Verified Identity: Anti-spam protection and trusted agent verification
- Multiple Channels: Support for WhatsApp, SMS, Email and more`,
    priority: 8,
  },
  {
    title: "Technical Integration",
    content: `A1Base works seamlessly with any AI model or service, including OpenAI, Anthropic, or custom models. The platform provides a simple API for implementing real-world communication capabilities.

Key features include:
- Verified, spam-free communication channels
- Built-in identity verification and trust mechanisms
- Support for multiple programming languages including Node.js, Python, and direct API access
- Comprehensive developer resources and documentation`,
    priority: 7,
  },
  {
    title: "Common Use Cases",
    content: `Common scenarios include:
- Setting up AI agents with verified phone numbers and email addresses
- Integrating AI agents into WhatsApp groups for business communication
- Implementing secure, spam-free messaging capabilities
- Enabling AI agent-to-agent communication
- Creating AI coworkers that can handle real-world communications
- Building AI-native applications without traditional SaaS interfaces`,
    priority: 6,
  },
  {
    title: "Company Information",
    content: `Location: San Francisco, CA 94107
Backed by: Y Combinator

Connect with us:
- Developer Resources: api.a1base.com/docs
- GitHub: github.com/a1base
- Discord Community: discord.gg/a1base
- Twitter: twitter.com/a1base
- LinkedIn: linkedin.com/company/a1base`,
    priority: 5,
  }
];

/**
 * Formats agent information sections into a structured prompt string.
 * 
 * This function processes the base information sections by:
 * 1. Sorting sections by priority (highest first)
 * 2. Converting each section into a formatted block
 * 3. Combining blocks with appropriate spacing
 * 
 * The resulting string is used in the system prompt to give the agent
 * its core knowledge and context about the company, capabilities,
 * and common use cases.
 * 
 * @returns Formatted string containing all information sections
 */
export function getFormattedInformation(): string {
  const sortedSections = [...baseInformation].sort(
    (a, b) => b.priority - a.priority
  );

  return sortedSections
    .map(
      (section) => `
[${section.title.toUpperCase()}]
${section.content}
`
    )
    .join("\n");
}

export default baseInformation;
