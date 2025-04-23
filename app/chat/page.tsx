// Start of Selection
"use client";

import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { LeftSidebar } from "@/components/assistant-ui/left-sidebar";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  PhoneIcon,
  MessageSquareIcon,
  Mail,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

import { FC, useState, useEffect } from "react";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { loadProfileSettings } from "@/lib/storage/file-storage";

// A small helper for tooltip usage
const ButtonWithTooltip: FC<{
  tooltip: string;
  children: React.ReactNode;
  className?: string;
}> = ({ tooltip, children, className }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className={className}>
            {children}
            <span className="sr-only">{tooltip}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Left sidebar is imported at the top of the file as a client component

// Mobile-friendly left sidebar sheet
// const LeftBarSheet: FC = () => {
//   return (
//     <Sheet>
//       <SheetTrigger asChild>
//         <Button variant="outline" size="icon" className="shrink-0 md:hidden">
//           <MenuIcon className="size-4" />
//           <span className="sr-only">Toggle navigation menu</span>
//         </Button>
//       </SheetTrigger>
//       <SheetContent side="left" className="p-0">
//         <div className="mt-6 flex flex-col gap-1 h-full">
//           <TopLabel />
//           <LeftSidebar />
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// };

// Optional global header
const Header: FC = () => {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/a1base-black.png"
          alt="A1Base Logo"
          width={80}
          height={10}
          className="py-1"
        />
      </Link>
    </header>
  );
};

// Chat top info area
const ChatTopInfo: FC = () => {
  // State to store the fetched profile settings
  const [profileSettings, setProfileSettings] =
    useState<AgentProfileSettings | null>(null);

  // Fetch the profile settings on component mount
  useEffect(() => {
    async function fetchProfileSettings() {
      try {
        const settings = await loadProfileSettings();

        if (settings) {
          setProfileSettings(settings);
        } else {
          setProfileSettings(defaultAgentProfileSettings);
        }
      } catch (error) {
        console.error("Error loading profile settings:", error);
        setProfileSettings(defaultAgentProfileSettings);
      }
    }

    fetchProfileSettings();
  }, []);

  // Use the loaded settings or defaults if still loading
  const settings = profileSettings || defaultAgentProfileSettings;

  return (
    <div className="m-4 bg-gray-100 p-4 rounded-lg">
      <div className="flex items-center gap-6">
        <Image
          src="/a1base-favicon.png"
          alt="A1Base Logo"
          width={80}
          height={80}
          className="object-cover rounded-lg"
        />
        <div>
          <h1 className="text-xl font-bold">{settings.companyName}</h1>
          <p className="text-sm text-gray-500 mt-1">{settings.botPurpose[0]}</p>
        </div>
      </div>
    </div>
  );
};

