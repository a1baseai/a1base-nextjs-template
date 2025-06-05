"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Settings,
  Database,
  Coins,
  Cog,
  LayoutDashboard,
  Users,
  MessageSquare,
  Paintbrush,
  Zap,
  Globe,
  FileCode,
  FolderCog,
  Save,
  CheckCircle2,
  Brain,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SidebarItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  variant: "default" | "ghost";
}

// Custom event for triggering saves across components
export const triggerSave = () => {
  // Create and dispatch a custom event for saving
  const saveEvent = new CustomEvent("save-profile-settings");
  document.dispatchEvent(saveEvent);
};

export default function ProfileEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State to track saving status
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const pathname = usePathname();

  // Handle save action
  const handleSave = useCallback(() => {
    // Set saving status
    setIsSaving(true);

    // Trigger the save event for child components to listen to
    triggerSave();

    // Simulate successful save (in a real app, this would wait for all save promises to resolve)
    setTimeout(() => {
      setIsSaving(false);
      setShowSavedMessage(true);
      toast.success("All changes saved successfully");

      // Hide the success message after a delay
      setTimeout(() => setShowSavedMessage(false), 3000);
    }, 1000);
  }, []);

  // Define sidebar items
  const sidebarItems: SidebarItem[] = [
    {
      title: "Get Started",
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: "/profile-editor/get-started",
      variant: pathname.includes("/get-started") ? "default" : "ghost",
    },
    {
      title: "Profile Settings",
      icon: <Users className="h-5 w-5" />,
      href: "/profile-editor/profile-settings",
      variant: pathname.includes("/profile-settings") ? "default" : "ghost",
    },
    {
      title: "Group Chat Settings",
      icon: <MessageSquare className="h-5 w-5" />,
      href: "/profile-editor/group-chat-settings",
      variant: pathname.includes("/group-chat-settings") ? "default" : "ghost",
    },
    {
      title: "Safety Settings",
      icon: <Shield className="h-5 w-5" />,
      href: "/profile-editor/safety-editor",
      variant: pathname.includes("/safety-editor") ? "default" : "ghost",
    },
    {
      title: "Agent Memory",
      icon: <Brain className="h-5 w-5" />,
      href: "/profile-editor/memory",
      variant: pathname.includes("/memory") ? "default" : "ghost",
    },
    {
      title: "Base Information",
      icon: <Database className="h-5 w-5" />,
      href: "/profile-editor/base-information",
      variant: pathname.includes("/base-information") ? "default" : "ghost",
    },
    {
      title: "Onboarding",
      icon: <MessageSquare className="h-5 w-5" />,
      href: "#", // No direct link as this is now a parent item
      variant: pathname.includes("/onboarding-flow") || pathname.includes("/group-onboarding") ? "default" : "ghost",
    },
    {
      title: "Triage Logic",
      icon: <FileCode className="h-5 w-5" />,
      href: "/profile-editor/triage-logic",
      variant: pathname.includes("/triage-logic") ? "default" : "ghost",
    },
    {
      title: "Workflows",
      icon: <FolderCog className="h-5 w-5" />,
      href: "/profile-editor/workflows",
      variant: pathname.includes("/workflows") ? "default" : "ghost",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link href="/chat" className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold">Back to Chat</span>
          </Link>
        </div>
        <div className="p-4">
          <h2 className="text-xl font-bold mb-6">Agent Settings</h2>
          <nav className="space-y-1">
            {sidebarItems.map((item, index) => {
              // Check if this is the onboarding item to render subitems
              if (item.title === "Onboarding") {
                return (
                  <div key={index} className="space-y-1">
                    {/* Parent Onboarding item */}
                    <div
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        item.variant === "default"
                          ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                          : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    
                    {/* Individual Chat subitem */}
                    <Link
                      href="/profile-editor/onboarding-flow"
                      className={cn(
                        "flex items-center space-x-3 pl-9 py-2 rounded-md text-sm font-medium transition-colors",
                        pathname.includes("/onboarding-flow")
                          ? "bg-blue-50 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <span>Individual Chat</span>
                    </Link>
                    
                    {/* Group Chat subitem */}
                    <Link
                      href="/profile-editor/group-onboarding"
                      className={cn(
                        "flex items-center space-x-3 pl-9 py-2 rounded-md text-sm font-medium transition-colors",
                        pathname.includes("/group-onboarding")
                          ? "bg-blue-50 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <span>Group Chat</span>
                    </Link>
                  </div>
                );
              }
              
              // Render all other normal sidebar items
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    item.variant === "default"
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="absolute bottom-0 p-4 w-64 border-t border-gray-200 dark:border-gray-700">
          <Link href="/chat">
            <Button
              variant="default"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Preview Agent
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">
              {pathname.includes("/get-started") && "Get Started"}
              {pathname.includes("/profile-settings") && "Profile Settings"}
              {pathname.includes("/group-chat-settings") && "Group Chat Settings"}
              {pathname.includes("/memory") && "Agent Memory"}
              {pathname.includes("/base-information") && "Base Information"}
              {pathname.includes("/onboarding-flow") &&
                "Individual Chat Onboarding"}
              {pathname.includes("/group-onboarding") &&
                "Group Chat Onboarding"}
              {pathname.includes("/integrations") && "Integrations"}
              {pathname.includes("/web-behavior") && "Web Behavior"}
              {pathname.includes("/conversation-settings") &&
                "Conversation Settings"}
              {pathname.includes("/advanced-settings") && "Advanced Settings"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {pathname.includes("/get-started") &&
                "Set up your AI agent with a guided flow"}
              {pathname.includes("/profile-settings") &&
                "Configure your agent's identity and appearance"}
              {pathname.includes("/group-chat-settings") && "Manage how your agent behaves in group chats"}
              {pathname.includes("/memory") &&
                "Configure how your agent remembers information from conversations"}
              {pathname.includes("/base-information") &&
                "Provide base knowledge for your agent"}
              {pathname.includes("/onboarding-flow") &&
                "Create welcome messages and onboarding experience for one-on-one conversations with new users."}
              {pathname.includes("/group-onboarding") &&
                "Configure how your agent introduces itself and onboards users in group chat environments."}
              {pathname.includes("/integrations") &&
                "Connect your agent to external services"}
              {pathname.includes("/web-behavior") &&
                "Configure how your agent behaves on the web"}
              {pathname.includes("/conversation-settings") &&
                "Customize the chat experience"}
              {pathname.includes("/advanced-settings") &&
                "Advanced configuration options"}
            </p>
          </div>

          {/* Page content */}
          {children}
        </div>

        {/* Floating action bar - now positioned relative to the main content area */}
        {!pathname.includes("/triage-logic") && !pathname.includes("/workflows") && (
          <div className="fixed bottom-6 right-6 left-[280px] max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-blue-800 dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg shadow-lg z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {showSavedMessage && (
                <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  All changes saved
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  // You can add a discard changes function here
                  toast.info("Changes discarded");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className={isSaving ? "opacity-80" : ""}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
