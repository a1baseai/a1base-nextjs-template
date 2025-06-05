import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Github, Download, MessageSquare, Share2, ChevronRight, AlertTriangle } from "lucide-react";
import { WhatsAppButton } from "@/components/whatsapp-button-simple";

export default function Home() {
  return (
    <>
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-4 pb-16 sm:p-8 md:p-16 lg:p-20 font-[font-family:var(--font-geist-sans)] max-w-full overflow-hidden">
      <main className="flex flex-col gap-6 md:gap-8 row-start-2 items-center sm:items-start w-full max-w-5xl mx-auto">
        <Image
          className="dark:invert w-auto h-auto max-w-[150px] sm:max-w-[180px]"
          src="/a1base-black.png"
          alt="A1Framework logo"
          width={180}
          height={38}
          priority
        />
        <div className="w-full">
          <h1 className="text-2xl md:text-3xl font-bold text-center sm:text-left">
            {`Welcome to A1Framework`}
          </h1>
          <p className="text-base md:text-lg text-center sm:text-left mt-2">
            {`Quickly build a conversational AI Agent that people love to work with.`}
          </p>
        </div>

        {/* Environment Setup Alert */}
        {(!process.env.OPENAI_API_KEY || !process.env.A1BASE_API_KEY) && (
          <div className="w-full max-w-4xl p-3 md:p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">Environment Setup Required</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {!process.env.OPENAI_API_KEY && (
                    <span className="block mb-1">• Please add your <code className="bg-amber-100 dark:bg-amber-800/40 px-1 py-0.5 rounded">OPENAI_API_KEY</code> to your .env file.</span>
                  )}
                  {!process.env.A1BASE_API_KEY && (
                    <span className="block mb-1">• (Optional) A1BASE API keys are required for full functionality.</span>
                  )}
                  {!process.env.A1BASE_AGENT_NUMBER && (
                    <span className="block mb-1">• (Optional) Configure your agent's phone number for WhatsApp integration.</span>
                  )}
                </p>
                <div className="mt-2">
                  <Link 
                    href="/setup-guide" 
                    className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1 hover:underline"
                  >
                    View setup guide
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Container */}
        <div className="relative w-full max-w-4xl">
          {/* Timeline Line */}
          <div className="absolute left-5 md:left-6 top-10 bottom-0 w-0.5 bg-gray-200 hidden sm:block"></div>

          {/* Section 1: Try your AI Assistant */}
          <div className="mb-16 relative">
            <div className="flex flex-col mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                1
              </div>
              <h2 className="text-2xl font-semibold ml-0 sm:ml-16">Try Your AI Assistant</h2>
              <p className="ml-0 sm:ml-16 text-gray-600 dark:text-gray-300">Experience the demo or start building your own AI agent</p>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="flex gap-4 flex-wrap justify-center sm:justify-start">
                <WhatsAppButton agentNumber={process.env.A1BASE_AGENT_NUMBER} />
                <Link
                  href="/chat"
                  className="rounded-lg px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-lg text-white flex items-center gap-2 transition-all transform hover:-translate-y-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {`Try Your AI Assistant Now`}
                </Link>
              </div>
            </div>
          </div>

          {/* Section 2: Quick Start */}
          <div className="mb-16 relative">
            <div className="flex items-center mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                2
              </div>
              <div className="ml-0 sm:ml-16">
                <h2 className="text-2xl font-semibold">Update the name & personality of your AI agent</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Customize your AI agent's identity and behavior
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="p-6 rounded-xl bg-white dark:bg-black/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {`Personalize your AI agent by editing the profile settings:`}
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-2">
                    <li>{`Navigate to lib/agent-profile/agent-profile-settings.ts`}</li>
                    <li>{`Update the agent's name, role, and company information`}</li>
                    <li>{`Customize the bot's purpose and objectives`}</li>
                    <li>{`Adjust language style, tone, and communication preferences`}</li>
                    <li>{`Configure workflow and agent behavior settings`}</li>
                  </ul>

                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Next Steps */}
          <div className="mb-16 relative">
            <div className="flex items-center mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                3
              </div>
              <div className="ml-0 sm:ml-16">
                <h2 className="text-2xl font-semibold">Next Steps</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Customize and deploy your AI agent
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="p-6 rounded-xl bg-white dark:bg-black/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
                <ol className="list-inside list-decimal text-sm space-y-3 font-[font-family:var(--font-geist-mono)]">
                  <li>
                    {`Customize your agent by editing `}
                    <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
                      {`lib/agent/prompts.ts`}
                    </code>
                  </li>
                  <li>
                    {`Configure communication channels in your `}
                    <code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
                      {`.env`}
                    </code>
                    {` file`}
                  </li>
                  <li>{`Set up webhooks using Ngrok for local testing`}</li>
                  <li>{`Deploy to Vercel or your preferred hosting platform`}</li>
                  <li>{`Connect to additional services like databases or APIs`}</li>
                  <li>{`Implement custom features for your specific use case`}</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Section 4: Try A1Mail */}
          <div className="mb-16 relative">
            <div className="flex items-center mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                4
              </div>
              <div className="ml-0 sm:ml-16">
                <h2 className="text-2xl font-semibold">Try A1Mail</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Integrate email capabilities into your AI agent
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
                <div className="flex flex-col items-start">
                  <h3 className="text-xl font-semibold mb-2">Email Integration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Give your AI agent the ability to send and receive emails. A1Mail provides dedicated email addresses and simple APIs for email communication.
                  </p>
                  <div className="bg-white dark:bg-black/30 p-4 rounded-lg w-full mb-4">
                    <pre className="text-xs overflow-x-auto"><code>{`// Create an email address for your agent
await CreateEmailAddress("your-agent", "a1send.com");

// DISABLED: Email functionality
// const { subject, body } = await ConstructEmail(threadMessages);
// await SendEmailFromAgent({
//   subject,
//   body,
//   recipient_address: "recipient@example.com"
// });`}</code></pre>
                  </div>
                  <a
                    href="https://docs.a1base.com/email"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg text-white flex items-center gap-2 transition-all transform hover:-translate-y-1 text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    View A1Mail Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: GitHub Stars */}
          <div className="mb-16 relative">
            <div className="flex items-center mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                5
              </div>
              <div className="ml-0 sm:ml-16">
                <h2 className="text-2xl font-semibold">Support the Project</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Help us grow by starring the repository
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
                <div className="flex flex-col items-center text-center">
                  <Github className="h-12 w-12 mb-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xl font-semibold mb-2">Star us on GitHub</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    If you find A1Framework helpful, please consider giving us a star on GitHub. It helps us reach more developers!
                  </p>
                  <a
                    href="https://github.com/a1baseai/a1framework"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-lg text-white flex items-center gap-2 transition-all transform hover:-translate-y-1"
                  >
                    <Github className="h-5 w-5" />
                    Star on GitHub
                  </a>
                  
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Resources */}
          <div className="relative">
            <div className="flex items-center mb-6">
              <div className="absolute left-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg md:text-xl z-10 hidden sm:flex">
                6
              </div>
              <div className="ml-0 sm:ml-16">
                <h2 className="text-2xl font-semibold">Resources</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Helpful links and documentation
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-16">
              <div className="p-6 rounded-xl bg-white dark:bg-black/20 border border-black/[.08] dark:border-white/[.08] shadow-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <a
                    href="https://docs.a1base.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border border-black/[.08] dark:border-white/[.08] hover:bg-gray-50 dark:hover:bg-black/30 transition-colors flex items-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <span>Documentation</span>
                  </a>
                  <a
                    href="https://github.com/a1baseai/a1framework"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border border-black/[.08] dark:border-white/[.08] hover:bg-gray-50 dark:hover:bg-black/30 transition-colors flex items-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    <span>GitHub Repository</span>
                  </a>
                  <Link
                    href="/settings"
                    className="p-3 rounded-lg border border-black/[.08] dark:border-white/[.08] hover:bg-gray-50 dark:hover:bg-black/30 transition-colors flex items-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-3.5L19 8.5m-14 7L7.5 13m11 3.5L16.5 19m-9-9L5 7.5"></path>
                    </svg>
                    <span>Agent Settings</span>
                  </Link>
                  <a
                    href="https://discord.gg/a1framework"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border border-black/[.08] dark:border-white/[.08] hover:bg-gray-50 dark:hover:bg-black/30 transition-colors flex items-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span>Community Discord</span>
                  </a>
                  <a
                    href="https://www.a1base.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border border-black/[.08] dark:border-white/[.08] hover:bg-gray-50 dark:hover:bg-black/30 transition-colors flex items-center gap-3"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    <span>A1Base Website</span>
                  </a>
                </div>
                
                {/* Additional resources section */}
                <div className="mt-6 bg-slate-50 dark:bg-black/30 p-3 md:p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Additional Resources</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    <a
                      href="/tutorials"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Video Tutorials</span>
                    </a>
                    <a
                      href="/examples"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Example Projects</span>
                    </a>
                    <a
                      href="/blog"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Blog & Updates</span>
                    </a>
                    <a
                      href="/faq"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>FAQ</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </main>

    </div>
    </>
  );
}