// New RightSidebar component with two groups of workflows in a grammatical action style,
// and a grid of 9 small GIF images (3 columns x 3 rows) placed above "🚀 Active Implementations".
const RightSidebar: FC = () => {
  // Define the array of GIF URLs
  const gifUrls = [
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250210_1742_Corporate+Serene+Smile_simple_compose_01jkq9gs6rea3v4n7w461rwye2.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1254_Confident+Startup+Professional_simple_compose_01jm0heqkvez2a2xbpsdh003z8.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1255_Startup+Workplace+Smile_simple_compose_01jm0hgd5afymrz6ewd1c0nbra.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1256_Confident+Startup+Glance_simple_compose_01jm0hj6cfedn8m2gr8ynrwbgs.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1300_Confident+Leader%27s+Smile_simple_compose_01jm0hsnkeftbs5cqkbg77h4sh.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1301_Friendly+Startup+Vibes_simple_compose_01jm0hw1vde4cbcts0rzdtz0h0.gif",
  ];
  // Use the 6 GIFs directly without extending
  const extendedGifUrls = gifUrls;

  // Define two groups: one for immediate tasks and one for suggested projects.
  const workflowGroups = [
    {
      title: "🚀 Active Implementations",
      tasks: [
        {
          action: "Set up WhatsApp integration",
          time: "In progress",
        },
      ],
    },
    {
      title: "💡 Available Services",
      tasks: [
        {
          action: "Configure AI agent phone number",
          time: "Setup guide",
        },
        {
          action: "Enable email capabilities",
          time: "Documentation",
        },
        {
          action: "WhatsApp integration setup",
          time: "Tutorial",
        },
        {
          action: "API key management",
          time: "Security guide",
        },
      ],
    },
  ];

  return (
    <aside className="w-80 shrink-0 bg-gray-100 overflow-auto">
      <div className="flex h-full flex-col">
        <div className="p-4 border-b space-y-4">
          <h2 className="text-lg font-semibold mb-3">✨ Your AI Workforce</h2>
          {/* Grid of 9 small GIF images in 3 columns and 3 rows */}
          <div className="grid grid-cols-3 gap-2">
            {extendedGifUrls.map((url, idx) => (
              <Image
                key={idx}
                src={url}
                alt={`GIF thumbnail ${idx + 1}`}
                width={80}
                height={80}
                className="rounded-sm object-cover"
                unoptimized
              />
            ))}
          </div>
          {workflowGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <ul className="mt-2 space-y-2">
                {group.tasks.map((task, index) => (
                  <li
                    key={index}
                    className="bg-white rounded-lg p-3 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm font-medium">{task.action}</p>
                    <p className="text-xs text-gray-500">{task.time}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Bottom half: Thread List */}
        <div className="flex-1 overflow-auto">
          <ThreadList />
        </div>
      </div>
    </aside>
  );
};

const DayLayout = () => {
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  // State to track environment variable status
  const [envStatus, setEnvStatus] = useState({
    hasOpenAIKey: true, // Default to true to avoid flash of warning
    hasA1BaseKey: true,
    isLoading: true,
  });

  // Check environment variables on component mount
  useEffect(() => {
    async function checkEnvVars() {
      try {
        const response = await fetch("/api/env-check");
        const data = await response.json();
        setEnvStatus({
          hasOpenAIKey: data.hasOpenAIKey,
          hasA1BaseKey: data.hasA1BaseKey,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error checking environment variables:", error);
        setEnvStatus((prev) => ({ ...prev, isLoading: false }));
      }
    }

    checkEnvVars();
  }, []);

  //TODO:
  //  Intercept the chat with our AI Triage Logic
  //  If the choice is to respond, then respond in web chat
  //  Otherwise we need a way to the output here

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <aside className="hidden w-80 shrink-0 bg-gray-100 md:flex md:flex-col">
            <LeftSidebar />
          </aside>
          <main className="flex-1 flex flex-col">
            <ChatTopInfo />
            {/* Show loading message while checking env vars */}
            {envStatus.isLoading && (
              <div className="p-4 text-blue-600">
                Checking environment setup...
              </div>
            )}
            {/* Show warning if keys are missing */}
            {!envStatus.isLoading &&
              (!envStatus.hasOpenAIKey || !envStatus.hasA1BaseKey) && (
                <div className="w-full max-w-4xl p-4 m-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                        Environment Setup Required
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        {!process.env.OPENAI_API_KEY && (
                          <span className="block mb-1">
                            • Please add your{" "}
                            <code className="bg-amber-100 dark:bg-amber-800/40 px-1 py-0.5 rounded">
                              OPENAI_API_KEY
                            </code>{" "}
                            to your .env file.
                          </span>
                        )}
                        {!process.env.A1BASE_API_KEY && (
                          <span className="block mb-1">
                            • Please add your{" "}
                            <code className="bg-amber-100 dark:bg-amber-800/40 px-1 py-0.5 rounded">
                              A1BASE_API_KEY
                            </code>{" "}
                            to your .env file.
                          </span>
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
            <div className="flex-1 overflow-auto p-2">
              <Thread />
            </div>
          </main>
          <RightSidebar />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};

export default DayLayout;
// End of Selectio
