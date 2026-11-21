import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge, PriorityBadge, StatusBadge } from '../components/common/Badge';
import { searchApi } from '../lib/api/client';
import { Task, StudyNote, Habit } from '../types';
import { Search, Filter, CheckSquare, FileText, Flame, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tasks' | 'notes' | 'habits'>('all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSearchError(null);
    const timeout = window.setTimeout(() => {
      searchApi.search(query)
        .then((result) => {
          if (!active) return;
          setTasks(result.tasks);
          setNotes(result.notes);
          setHabits(result.habits);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setTasks([]);
          setNotes([]);
          setHabits([]);
          setSearchError(cause instanceof Error ? cause.message : 'Unable to search your data.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const cleanQuery = query.toLowerCase().trim();

  const matchingTasks = tasks.filter((t) =>
    !cleanQuery || t.title.toLowerCase().includes(cleanQuery) || t.category.toLowerCase().includes(cleanQuery)
  );

  const matchingNotes = notes.filter((n) =>
    !cleanQuery || n.title.toLowerCase().includes(cleanQuery) || n.content.toLowerCase().includes(cleanQuery)
  );

  const matchingHabits = habits.filter((h) =>
    !cleanQuery || h.title.toLowerCase().includes(cleanQuery) || h.category.toLowerCase().includes(cleanQuery)
  );
  const hasFilteredResults =
    ((filterType === 'all' || filterType === 'tasks') && matchingTasks.length > 0) ||
    ((filterType === 'all' || filterType === 'notes') && matchingNotes.length > 0) ||
    ((filterType === 'all' || filterType === 'habits') && matchingHabits.length > 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
          <span>Global Search</span>
        </h2>
        <p className="text-xs text-muted-purple mt-0.5">
          Unified index across your tasks, study workspace notes, habits, and syllabus documents.
        </p>
      </div>

      {/* Search Input Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="w-5 h-5 text-muted-purple absolute left-4 top-3.5" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, topics, assignment titles, or tags..."
            className="w-full text-sm pl-12 pr-4 py-3 rounded-2xl border border-subtle bg-white dark:bg-[#181131] text-deep-purple dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-subtle">
          {(['all', 'tasks', 'notes', 'habits'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                filterType === type
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-primary-subtle/50 text-muted-purple hover:text-deep-purple'
              }`}
            >
              {type === 'all' ? 'All Results' : type}
            </button>
          ))}
        </div>
      </Card>

      {/* Results Sections */}
      <div className="space-y-6">
        {loading && <Card role="status" className="p-5 text-sm text-muted-purple">Searching your data...</Card>}
        {searchError && <Card role="alert" className="p-5 text-sm text-rose-600">{searchError}</Card>}
        {!loading && !searchError && !hasFilteredResults && (
          <Card className="p-6 text-sm text-muted-purple">
            {cleanQuery
              ? `No matching ${filterType === 'all' ? 'tasks, notes, or habits' : filterType} were found.`
              : 'You do not have tasks, notes, or habits to search yet.'}
          </Card>
        )}

        {/* Tasks Section */}
        {!loading && !searchError && (filterType === 'all' || filterType === 'tasks') && matchingTasks.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-purple flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span>Matching Tasks ({matchingTasks.length})</span>
            </h3>
            <div className="space-y-2">
              {matchingTasks.map((t) => (
                <Card
                  key={t.id}
                  hover
                  onClick={() => navigate('/tasks')}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <h4 className="text-xs font-bold text-deep-purple dark:text-white">
                      {t.title}
                    </h4>
                    <span className="text-[11px] text-muted-purple">{t.category} • Due {t.dueDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {!loading && !searchError && (filterType === 'all' || filterType === 'notes') && matchingNotes.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-purple flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Matching Study Notes ({matchingNotes.length})</span>
            </h3>
            <div className="space-y-2">
              {matchingNotes.map((n) => (
                <Card
                  key={n.id}
                  hover
                  onClick={() => navigate('/workspace')}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <h4 className="text-xs font-bold text-deep-purple dark:text-white truncate">
                      {n.title}
                    </h4>
                    <p className="text-[11px] text-muted-purple line-clamp-1">{n.content}</p>
                  </div>
                  <Badge variant="primary">{n.subjectName}</Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Habits Section */}
        {!loading && !searchError && (filterType === 'all' || filterType === 'habits') && matchingHabits.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-purple flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <span>Matching Habits ({matchingHabits.length})</span>
            </h3>
            <div className="space-y-2">
              {matchingHabits.map((h) => (
                <Card
                  key={h.id}
                  hover
                  onClick={() => navigate('/habits')}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <h4 className="text-xs font-bold text-deep-purple dark:text-white">
                      {h.title}
                    </h4>
                    <span className="text-[11px] text-muted-purple">{h.category}</span>
                  </div>
                  <span className="text-xs font-bold text-soft-peach-text">
                    🔥 {h.streakCount} days
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
