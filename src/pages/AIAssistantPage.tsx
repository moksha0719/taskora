import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { ProposalCard } from '../components/ai/ProposalCard';
import { MascotBunny } from '../components/common/MascotBunny';
import { aiApi, ApiError } from '../lib/api/client';
import type { AIConversationSummary } from '../lib/api/client';
import type { ChatMessage } from '../types';
import { Bot, Send, Sparkles, User, Plus } from 'lucide-react';

export const AIAssistantPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const suggestionChips = [
    'Break down my Distributed Systems exam prep into 4 tasks',
    'Plan a 3-day weekend study sprint for HCI',
    'Suggest a daily 90-min coding & hydration habit',
    'Organize tasks for upcoming assignment deadline',
  ];

  useEffect(() => {
    const state = location.state as { initialPrompt?: unknown } | null;
    if (typeof state?.initialPrompt !== 'string') return;
    setInputPrompt(state.initialPrompt);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  useEffect(() => {
    let active = true;
    const loadAssistant = async () => {
      try {
        const history = await aiApi.loadConversation();
        if (!active) return;
        setMessages(history);
        setActiveConversationId(aiApi.getActiveConversationId());
        try {
          setConversations(await aiApi.getConversations());
        } catch (cause: unknown) {
          if (active) {
            setError(cause instanceof Error ? cause.message : 'Unable to load saved conversations.');
          }
        }
      } catch (cause: unknown) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load your assistant conversation.');
        }
      } finally {
        if (active) setLoadingConversation(false);
      }
    };
    void loadAssistant();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectConversation = async (conversationId: string) => {
    if (!conversationId || conversationId === activeConversationId) return;
    setLoadingConversation(true);
    setError(null);
    try {
      const history = await aiApi.loadConversation(conversationId);
      setMessages(history);
      setActiveConversationId(aiApi.getActiveConversationId());
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the selected conversation.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleNewConversation = async () => {
    setLoadingConversation(true);
    setError(null);
    try {
      const conversation = await aiApi.createConversation();
      setConversations((previous) => [
        conversation,
        ...previous.filter((item) => item.id !== conversation.id),
      ]);
      setActiveConversationId(conversation.id);
      setMessages([]);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to create a new conversation.');
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    if (loading || loadingConversation || sendingRef.current) return;
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt) return;
    sendingRef.current = true;

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);
    setError(null);

    try {
      const result = await aiApi.generateAssistantResponse(prompt);
      setActiveConversationId(aiApi.getActiveConversationId());
      const assistantMsg: ChatMessage = {
        id: result.assistantMessageId,
        sender: 'assistant',
        content: result.response,
        timestamp: result.timestamp,
      };
      const proposalMessages: ChatMessage[] = result.proposals.map((proposal) => ({
        id: `proposal-${proposal.id}`,
        sender: 'assistant',
        content: 'Suggested task proposal',
        timestamp: proposal.suggestedAt
          ? new Date(proposal.suggestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : result.timestamp,
        proposal,
      }));
      setMessages((prev) => [...prev, assistantMsg, ...proposalMessages]);
      try {
        setConversations(await aiApi.getConversations());
      } catch (cause: unknown) {
        setError(cause instanceof Error
          ? `Message sent, but saved conversations could not be refreshed: ${cause.message}`
          : 'Message sent, but saved conversations could not be refreshed.');
      }
    } catch (cause: unknown) {
      setMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
      setInputPrompt(prompt);
      if (cause instanceof ApiError && cause.status === 503) {
        setError('The AI provider is unavailable (503). Please try again later.');
      } else if (cause instanceof ApiError && cause.status === 504) {
        setError('The AI provider timed out (504). Please try again.');
      } else if (cause instanceof ApiError && cause.status === 502) {
        setError(cause.message === 'AI returned an invalid response'
          ? 'The AI response could not be formatted into task proposals. Please try again or rephrase your request.'
          : 'The AI provider is temporarily unavailable (502). Please try again later.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to send your message.');
      }
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleApproveProposal = async (proposalId: string): Promise<boolean> => {
    setError(null);
    try {
      await aiApi.approveProposal(proposalId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.proposal?.id === proposalId
            ? { ...msg, proposal: { ...msg.proposal, status: 'approved' } }
            : msg
        )
      );
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to approve this proposal.');
      return false;
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setError(null);
    try {
      await aiApi.rejectProposal(proposalId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.proposal?.id === proposalId
            ? { ...msg, proposal: { ...msg.proposal, status: 'rejected' } }
            : msg
        )
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to reject this proposal.');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>AI Study Assistant</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Submit natural-language requests for task breakdowns. All suggestions require user confirmation.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="ai-conversation" className="sr-only">Saved conversations</label>
            <select
              id="ai-conversation"
              aria-label="Saved conversations"
              value={activeConversationId || ''}
              onChange={(event) => void handleSelectConversation(event.target.value)}
              disabled={loadingConversation || loading || conversations.length === 0}
              className="max-w-full rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-deep-purple dark:bg-[#1E163B] dark:text-white"
            >
              {conversations.length === 0 && <option value="">No saved conversations</option>}
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title || 'Untitled conversation'}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              pill
              disabled={loadingConversation || loading}
              onClick={() => void handleNewConversation()}
            >
              <Plus className="h-3.5 w-3.5" />
              New conversation
            </Button>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-purple">
          <MascotBunny mood="focus" size={42} showSparkles={false} />
          <span>Your study strategist</span>
        </div>
      </div>

      {error && <Card role="alert" className="flex-shrink-0 p-3 text-xs text-rose-600">{error}</Card>}

      {/* Suggestion Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0 custom-scrollbar">
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading || loadingConversation}
            className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1E163B] border border-subtle hover:border-primary text-deep-purple dark:text-lavender-200 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <Card className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
        {loadingConversation && (
          <p className="text-sm text-muted-purple">Loading your saved assistant conversation...</p>
        )}
        {!loadingConversation && messages.length === 0 && (
          <p className="text-sm text-muted-purple">
            Your assistant conversation will appear here. Ask a question or choose a suggestion to get started.
          </p>
        )}
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
            <span role="status" aria-live="polite">Taskora AI is preparing a response...</span>
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
            disabled={loading || loadingConversation}
            className="flex-1 text-xs sm:text-sm px-4 py-2 bg-transparent text-deep-purple dark:text-white focus:outline-none"
          />
          <Button
            type="submit"
            disabled={loading || loadingConversation || !inputPrompt.trim()}
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
