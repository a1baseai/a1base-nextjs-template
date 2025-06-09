"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  Brain, 
  MessageSquare, 
  Workflow, 
  Database, 
  Users, 
  Zap,
  Shield,
  Globe,
  Sparkles,
  ChevronRight,
  Github,
  ArrowRight
} from "lucide-react";
import { WhatsAppButton } from "@/components/whatsapp-button-simple";
import { getAgentProfileSettings } from "@/lib/agent-profile/agent-profile-settings";
import type { AgentProfileSettings } from "@/lib/agent-profile/types";

export default function Home() {
  const [agentProfile, setAgentProfile] = useState<AgentProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getAgentProfileSettings();
        setAgentProfile(profile);
      } catch (error) {
        console.error("Failed to load agent profile:", error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const features = [
    {
      icon: Brain,
      title: "Intelligent Memory",
      description: "Advanced context retention and learning capabilities for personalized interactions",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: MessageSquare,
      title: "Multi-Channel Communication",
      description: "Seamlessly connect via WhatsApp, email, SMS, and web chat",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Workflow,
      title: "Custom Workflows",
      description: "Build complex conversation flows with visual workflow designer",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Users,
      title: "Custom Onboarding",
      description: "Create tailored onboarding experiences for different user segments",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Zap,
      title: "AI Triage System",
      description: "Intelligent routing and prioritization of conversations",
      gradient: "from-yellow-500 to-amber-500"
    },
    {
      icon: Database,
      title: "Knowledge Base",
      description: "Dynamic knowledge management with real-time updates",
      gradient: "from-indigo-500 to-purple-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
      {/* Hero Section with Agent Profile */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-blue-950/20 dark:via-gray-900 dark:to-purple-950/20" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Meet Your AI Assistant
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Powered by A1Framework - The most advanced conversational AI platform
            </p>
          </div>

          {/* Agent Profile Card */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : agentProfile ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
                <div className="md:flex">
                  <div className="md:w-1/3 p-8 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    {agentProfile.profileImageUrl ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-white rounded-full blur-2xl opacity-30 animate-pulse" />
                        <img
                          src={agentProfile.profileImageUrl}
                          alt={agentProfile.name}
                          className="relative w-48 h-48 rounded-full object-cover border-4 border-white shadow-xl"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center">
                        <Brain className="w-24 h-24 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="md:w-2/3 p-8">
                    <div className="mb-6">
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {agentProfile.name}
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-300 mb-1">
                        {agentProfile.role}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {agentProfile.companyName}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">About</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                          {agentProfile.companyDescription}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Capabilities</h3>
                        <div className="flex flex-wrap gap-2">
                          {agentProfile.botPurpose.slice(0, 3).map((purpose, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                            >
                              {purpose.split(' ').slice(0, 5).join(' ')}...
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <WhatsAppButton agentNumber={process.env.A1BASE_AGENT_NUMBER} />
                        <Link
                          href="/chat"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-1"
                        >
                          <MessageSquare className="w-5 h-5" />
                          Chat Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-400">
              Failed to load agent profile
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powered by A1Framework
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Build production-ready AI agents with enterprise-grade features
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
                
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.gradient} mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Build Your Own AI Agent?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Get started with A1Framework and create powerful conversational AI experiences
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-lg transition-all transform hover:-translate-y-1"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
            
            <a
              href="https://github.com/a1baseai/a1framework"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-all"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
