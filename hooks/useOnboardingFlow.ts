import { useState, useEffect, useCallback } from 'react';
import { useThreadRuntime } from '@assistant-ui/react';
import { loadOnboardingFlow } from '@/lib/onboarding-flow/onboarding-storage';
import { OnboardingMessage } from '@/lib/onboarding-flow/types';
import { toast } from 'sonner';

/**
 * Custom hook to handle the onboarding flow in the UI
 * This adds messages one by one to the thread with appropriate delays
 */
export function useOnboardingFlow() {
  const [isOnboardingInProgress, setIsOnboardingInProgress] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<OnboardingMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const thread = useThreadRuntime();

  /**
   * Start the onboarding flow and manage the sequence of messages
   */
  const startOnboarding = async () => {
    if (isOnboardingInProgress) {
      toast.info("Onboarding is already in progress");
      return;
    }

    try {
      setIsOnboardingInProgress(true);
      toast.info("Starting onboarding flow...");

      // Load the onboarding flow from storage
      const onboardingFlow = await loadOnboardingFlow();
      
      if (!onboardingFlow.enabled) {
        toast.error("Onboarding is currently disabled");
        setIsOnboardingInProgress(false);
        return;
      }

      // Sort messages by order
      const sortedMessages = [...onboardingFlow.messages].sort((a, b) => a.order - b.order);
      console.log(`Found ${sortedMessages.length} onboarding messages to display`);
      
      // Initialize state with the sorted messages and start the sequence from the first message
      setCurrentMessages(sortedMessages);
      setCurrentIndex(0);
      
      // The useEffect hook will handle displaying the messages in sequence
    } catch (error) {
      console.error("Error starting onboarding flow:", error);
      toast.error("Failed to start onboarding flow");
      setIsOnboardingInProgress(false);
    }
  };
  
  // Function to add a message to the thread
  const addMessageToThread = useCallback(async (message: OnboardingMessage) => {
    try {
      console.log("Adding message to thread:", message.text.substring(0, 30) + "...");
      
      // Add the assistant message to the thread
      await thread?.append({
        role: 'assistant',
        content: [{ type: 'text', text: message.text }]
      });
      
      return true;
    } catch (error) {
      console.error("Error adding onboarding message to thread:", error);
      toast.error("Failed to display onboarding message");
      return false;
    }
  }, [thread]);
  
  // Process messages in sequence with appropriate delays
  useEffect(() => {
    if (!isOnboardingInProgress || currentMessages.length === 0 || currentIndex >= currentMessages.length) {
      return;
    }
    
    console.log(`Processing message ${currentIndex + 1}/${currentMessages.length}`);
    
    const processCurrentMessage = async () => {
      const currentMessage = currentMessages[currentIndex];
      
      // Add the current message to the thread
      const success = await addMessageToThread(currentMessage);
      
      if (!success) {
        setIsOnboardingInProgress(false);
        return;
      }
      
      // If this message doesn't require a response and there are more messages,
      // schedule the next message after a delay
      if (!currentMessage.waitForResponse && currentIndex < currentMessages.length - 1) {
        setTimeout(() => {
          setCurrentIndex(prevIndex => prevIndex + 1);
        }, 1500); // 1.5 second delay between messages
      } else if (currentMessage.waitForResponse) {
        // If this message requires a response, we'll wait for user input
        console.log("Waiting for user response before continuing onboarding");
      } else if (currentIndex >= currentMessages.length - 1) {
        // This is the last message and it doesn't require a response
        setIsOnboardingInProgress(false);
        console.log("Onboarding flow completed");
      }
    };
    
    // Add a small initial delay for the first message
    const delay = currentIndex === 0 ? 500 : 0;
    const timer = setTimeout(() => {
      processCurrentMessage();
    }, delay);
    
    return () => clearTimeout(timer);
  }, [currentIndex, currentMessages, isOnboardingInProgress, addMessageToThread]);
  
  /**
   * Continue the onboarding flow after a user response
   * Call this function when the user responds to an onboarding message
   */
  const continueOnboarding = () => {
    if (isOnboardingInProgress && currentIndex < currentMessages.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    } else if (currentIndex >= currentMessages.length - 1) {
      setIsOnboardingInProgress(false);
    }
  };
  
  return {
    startOnboarding,
    continueOnboarding,
    isOnboardingInProgress
  };
}
