import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { notesApi } from '../lib/api/client';
import { StudyNote } from '../types';
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
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);

  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(true);

  const fetchNotes = async () => {
    const data = await notesApi.getNotes();
    setNotes(data);
    if (data.length > 0 && !selectedNote) {
      selectNote(data[0]);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const selectNote = (note: StudyNote) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditIsPrivate(note.isPrivate);
  };

  const handleSaveNote = async () => {
    if (!selectedNote || !editTitle.trim()) return;

    const saved = await notesApi.saveNote({
      ...selectedNote,
      title: editTitle,
      content: editContent,
      isPrivate: editIsPrivate,
    });

    setNotes((prev) => prev.map((n) => (n.id === saved.id ? saved : n)));
    setSelectedNote(saved);
    alert('Note saved successfully!');
  };

  const handleCreateNewNote = async () => {
    const newNote = await notesApi.saveNote({
      title: 'Untitled Study Note',
      subjectId: activeSubject === 'all' ? 'sub_cs301' : activeSubject,
      subjectName: activeSubject === 'all' ? 'Distributed Systems' : activeSubject,
      content: 'Start writing your lecture summary or revision notes here...',
      tags: ['Revision'],
      isPrivate: true, // Default private per FR-10
    });

    setNotes([newNote, ...notes]);
    selectNote(newNote);
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Delete this note?')) {
      await notesApi.deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (remaining.length > 0) selectNote(remaining[0]);
      else setSelectedNote(null);
    }
  };

  const subjects = [
    { id: 'all', name: 'All Subjects' },
    { id: 'Distributed Systems', name: 'Distributed Systems' },
    { id: 'Interaction Design', name: 'Interaction Design' },
    { id: 'Discrete Mathematics', name: 'Discrete Mathematics' },
  ];

  const filteredNotes = notes.filter(
    (n) => activeSubject === 'all' || n.subjectName === activeSubject
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white flex items-center gap-2">
            <span>Study Workspace & Notes</span>
            <Badge variant="primary">FR-10 Private by Default</Badge>
          </h2>
          <p className="text-xs text-muted-purple mt-0.5">
            Create structured subject notes. Notes remain completely private unless you toggle explicit sharing.
          </p>
        </div>

        <Button variant="primary" size="sm" pill onClick={handleCreateNewNote}>
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

                {/* Explicit Share Toggle (FR-10) */}
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
                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 text-xs flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>

                <Button size="sm" pill onClick={handleSaveNote}>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
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
