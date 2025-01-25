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
    content: `Add your company overview here. This helps the agent understand the business context.
Example: We are a technology company focused on making AI accessible to businesses...`,
    priority: 10,
  },
  {
    title: "Product Information",
    content: `Add key information about your products/services here.
Example: Our main product is an AI agent platform that...`,
    priority: 8,
  },
  {
    title: "Common Use Cases",
    content: `Add typical scenarios and how they should be handled.
Example: Users often ask about integration capabilities...`,
    priority: 7,
  },
];

/**
 * Formats the information sections into a single string, with higher priority
 * sections appearing first and with more emphasis.
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
