import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { notesApi, studyPlansApi } from '../lib/api/client';
import type { StudyNote, StudyPlanSubject } from '../types';
import {
  FolderKanban,
  FileText,
  Lock,
  Globe,
  Plus,
  Trash2,
  Share2,
  Save,
  Tag,
  Bold,
  Italic,
  Code,
  List,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';

export const WorkspacePage: React.FC = () => {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [plannerSubjects, setPlannerSubjects] = useState<Pick<StudyPlanSubject, 'id' | 'name'>[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);

  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(true);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notesApi.getNotes();
      setNotes(data);
      if (data.length > 0 && !selectedNote) {
        selectNote(data[0]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load notes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlannerSubjects = async () => {
    setSubjectsLoading(true);
    setSubjectsError(null);
    try {
      const plans = await studyPlansApi.getPlans();
      const uniqueSubjects = new Map<string, Pick<StudyPlanSubject, 'id' | 'name'>>();
      plans.forEach((plan) => {
        plan.subjects.forEach((subject) => {
          const key = subject.name.trim().toLocaleLowerCase();
          if (key && !uniqueSubjects.has(key)) {
            uniqueSubjects.set(key, { id: subject.id, name: subject.name.trim() });
          }
        });
      });
      setPlannerSubjects(Array.from(uniqueSubjects.values()));
    } catch (cause) {
      setPlannerSubjects([]);
      setSubjectsError(cause instanceof Error ? cause.message : 'Unable to load Study Planner subjects.');
    } finally {
      setSubjectsLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotes();
    void fetchPlannerSubjects();
  }, []);

  const selectNote = (note: StudyNote) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditIsPrivate(note.isPrivate);
    setShareLink('');
    setCopyStatus(null);
  };

  const handleSaveNote = async () => {
    if (!selectedNote || !editTitle.trim()) return;

    setError(null);
    try {
      const saved = await notesApi.saveNote({
        ...selectedNote,
        title: editTitle,
        content: editContent,
        isPrivate: editIsPrivate,
      });
      setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
      setSelectedNote(saved);
      setShareLink('');
      setCopyStatus(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this note.');
    }
  };

  const handleCreateNewNote = async () => {
    setError(null);
    const selectedPlannerSubject = plannerSubjects.find((subject) => subject.name === activeSubject)
      || (activeSubject === 'all' ? plannerSubjects[0] : undefined);
    const subjectName = selectedPlannerSubject?.name
      || (activeSubject === 'all' ? 'General' : activeSubject);
    const existingSubject = notes.find((note) => note.subjectName === subjectName);
    try {
      const newNote = await notesApi.saveNote({
        title: 'Untitled Study Note',
        subjectId: selectedPlannerSubject?.id || existingSubject?.subjectId || 'sub_general',
        subjectName,
        content: 'Start writing your lecture summary or revision notes here...',
        tags: ['Revision'],
        isPrivate: true,
      });
      setNotes((prev) => [newNote, ...prev]);
      selectNote(newNote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create a note.');
    }
  };

  const handleCopyShareLink = async () => {
    if (!selectedNote?.shareCode) return;
    const link = `${window.location.origin}/shared-notes/${selectedNote.shareCode}`;
    setShareLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('Share link copied.');
    } catch {
      setCopyStatus('Clipboard access is unavailable. Select and copy the link below.');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Delete this note?')) {
      setError(null);
      try {
        await notesApi.deleteNote(id);
        const remaining = notes.filter((n) => n.id !== id);
        setNotes(remaining);
        if (remaining.length > 0) selectNote(remaining[0]);
        else setSelectedNote(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to delete this note.');
      }
    }
  };

  const subjectOptions = new Map<string, { id: string; name: string }>();
  plannerSubjects.forEach((subject) => {
    subjectOptions.set(subject.name.toLocaleLowerCase(), subject);
  });
  notes.forEach((note) => {
    const key = note.subjectName.trim().toLocaleLowerCase();
    if (key && !subjectOptions.has(key)) {
      subjectOptions.set(key, { id: note.subjectId, name: note.subjectName.trim() });
    }
  });
  const subjects = [
    { id: 'all', name: 'All Subjects' },
    ...Array.from(subjectOptions.values()).map((subject) => ({
      id: subject.name,
      name: subject.name,
    })),
  ];

  const filteredNotes = notes.filter(
    (n) => activeSubject === 'all' || n.subjectName === activeSubject
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            <span>Study Workspace & Notes</span>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Create structured subject notes. Notes remain completely private unless you toggle explicit sharing.
          </p>
        </div>

        {error && <Card role="alert" className="text-sm text-rose-600">{error}</Card>}
        {subjectsError && (
          <Card role="alert" className="text-sm text-rose-600">
            {subjectsError} New notes will use General unless a subject is selected.
          </Card>
        )}
        {loading && <Card className="text-sm text-muted-purple">Loading notes...</Card>}
        {!loading && !error && notes.length === 0 && (
          <Card className="text-sm text-muted-purple">No notes yet. Create a note to start your workspace.</Card>
        )}

        <Button
          variant="primary"
          size="sm"
          pill
          onClick={handleCreateNewNote}
          disabled={subjectsLoading}
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </Button>
      </div>

      {/* Main 3-Pane Layout (Subjects, Notes List, Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Col: Subjects Sidebar (3 cols) */}
        <Card className="lg:col-span-3 p-4 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-purple px-2 mb-3">
              Course Subjects
            </h4>
            <div className="space-y-1">
              {subjectsLoading && <p className="px-2 text-[11px] text-muted-purple">Loading subjects...</p>}
              {subjects.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubject(sub.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all text-left',
                    activeSubject === sub.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-deep-purple dark:text-lavender-200 hover:bg-primary-subtle'
                  )}
                >
                  <span className="truncate">{sub.name}</span>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-bold',
                      activeSubject === sub.id
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-subtle text-primary'
                    )}
                  >
                    {sub.id === 'all'
                      ? notes.length
                      : notes.filter((n) => n.subjectName === sub.id).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-subtle mt-4">
            <span className="text-[11px] text-muted-purple flex items-center gap-1.5 px-2">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>Private workspace encrypted</span>
            </span>
          </div>
        </Card>

        {/* Middle Col: Notes List (3 cols) */}
        <Card className="lg:col-span-3 p-4 overflow-y-auto max-h-[650px] custom-scrollbar space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-purple px-2 mb-2">
            Notes ({filteredNotes.length})
          </h4>

          {filteredNotes.map((note) => {
            const isSelected = selectedNote?.id === note.id;
            return (
              <div
                key={note.id}
                onClick={() => selectNote(note)}
                className={cn(
                  'p-3 rounded-2xl border cursor-pointer transition-all',
                  isSelected
                    ? 'bg-primary-subtle/50 border-primary text-deep-purple dark:text-white shadow-xs'
                    : 'bg-white dark:bg-[#1E163B] border-subtle hover:border-primary/40 text-muted-purple'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-primary truncate max-w-[120px]">
                    {note.subjectName}
                  </span>
                  {note.isPrivate ? (
                    <span className="text-[10px] text-muted-purple flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Private
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" /> Shared
                    </span>
                  )}
                </div>
                <h5 className="text-xs font-bold text-deep-purple dark:text-white line-clamp-1">
                  {note.title}
                </h5>
                <p className="text-[11px] text-muted-purple line-clamp-2 mt-1">
                  {note.content}
                </p>
              </div>
            );
          })}
        </Card>

        {/* Right Col: Note Editor (6 cols) */}
        <Card className="lg:col-span-6 p-6 flex flex-col justify-between">
          {selectedNote ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Note Header & Title */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-subtle">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-bold font-heading text-deep-purple dark:text-white bg-transparent w-full focus:outline-none"
                  placeholder="Note Title"
                />

                <button
                  type="button"
                  onClick={() => setEditIsPrivate(!editIsPrivate)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all',
                    editIsPrivate
                      ? 'bg-primary-subtle text-primary border border-primary/20'
                      : 'bg-mint-accent text-mint-accent-text border border-emerald-300 shadow-xs'
                  )}
                >
                  {editIsPrivate ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Shared Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-primary-subtle/20 dark:bg-primary/10 border border-subtle text-muted-purple text-xs">
                <button
                  type="button"
                  onClick={() => setEditContent((prev) => prev + '\n**Bold text**')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-[#1E163B]"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditContent((prev) => prev + '\n*Italic text*')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-[#1E163B]"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditContent((prev) => prev + '\n```\n// Code block\n```')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-[#1E163B]"
                  title="Code snippet"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditContent((prev) => prev + '\n- Bullet point')}
                  className="p-1 rounded hover:bg-white dark:hover:bg-[#1E163B]"
                  title="Bullet list"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Note Content Textarea */}
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full text-xs sm:text-sm p-3 bg-transparent text-deep-purple dark:text-lavender-100 focus:outline-none resize-none leading-relaxed min-h-[300px] font-sans"
                placeholder="Write your detailed markdown notes..."
              />

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-subtle">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 text-xs flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                  {!editIsPrivate && selectedNote.shareCode && (
                    <button
                      onClick={handleCopyShareLink}
                      className="p-2 rounded-xl text-primary hover:bg-primary-subtle text-xs flex items-center gap-1 font-semibold"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Copy shared link</span>
                    </button>
                  )}
                  {copyStatus && <span role="status" className="text-[11px] text-muted-purple">{copyStatus}</span>}
                </div>

                <Button size="sm" pill onClick={handleSaveNote}>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
              {shareLink && selectedNote.shareCode && (
                <input
                  aria-label="Public note share link"
                  readOnly
                  value={shareLink}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full rounded-xl border border-subtle bg-white px-3 py-2 text-xs text-muted-purple"
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-purple">
              Select or create a study note to view.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
