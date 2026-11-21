import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProposalCard } from '../components/ai/ProposalCard';
import { BrainDumpEntry, AIProposal } from '../types';
import { brainDumpApi } from '../lib/api/client';
import { Lightbulb, Sparkles, Send, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { MascotBunny } from '../components/common/MascotBunny';

export const BrainDumpPage: React.FC = () => {
  const [entries, setEntries] = useState<BrainDumpEntry[]>([]);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<AIProposal | null>(null);
  const [activeBrainDumpId, setActiveBrainDumpId] = useState<string | null>(null);

  const fetchEntries = async () => {
    setIsFetching(true);
    setFetchError(null);
    try {
      setEntries(await brainDumpApi.getEntries());
    } catch (cause) {
      setFetchError(cause instanceof Error ? cause.message : 'Unable to load captured entries.');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    void fetchEntries();
  }, []);

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    await brainDumpApi.addEntry(rawText.trim());
    setRawText('');
    fetchEntries();
  };

  const handleOrganizeWithAI = async (entry: BrainDumpEntry) => {
    setLoading(true);
    try {
      const proposal = await brainDumpApi.convertToProposal(entry.id);
      setActiveProposal(proposal);
      setActiveBrainDumpId(entry.id);
      fetchEntries();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
          <span>Brain Dump</span>
        </h2>
        <p className="text-xs text-muted-purple mt-0.5">
          Friction-free space to dump chaotic ideas, to-dos, or notes. Click "Organize with AI" to transform them into reviewable task proposals.
        </p>
      </div>

      {/* Rapid Capture Input Area */}
      <Card className="p-6">
        <form onSubmit={handleCapture} className="space-y-3">
          <label className="block text-xs font-bold text-deep-purple dark:text-lavender-200">
            Rapid Thought Capture (Type anything on your mind)
          </label>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="e.g. Need to review Chapter 5 graphs, email lab partner about Git pull request, and get green tea..."
            className="w-full text-xs sm:text-sm p-4 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-purple italic">
              Raw entries remain private until organized.
            </span>
            <Button type="submit" disabled={!rawText.trim()} pill size="sm">
              <Send className="w-3.5 h-3.5" />
              <span>Capture Thought</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Generated Proposal Banner if any is active */}
      {activeProposal && (
        <div className="animate-fade-in">
          <h3 className="text-sm font-bold text-deep-purple dark:text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI Organized Action Plan:</span>
          </h3>
          <ProposalCard
            proposal={activeProposal}
            onApprove={async (id) => {
              if (activeBrainDumpId) await brainDumpApi.approveProposal(activeBrainDumpId, id);
              setActiveProposal(null);
              setActiveBrainDumpId(null);
              fetchEntries();
            }}
            onReject={async (id) => {
              if (activeBrainDumpId) await brainDumpApi.rejectProposal(activeBrainDumpId, id);
              setActiveProposal(null);
              setActiveBrainDumpId(null);
              fetchEntries();
            }}
          />
        </div>
      )}

      {/* Captured Entries List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold font-heading text-deep-purple dark:text-white">
            Captured Entries ({entries.length})
          </h3>
        </div>

        {isFetching && <Card role="status" className="p-5 text-sm text-muted-purple">Loading captured entries...</Card>}
        {fetchError && (
          <Card role="alert" className="p-5 flex items-center justify-between gap-3 text-sm text-rose-600">
            <span>{fetchError}</span>
            <button type="button" className="font-bold text-primary" onClick={() => void fetchEntries()}>
              Retry
            </button>
          </Card>
        )}
        {!isFetching && !fetchError && entries.length === 0 && (
          <Card className="p-6 text-sm text-muted-purple">
            No captured thoughts yet. Add one above to get started.
          </Card>
        )}
        {!isFetching && !fetchError && entries.length > 0 && entries.map((entry) => (
          <Card key={entry.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={entry.status === 'organized' ? 'mint' : 'primary'}>
                  {entry.status === 'organized' ? 'Organized with AI ✓' : 'Unprocessed'}
                </Badge>
                {entry.categoryHint && (
                  <span className="text-[11px] text-muted-purple font-medium">
                    • {entry.categoryHint}
                  </span>
                )}
                <span className="text-[11px] text-muted-purple flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-deep-purple dark:text-lavender-100 font-medium leading-relaxed">
                "{entry.rawText}"
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
              <Button
                variant={entry.status === 'organized' ? 'outline' : 'primary'}
                size="sm"
                pill
                disabled={loading}
                onClick={() => handleOrganizeWithAI(entry)}
                className="text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{entry.status === 'organized' ? 'Re-organize' : 'Organize with AI'}</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
