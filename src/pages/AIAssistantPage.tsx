import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProposalCard } from '../components/ai/ProposalCard';
import { MascotBunny } from '../components/common/MascotBunny';
import { aiApi } from '../lib/api/client';
import { AIProposal, ChatMessage } from '../types';
import { Bot, Send, Sparkles, User, RefreshCw, CheckCircle2 } from 'lucide-react';

export const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestionChips = [
    'Break down my Distributed Systems exam prep into 4 tasks',
    'Plan a 3-day weekend study sprint for HCI',
    'Suggest a daily 90-min coding & hydration habit',
    'Organize tasks for upcoming assignment deadline',
  ];

  useEffect(() => {
    // Initial welcome message with pre-loaded pending proposal
    aiApi.getProposals().then((proposals) => {
      const initialPending = proposals.find((p) => p.status === 'pending') || proposals[0];
      setMessages([
        {
          id: 'msg_welcome',
          sender: 'assistant',
          content: 'Hello Emily! I am your Taskora AI study strategist. Ask me to break down an assignment, design a study timetable, or organize your goals. Remember: nothing is committed to your database until you explicitly review and approve my proposal! 🌸',
          timestamp: 'Just now',
          proposal: initialPending,
        },
      ]);
    });
  }, []);

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt) return;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      // Generate structured proposal
      const proposal = await aiApi.generateProposal(prompt);
      const assistantMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        content: `I've formulated a structured action plan for you with ${proposal.items.length} proposed steps. Please review each item below before committing it to your tasks.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        proposal,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    await aiApi.approveProposal(proposalId);
    // Update local message proposal state
    setMessages((prev) =>
      prev.map((msg) =>
        msg.proposal?.id === proposalId
          ? { ...msg, proposal: { ...msg.proposal, status: 'approved' } }
          : msg
      )
    );
  };

  const handleRejectProposal = async (proposalId: string) => {
    await aiApi.rejectProposal(proposalId);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.proposal?.id === proposalId
          ? { ...msg, proposal: { ...msg.proposal, status: 'rejected' } }
          : msg
      )
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>AI Study Assistant</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-subtle text-primary font-bold">
              FR-03 Proposal Engine
            </span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Submit natural-language requests for task breakdowns. All suggestions require user confirmation.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-purple">
          <MascotBunny mood="focus" size={42} showSparkles={false} />
          <span>Bramble AI is online</span>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0 custom-scrollbar">
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1E163B] border border-subtle hover:border-primary text-deep-purple dark:text-lavender-200 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <Card className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-3xl ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-primary-subtle text-primary dark:bg-primary/20'
              }`}
            >
              {msg.sender === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Bubble & Proposal */}
            <div className="space-y-2 min-w-0 flex-1">
              <div
                className={`p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-white dark:bg-[#1E163B] border border-subtle text-deep-purple dark:text-white rounded-tl-none shadow-xs'
                }`}
              >
                <p>{msg.content}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    msg.sender === 'user' ? 'text-white/70' : 'text-muted-purple'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Structured Proposal Card attached to message */}
              {msg.proposal && (
                <ProposalCard
                  proposal={msg.proposal}
                  onApprove={handleApproveProposal}
                  onReject={handleRejectProposal}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-muted-purple animate-pulse">
            <div className="w-8 h-8 rounded-2xl bg-primary-subtle flex items-center justify-center text-primary">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <span>Taskora AI is formulating structured proposals...</span>
          </div>
        )}
      </Card>

      {/* Prompt Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex-shrink-0"
      >
        <div className="flex gap-2 p-2 rounded-3xl bg-white dark:bg-[#1E163B] border border-subtle shadow-lavender-sm">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Type your study goal or ask AI to break down a project..."
            disabled={loading}
            className="flex-1 text-xs sm:text-sm px-4 py-2 bg-transparent text-deep-purple dark:text-white focus:outline-none"
          />
          <Button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            pill
            size="sm"
            className="px-5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </form>
    </div>
  );
};
