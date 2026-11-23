import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send } from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

export const AIAssistantWidget: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const initialPrompt = prompt.trim();
    if (!initialPrompt) return;
    navigate('/ai-assistant', { state: { initialPrompt } });
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/20">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold font-heading text-deep-purple dark:text-white">AI Assistant</h3>
          <p className="text-xs text-muted-purple">What would you like help with?</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-label="Ask AI"
          placeholder="Ask a study question..."
          className="min-w-0 flex-1 rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-deep-purple focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-[#181131] dark:text-white"
        />
        <Button type="submit" size="sm" pill disabled={!prompt.trim()} aria-label="Ask AI">
          <Send className="h-3.5 w-3.5" />
          <span>Ask AI</span>
        </Button>
      </form>
    </Card>
  );
};
