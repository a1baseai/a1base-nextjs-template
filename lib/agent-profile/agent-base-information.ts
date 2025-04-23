/**
 * Agent Base Information
 * 
 * Provides context about the company, product, and team to the AI agent.
 * 
 * Configuration can come from:
 * 1. Server-side file storage (if editing via the profile editor UI)
 * 2. Browser localStorage (as fallback if file storage is unavailable)
 * 3. AGENT_BASE_INFORMATION environment variable
 * 4. Default settings if none of the above are available
 */

import { InformationSection } from './types';
import { loadFromLocalStorage, LOCAL_STORAGE_KEYS } from '../storage/local-storage';
import { loadBaseInformation } from '../storage/file-storage';

// Default information that will be used if no custom information is found
export const defaultBaseInformation: InformationSection[] = [
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
 * Get the current agent base information with fallback chain:
 * 1. Server-side file storage
 * 2. Browser localStorage
 * 3. Environment variable
 * 4. Default information
 */
const getAgentBaseInformation = async (): Promise<InformationSection[]> => {
  // First try to load from file storage via API
  try {
    const fileInfo = await loadBaseInformation();
    if (fileInfo) {
      return fileInfo;
    }
  } catch (error) {
    console.warn('Error loading base information from API:', error);
    // Continue to next method if API fails
  }
  
  // Next try to load from localStorage (browser only)
  if (typeof window !== 'undefined') {
    const localStorageInfo = loadFromLocalStorage<InformationSection[]>(LOCAL_STORAGE_KEYS.AGENT_INFORMATION);
    if (localStorageInfo) {
      return localStorageInfo;
    }
  }
  
  // Next try environment variable
  if (process.env.AGENT_BASE_INFORMATION) {
    try {
      return JSON.parse(process.env.AGENT_BASE_INFORMATION);
    } catch (error) {
      console.warn('Error parsing AGENT_BASE_INFORMATION env variable:', error);
      // Continue to defaults if parsing fails
    }
  }
  
  // Fall back to default information
  return defaultBaseInformation;
};

/**
 * Synchronous version for use in contexts where async is not possible
 * This only checks localStorage and defaults, not file storage
 */
const getAgentBaseInformationSync = (): InformationSection[] => {
  // Try to load from localStorage (browser only)
  if (typeof window !== 'undefined') {
    const localStorageInfo = loadFromLocalStorage<InformationSection[]>(LOCAL_STORAGE_KEYS.AGENT_INFORMATION);
    if (localStorageInfo) {
      return localStorageInfo;
    }
  }
  
  // Next try environment variable
  if (process.env.AGENT_BASE_INFORMATION) {
    try {
      return JSON.parse(process.env.AGENT_BASE_INFORMATION);
    } catch (error) {
      // Continue to defaults if parsing fails
    }
  }
  
  // Fall back to default information
  return defaultBaseInformation;
};

// Export the sync version of information for immediate use
// This might not have the file storage data, but components can fetch that separately if needed
const agentBaseInformation = getAgentBaseInformationSync();
export default agentBaseInformation;

// Also export the async getter for components that can wait for the file data
export { getAgentBaseInformation };

/**
 * Returns all base information as formatted text
 * 
 * @returns Formatted string with all information sections, ordered by priority
 */
export function getFormattedInformation(): string {
  const sortedSections = [...agentBaseInformation].sort(
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
