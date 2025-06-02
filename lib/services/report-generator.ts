/**
 * Report Generator Service
 * 
 * Generates email status reports with user-specific data
 */

import { getInitializedAdapter } from '../supabase/config';
import { formatDistanceToNow } from 'date-fns';

export interface ReportData {
  userId: string;
  userName?: string;
  userEmail: string;
  dateRange: 'daily' | 'weekly' | 'monthly';
  projects: ProjectReportData[];
  conversations: ConversationReportData[];
  summary: ReportSummary;
}

export interface ProjectReportData {
  id: string;
  name: string;
  description: string;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
  attributes: Record<string, any>;
  taskCount: number;
  lastActivity: string;
}

export interface ConversationReportData {
  id: string;
  name: string;
  type: string;
  messageCount: number;
  lastMessageAt: string;
  participantsCount: number;
}

export interface ReportSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  totalConversations: number;
  totalMessages: number;
}

export class ReportGeneratorService {
  /**
   * Generate a complete report for a user
   */
  async generateReport(
    userId: string,
    reportType: string = 'project_status',
    dateRange: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<ReportData> {
    try {
      const adapter = await getInitializedAdapter();
      if (!adapter) {
        throw new Error('Database adapter not initialized');
      }

      // Get user information
      const { data: user } = await adapter.supabase
        .from('conversation_users')
        .select('name, phone_number')
        .eq('id', userId)
        .single();

      // Calculate date range
      const now = new Date();
      const dateRangeMap = {
        'daily': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        'weekly': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        'monthly': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      };
      const sinceDate = dateRangeMap[dateRange];

      // Get user's chats
      const { data: userChats } = await adapter.supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', userId);

      const chatIds = userChats?.map(uc => uc.chat_id) || [];

      console.log(`[ReportGenerator] User ${userId} has ${chatIds.length} chats: ${chatIds.join(', ')}`);

      // Get projects for these chats
      let projects: ProjectReportData[] = [];
      if (chatIds.length > 0) {
        // Get ALL projects for the user's chats, not just recent ones
        const { data: projectsData } = await adapter.supabase
          .from('projects')
          .select('*')
          .in('chat_id', chatIds)
          .order('is_live', { ascending: false })
          .order('created_at', { ascending: false });

        console.log(`[ReportGenerator] Found ${projectsData?.length || 0} projects for user ${userId}`);
        if (projectsData && projectsData.length > 0) {
          console.log(`[ReportGenerator] Projects:`, projectsData.map(p => ({ 
            id: p.id, 
            name: p.name, 
            chat_id: p.chat_id,
            is_live: p.is_live 
          })));
        }

        // Get project events count for each project (still filtered by date for activity tracking)
        const projectIds = projectsData?.map(p => p.id) || [];
        const { data: projectEvents } = await adapter.supabase
          .from('project_events')
          .select('project_id')
          .in('project_id', projectIds)
          .gte('created_at', sinceDate.toISOString());

        // Count events per project
        const eventCounts: Record<string, number> = {};
        projectEvents?.forEach(event => {
          eventCounts[event.project_id] = (eventCounts[event.project_id] || 0) + 1;
        });

        // Format projects
        projects = (projectsData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          isLive: p.is_live,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          attributes: p.attributes || {},
          taskCount: eventCounts[p.id] || 0,
          lastActivity: p.updated_at
        }));
      }

      // Get conversations data
      let conversations: ConversationReportData[] = [];
      if (chatIds.length > 0) {
        const { data: chatsData } = await adapter.supabase
          .from('chats')
          .select('*')
          .in('id', chatIds);

        // Get message counts for each chat
        const messageCounts: Record<string, { count: number; lastMessage: string }> = {};
        
        for (const chatId of chatIds) {
          const { data: messages, count } = await adapter.supabase
            .from('messages')
            .select('created_at', { count: 'exact', head: false })
            .eq('chat_id', chatId)
            .gte('created_at', sinceDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

          messageCounts[chatId] = {
            count: count || 0,
            lastMessage: messages?.[0]?.created_at || ''
          };
        }

        // Get participant counts
        const participantCounts: Record<string, number> = {};
        for (const chatId of chatIds) {
          const { count } = await adapter.supabase
            .from('chat_participants')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId);
          
          participantCounts[chatId] = count || 0;
        }

        // Format conversations
        conversations = (chatsData || [])
          .filter(c => messageCounts[c.id]?.count > 0)
          .map((c: any) => ({
            id: c.id,
            name: c.name || 'Unnamed Chat',
            type: c.type,
            messageCount: messageCounts[c.id]?.count || 0,
            lastMessageAt: messageCounts[c.id]?.lastMessage || c.created_at,
            participantsCount: participantCounts[c.id] || 0
          }))
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      }

      // Calculate summary
      const summary: ReportSummary = {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.isLive).length,
        completedProjects: projects.filter(p => !p.isLive).length,
        totalTasks: projects.reduce((sum, p) => sum + p.taskCount, 0),
        totalConversations: conversations.length,
        totalMessages: conversations.reduce((sum, c) => sum + c.messageCount, 0)
      };

