import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useThreadRuntime
} from "@assistant-ui/react";
import type { FC, ChangeEvent, KeyboardEvent } from "react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import agentProfileSettings from "@/lib/agent-profile/agent-profile-settings";
import { useEffect, useState } from 'react';
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";

// Historical messages component
const HistoricalMessages: FC<{ threadId?: string }> = ({ threadId }) => {
  const [historicalMessages, setHistoricalMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (threadId) {
      loadHistoricalMessages();
    }
  }, [threadId]);

  const loadHistoricalMessages = async () => {
    if (!threadId) return;
    
    setLoading(true);
    try {
      console.log(`[HISTORICAL-MESSAGES] Loading messages for thread: ${threadId}`);
      const isGroupChat = threadId.includes('-'); // Simple heuristic for group chat IDs
      const response = await fetch(`/api/chat?threadId=${threadId}${isGroupChat ? '&isGroupChat=true' : ''}`);
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages || [];
        console.log(`[HISTORICAL-MESSAGES] Loaded ${messages.length} historical messages`);
        setHistoricalMessages(messages);
      } else {
        console.error('[HISTORICAL-MESSAGES] Failed to load historical messages:', response.statusText);
      }
    } catch (error) {
      console.error('[HISTORICAL-MESSAGES] Error loading historical messages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!threadId || loading) {
    return null;
  }

  if (historicalMessages.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-[var(--thread-max-width)] space-y-4 mb-6">
      {/* Historical messages header */}
      <div className="text-center py-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-400">
          <span>📝</span>
          <span>Previous conversation ({historicalMessages.length} messages)</span>
        </div>
      </div>
      
      {/* Render historical messages */}
      {historicalMessages.map((msg, index) => {
        const isSystemMessage = msg.isSystemMessage;
        const isAssistant = msg.role === 'assistant';
        
        if (isSystemMessage) {
          return (
            <div key={`historical-${index}`} className="text-center py-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-500 dark:text-gray-400">
                <span>{msg.content}</span>
              </div>
            </div>
          );
        }
        
        return (
          <div key={`historical-${index}`} className={`py-4 ${msg.role === 'user' ? 'historical-user-message' : 'historical-assistant-message'}`}>
            {isAssistant ? (
              <div className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)]">
                <Avatar className="col-start-1 row-span-full row-start-1 mr-4">
                  <AvatarFallback>A</AvatarFallback>
                </Avatar>
                <div className="col-span-2 col-start-2">
                  {msg.senderName && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {msg.senderName}
                    </div>
                  )}
                  <div className="text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7 opacity-75">
                    {msg.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)]">
                {msg.senderName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 col-start-2">
                    {msg.senderName}
                  </div>
                )}
                <div className="bg-muted text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2 opacity-75">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Separator */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 rounded-full text-xs text-green-700 dark:text-green-300">
          <span>🔄</span>
          <span>Continue conversation below</span>
        </div>
      </div>
    </div>
  );
};

export const Thread: FC = () => {
  // Get threadId from localStorage to pass to historical messages
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const savedThreadId = localStorage.getItem('webui-thread-id');
    if (savedThreadId) {
      setThreadId(savedThreadId);
    }
  }, []);

  return (
    <ThreadPrimitive.Root
      className="bg-background box-border h-full"
      style={{
        ["--thread-max-width" as string]: "54rem",
      }}
    >
      <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-2 pt-8">
        <ThreadWelcome />
        
        {/* Historical messages */}
        <HistoricalMessages threadId={threadId} />

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            EditComposer: EditComposer,
            AssistantMessage: AssistantMessage,
          }}
        />

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-8 flex-grow" />
        </ThreadPrimitive.If>

        <div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit pb-4">
          <ThreadScrollToBottom />
          <Composer />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-lg text-center">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">💬 Conversation Continuity</p>
              <p>Your conversations are saved and the agent remembers your history. This web UI shows the current session only.</p>
            </div>
          </div>
          
          <p className="mt-4 font-medium">How can I help you today?</p>
          
          <button
            onClick={() => {
              localStorage.removeItem('webui-thread-id');
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            🔄 Start New Conversation
          </button>
        </div>
        <ThreadWelcomeSuggestions />
      </div>
    </ThreadPrimitive.Empty>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  const { startOnboarding, continueOnboarding, isOnboardingInProgress } = useOnboardingFlow();
  const thread = useThreadRuntime();
  
  // Listen for messages in the thread to continue onboarding after user response
  useEffect(() => {
    // We don't have direct access to messages this way, so we'll use an event listener
    // to detect when new messages are added to the thread
    if (!thread || !isOnboardingInProgress) return;
    
    // Create an observer to watch for changes to the thread
    const observer = new MutationObserver((mutations) => {
      // Check if a new message was added
      const userMessageEls = document.querySelectorAll('[data-message-role="user"]');
      if (userMessageEls.length > 0) {
        // Get the last user message element
        const lastUserMessage = userMessageEls[userMessageEls.length - 1];
        // If we found a user message, continue the onboarding flow
        if (lastUserMessage) {
          continueOnboarding();
        }
      }
    });
    
    // Start observing the thread container
    const threadContainer = document.querySelector('[data-thread-messages]');
    if (threadContainer) {
      observer.observe(threadContainer, { childList: true, subtree: true });
    }
    
    // Clean up the observer when the component unmounts
    return () => {
      observer.disconnect();
    };
  }, [isOnboardingInProgress, continueOnboarding, thread]);

  // Handle the onboarding button click directly, without sending a message
  const handleStartOnboarding = (e: React.MouseEvent) => {
    e.preventDefault();
    startOnboarding();
  };

  return (
    <div className="mt-3 flex w-full items-stretch justify-center gap-4">
      <button
        onClick={handleStartOnboarding}
        disabled={isOnboardingInProgress}
        className="hover:bg-muted/80 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in"
      >
        <span className="line-clamp-2 text-ellipsis text-sm font-semibold">
          Start Onboarding
        </span>
      </button>
      <ThreadPrimitive.Suggestion
        className="hover:bg-muted/80 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in"
        prompt="Tell me about your capabilities"
        method="replace"
        autoSend
      >
        <span className="line-clamp-2 text-ellipsis text-sm font-semibold">
          What can you do?
        </span>
      </ThreadPrimitive.Suggestion>
    </div>
  );
};

const Composer: FC = () => {
  // Only trim whitespace when a message is submitted
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Get the textarea element
      const textarea = e.currentTarget;
      // Only trim the input value before sending
      textarea.value = textarea.value.trim();
    }
  };
  
  return (
    <ComposerPrimitive.Root 
      className="focus-within:border-ring/20 flex w-full flex-wrap items-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in"
    >
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder={"Write a message..."}
        className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
        onKeyDown={handleKeyDown}
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
          >
            <SendHorizontalIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in"
          >
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)] py-4">
      <UserActionBar />

      <div className="bg-muted text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2">
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end col-start-1 row-start-2 mr-3 mt-2.5"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  // Only trim input before submitting
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Get the textarea element
      const textarea = e.currentTarget;
      // Trim the input value
      textarea.value = textarea.value.trim();
    }
  };
  
  return (
    <ComposerPrimitive.Root 
      className="bg-muted my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl"
    >
      <ComposerPrimitive.Input 
        className="text-foreground flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" 
        onKeyDown={handleKeyDown}
      />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost">Cancel</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button>Send</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <Avatar className="col-start-1 row-span-full row-start-1 mr-4">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>

      <div className="text-foreground max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7 col-span-2 col-start-2 row-start-1 my-1.5">
        <MessagePrimitive.Content components={{ Text: MarkdownText }} />
      </div>

      <AssistantActionBar />

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="text-muted-foreground flex gap-1 col-start-3 row-start-2 -ml-1 data-[floating]:bg-background data-[floating]:data-[floating]:rounded-md data-[floating]:border data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      {/* <MessagePrimitive.If speaking={false}>
        <ActionBarPrimitive.Speak asChild>
          <TooltipIconButton tooltip="Read aloud">
            <AudioLinesIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Speak>
      </MessagePrimitive.If>
      <MessagePrimitive.If speaking>
        <ActionBarPrimitive.StopSpeaking asChild>
          <TooltipIconButton tooltip="Stop">
            <StopCircleIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.StopSpeaking>
      </MessagePrimitive.If> */}
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "text-muted-foreground inline-flex items-center text-xs",
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};
