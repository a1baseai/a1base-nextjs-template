"use client";

import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { LeftSidebar } from "@/components/assistant-ui/left-sidebar";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";
import { FC, useState, useEffect } from "react";
import { AgentProfileSettings } from "@/lib/agent-profile/types";
import { defaultAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import { loadProfileSettings } from "@/lib/storage/file-storage";

// Mobile-friendly left sidebar sheet
const LeftBarSheet: FC = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <div className="mt-6 flex flex-col gap-1 h-full">
          <LeftSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Mobile floating actions component
const MobileActions: FC<{
  gifUrls: string[];
  contentWorkflows: { text: string; url: string }[];
}> = ({ gifUrls, contentWorkflows }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden fixed bottom-4 right-4 z-10 ">
      {isOpen && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-[320px] max-h-[60vh] overflow-y-auto p-4 mb-2 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold">✨ Your AI Workforce</h2>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {gifUrls.slice(0, 9).map((url, index) => (
              <div key={index} className="relative">
                <div className="overflow-hidden rounded-lg w-full ">
                  <Image
                    src={url}
                    alt={`GIF ${index + 1}`}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                    unoptimized={true}
                  />
                </div>
              </div>
            ))}
          </div>
          <h2 className="text-lg font-bold mt-4">🚀 Active Implementations</h2>
          <div className="space-y-2 mt-3">
            <h3 className="text-sm font-medium">📝 Generate Content:</h3>
            <div className="grid grid-cols-1 gap-2">
              {contentWorkflows.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>{item.text}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full p-3 h-auto w-auto shadow-md bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
    </div>
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
    <div className="m-2 sm:m-4 bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm">
      <div className="flex items-center gap-3 sm:gap-6">
        <Image
          src="/a1base-favicon.png"
          alt="A1Base Logo"
          width={80}
          height={80}
          className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
          unoptimized
        />
        <div>
          <h1 className="text-lg sm:text-xl font-bold">
            {settings.companyName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300 mt-1">
            {settings.botPurpose[0]}
          </p>
        </div>
      </div>
    </div>
  );
};

// Desktop right sidebar component
const RightSidebar: FC<{
  gifUrls: string[];
  contentWorkflows: { text: string; url: string }[];
}> = ({ gifUrls, contentWorkflows }) => {
  return (
    <div className="hidden w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-100 p-4 lg:p-6 md:block overflow-y-auto">
      <h2 className="text-xl font-bold">✨ Your AI Workforce</h2>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {gifUrls.slice(0, 9).map((url, index) => (
          <div key={index} className="relative">
            <div className="overflow-hidden rounded-lg w-full ">
              <Image
                src={url}
                alt={`GIF ${index + 1}`}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized={true}
              />
            </div>
          </div>
        ))}
      </div>

      
    </div>
  );
};

// Environment status check component
const EnvironmentCheck: FC = () => {
  const [status, setStatus] = useState({
    hasOpenAIKey: true,
    hasA1BaseKey: true,
    isLoading: true,
  });

  useEffect(() => {
    async function checkEnvVars() {
      try {
        const response = await fetch("/api/env-check");
        const data = await response.json();
        setStatus({
          hasOpenAIKey: data.hasOpenAIKey,
          hasA1BaseKey: data.hasA1BaseKey,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error checking environment variables:", error);
        setStatus((prev) => ({ ...prev, isLoading: false }));
      }
    }

    checkEnvVars();
  }, []);

  if (status.isLoading) {
    return (
      <div className="p-4 text-blue-600">Checking environment setup...</div>
    );
  }

  if (!status.hasOpenAIKey || !status.hasA1BaseKey) {
    return (
      <div className="w-full max-w-4xl p-4 m-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
              Environment Setup Required
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {!status.hasOpenAIKey && (
                <span className="block mb-1">
                  • Please add your{" "}
                  <code className="bg-amber-100 dark:bg-amber-800/40 px-1 py-0.5 rounded">
                    OPENAI_API_KEY
                  </code>{" "}
                  to your .env file.
                </span>
              )}
              {!status.hasA1BaseKey && (
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
    );
  }

  return null;
};

// Main Chat Page Component
export default function ChatPage() {
  // Initialize chat runtime
  const runtime = useChatRuntime({
    initialMemory: undefined,
    apiEndpointConfig: {
      baseUrl: "/api",
    },
  });

  // Define content workflows for sidebar and mobile menu
  const contentWorkflows = [
    { text: "Write an email", url: "#" },
    { text: "Create a summary", url: "#" },
    { text: "Draft a proposal", url: "#" },
  ];

  // Define the GIF URLs for profile gallery

  const gifUrls = [
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250215_1417_Confident+Startup+Smile_simple_compose_01jm5v0x50f2kaarp5nd556cbw.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250210_1742_Corporate+Serene+Smile_simple_compose_01jkq9gs6rea3v4n7w461rwye2.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1254_Confident+Startup+Professional_simple_compose_01jm0heqkvez2a2xbpsdh003z8.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1255_Startup+Workplace+Smile_simple_compose_01jm0hgd5afymrz6ewd1c0nbra.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1256_Confident+Startup+Glance_simple_compose_01jm0hj6cfedn8m2gr8ynrwbgs.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1300_Confident+Leader%27s+Smile_simple_compose_01jm0hsnkeftbs5cqkbg77h4sh.gif",
    "https://a1base-public.s3.us-east-1.amazonaws.com/profile-moving/20250213_1301_Friendly+Startup+Vibes_simple_compose_01jm0hw1vde4cbcts0rzdtz0h0.gif",
  ];

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-[calc(100vh-64px)] flex-col">
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop left sidebar */}
          <aside className="hidden w-80 shrink-0 bg-gray-100 dark:bg-gray-900/50 md:flex md:flex-col">
            <LeftSidebar />
          </aside>

          {/* Main content area */}
          <main className="flex-1 flex flex-col relative">
            {/* Mobile top navigation */}
            <div className="flex items-center p-2 md:hidden">
              <LeftBarSheet />
              <div className="flex-1 text-center font-medium">AI Assistant</div>
            </div>

            {/* Chat header with profile info */}
            <ChatTopInfo />

            {/* Environment check */}
            <EnvironmentCheck />

            {/* Chat thread */}
            <div className="flex-1 overflow-auto p-2">
              <Thread />
            </div>

            {/* Mobile floating actions */}
            <MobileActions
              gifUrls={gifUrls}
              contentWorkflows={contentWorkflows}
            />
          </main>

          {/* Desktop right sidebar */}
          <RightSidebar gifUrls={gifUrls} contentWorkflows={contentWorkflows} />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