      return {
        userId,
        userName: user?.name,
        userEmail: '', // Will be set by the caller
        dateRange,
        projects,
        conversations,
        summary
      };
    } catch (error) {
      console.error('[ReportGeneratorService] Error generating report:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email content from report data
   */
  generateHTMLEmail(reportData: ReportData): string {
    const { projects, conversations, summary, dateRange, userName } = reportData;
    
    const dateRangeText = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly'
    }[dateRange];

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Dynamic opening based on performance
    let opening = '';
    if (summary.activeProjects > 3) {
      opening = `You're juggling ${summary.activeProjects} active projects. Impressive momentum!`;
    } else if (summary.activeProjects === 0) {
      opening = "No active projects right now. Time to start something new?";
    } else if (summary.completedProjects > 0) {
      opening = `${summary.completedProjects} projects completed. That's what I call execution!`;
    } else {
      opening = "Here's where you stand with your projects.";
    }

    // Dynamic motivation based on activity
    let motivation = '';
    if (summary.totalTasks > 10) {
      motivation = "You're on fire! Keep pushing.";
    } else if (summary.totalTasks > 5) {
      motivation = "Good progress. Let's accelerate.";
    } else if (summary.totalTasks > 0) {
      motivation = "Some movement, but we can do better.";
    } else {
      motivation = "Time to get some wins on the board.";
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Project Reality Check</title>
</head>
<body style="margin: 20px; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
  <div style="max-width: 800px; margin: 0 auto;">
    <p>${userName || 'Hey'},</p>
    
    <p>${opening}</p>
    
    <p>The numbers (${dateRange}):</p>
    <ul style="margin: 10px 0 20px 0; padding-left: 20px;">
      <li><strong>${summary.activeProjects}</strong> projects in play</li>
      <li><strong>${summary.completedProjects}</strong> crossed the finish line</li>
      <li><strong>${summary.totalTasks}</strong> actions taken</li>
      <li><strong>${summary.totalMessages}</strong> messages exchanged</li>
    </ul>
    
    <p>${motivation}</p>
    
    ${this.generateProjectsSharp(projects)}
    ${this.generateConversationsSharp(conversations)}
    
    ${this.generateCallToAction(summary, projects)}
    
    <p>Let's make things happen,<br>
    <strong>Felicie</strong></p>
    
    <p style="font-size: 12px; color: #666; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
      <em>Want to change how often you get these? Just tell me "change my report frequency" or "stop reports".</em>
    </p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate a motivational call to action based on data
   */
  private generateCallToAction(summary: ReportSummary, projects: ProjectReportData[]): string {
    const activeProjects = projects.filter(p => p.isLive);
    const staleProjects = activeProjects.filter(p => {
      const daysSinceUpdate = p.lastActivity 
        ? Math.floor((Date.now() - new Date(p.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return daysSinceUpdate > 7;
    });

    let cta = '<p style="margin-top: 30px; font-weight: bold;">';
    
    if (staleProjects.length > 0) {
      cta += `🚨 ${staleProjects.length} project${staleProjects.length > 1 ? 's need' : ' needs'} attention. No updates in over a week.`;
    } else if (summary.activeProjects === 0) {
      cta += "🎯 Ready to start your next big thing? Tell me about it.";
    } else if (summary.activeProjects > 5) {
      cta += "⚡ That's a lot of plates spinning. Which one needs focus today?";
    } else if (summary.totalTasks === 0) {
      cta += "📋 No tasks recorded this period. What's the next move?";
    } else {
      cta += "💪 Keep the momentum going. What's next?";
    }
    
    cta += '</p>';
    return cta;
  }

  /**
   * Generate projects table with Felicie's sharp style
   */
  private generateProjectsSharp(projects: ProjectReportData[]): string {
    if (projects.length === 0) {
      return '<p style="margin: 20px 0;"><strong>No projects tracked yet.</strong> Let\'s fix that.</p>';
    }

    const activeProjects = projects.filter(p => p.isLive);
    const completedProjects = projects.filter(p => !p.isLive);

    let html = '';

    if (activeProjects.length > 0) {
      html += '<p><strong>Active Projects</strong> (where the action is):</p>';
      html += `
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; margin: 10px 0 20px 0; font-size: 13px;">
  <tr style="background-color: #f0f0f0;">
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Project</th>
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">What it\'s about</th>
    <th style="text-align: center; padding: 8px; border: 1px solid #ccc;">Actions</th>
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Last touched</th>
  </tr>`;

      activeProjects.forEach(project => {
        const lastActivity = project.lastActivity 
          ? new Date(project.lastActivity).toLocaleDateString()
          : 'Never';
        
        const daysSince = project.lastActivity 
          ? Math.floor((Date.now() - new Date(project.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        const statusIcon = daysSince > 7 ? '⚠️ ' : '';
        
        html += `
  <tr>
    <td style="padding: 8px; border: 1px solid #ccc;">${statusIcon}${this.escapeHtml(project.name)}</td>
    <td style="padding: 8px; border: 1px solid #ccc;">${this.escapeHtml(project.description)}</td>
    <td style="text-align: center; padding: 8px; border: 1px solid #ccc;">${project.taskCount || '-'}</td>
    <td style="padding: 8px; border: 1px solid #ccc;">${lastActivity}</td>
  </tr>`;
      });

      html += '</table>';
    }

    if (completedProjects.length > 0) {
      html += `<p style="margin-top: 20px;"><strong>Completed</strong> (victory lap):</p>
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; margin: 10px 0 20px 0; font-size: 13px;">
  <tr style="background-color: #f0f0f0;">
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Project</th>
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Finished</th>
  </tr>`;

      completedProjects.slice(0, 5).forEach(project => {
        const completedDate = project.updatedAt 
          ? new Date(project.updatedAt).toLocaleDateString()
          : 'Recently';
        
        html += `
  <tr>
    <td style="padding: 8px; border: 1px solid #ccc;">✅ ${this.escapeHtml(project.name)}</td>
    <td style="padding: 8px; border: 1px solid #ccc;">${completedDate}</td>
  </tr>`;
      });

      if (completedProjects.length > 5) {
        html += `
  <tr>
    <td colspan="2" style="padding: 8px; border: 1px solid #ccc; text-align: center; font-style: italic;">
      + ${completedProjects.length - 5} more wins
    </td>
  </tr>`;
      }

      html += '</table>';
    }

    return html;
  }

  /**
   * Generate conversations table with Felicie's style
   */
  private generateConversationsSharp(conversations: ConversationReportData[]): string {
    if (conversations.length === 0) {
      return '';
    }

    // Only show if there's significant activity
    const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);
    if (totalMessages < 5) {
      return '<p style="margin-top: 20px;"><strong>Communication:</strong> Pretty quiet this period. 🦗</p>';
    }

    let html = `<p style="margin-top: 30px;"><strong>Where you've been talking:</strong></p>
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; margin: 10px 0 20px 0; font-size: 13px;">
  <tr style="background-color: #f0f0f0;">
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Chat</th>
    <th style="text-align: center; padding: 8px; border: 1px solid #ccc;">Messages</th>
    <th style="text-align: left; padding: 8px; border: 1px solid #ccc;">Last word</th>
  </tr>`;

    conversations.slice(0, 3).forEach(conversation => {
      const lastActivity = conversation.lastMessageAt 
        ? new Date(conversation.lastMessageAt).toLocaleDateString()
        : 'N/A';
      
      const chatType = conversation.type === 'group' ? ' 👥' : '';
      
      html += `
  <tr>
    <td style="padding: 8px; border: 1px solid #ccc;">${this.escapeHtml(conversation.name)}${chatType}</td>
    <td style="text-align: center; padding: 8px; border: 1px solid #ccc;">${conversation.messageCount}</td>
    <td style="padding: 8px; border: 1px solid #ccc;">${lastActivity}</td>
  </tr>`;
    });

    html += '</table>';
    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
} 