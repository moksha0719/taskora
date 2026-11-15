import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge, PriorityBadge } from '../common/Badge';
import { AIProposal, AIProposalItem } from '../../types';
import { Sparkles, Check, X, Edit2, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ProposalCardProps {
  proposal: AIProposal;
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => Promise<void>;
  onEdit?: (proposal: AIProposal) => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  onApprove,
  onReject,
  onEdit,
}) => {
  const [loading, setLoading] = useState(false);
  const isPending = proposal.status === 'pending';

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(proposal.id);
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#9885E8', '#DDF3E9', '#FEF3D6'],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(proposal.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 border-2 border-primary/30 bg-gradient-to-br from-white via-primary-subtle/10 to-soft-pink/10 dark:from-[#1E163B] dark:to-[#251D42] my-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-subtle text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              AI Action Proposal (FR-03)
            </span>
            <h4 className="text-sm font-bold text-deep-purple dark:text-white font-heading">
              {proposal.title}
            </h4>
          </div>
        </div>

        {proposal.status === 'approved' && (
          <Badge variant="mint">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Saved
          </Badge>
        )}
        {proposal.status === 'rejected' && (
          <Badge variant="pink">Rejected</Badge>
        )}
        {proposal.status === 'pending' && (
          <Badge variant="peach">Pending Your Review</Badge>
        )}
      </div>

      <p className="text-xs text-muted-purple mb-4">
        {proposal.description}
      </p>

      {/* Structured Proposal Items List */}
      <div className="space-y-2 mb-4 bg-white/70 dark:bg-[#181131]/60 p-3 rounded-2xl border border-subtle">
        <span className="text-[11px] font-bold text-deep-purple dark:text-lavender-200 block mb-1">
          Proposed Action Items ({proposal.items.length})
        </span>

        {proposal.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2 rounded-xl bg-primary-subtle/20 dark:bg-primary/5 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span className="font-medium text-deep-purple dark:text-white truncate">
                {item.title}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {item.priority && <PriorityBadge priority={item.priority} />}
              {item.estimatedMinutes && (
                <span className="text-[10px] text-muted-purple flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> {item.estimatedMinutes}m
                </span>
              )}
              {item.date && (
                <span className="text-[10px] text-muted-purple flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" /> {item.date}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Review & Commitment Controls (FR-03 & AI Principle: Nothing is saved until confirmed!) */}
      {isPending ? (
        <div className="flex items-center justify-between pt-2 border-t border-subtle">
          <span className="text-[11px] text-muted-purple italic">
            Review changes before committing to database.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={loading}
              pill
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </Button>
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(proposal)}
                disabled={loading}
                pill
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              disabled={loading}
              pill
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve & Save Tasks</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-right">
          <span className="text-[11px] text-muted-purple">
            {proposal.status === 'approved' ? 'Committed to your tasks list.' : 'Proposal was declined.'}
          </span>
        </div>
      )}
    </Card>
  );
};
