import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { notesApi } from '../lib/api/client';

type SharedNote = Awaited<ReturnType<typeof notesApi.getSharedNote>>;

export const SharedNotePage: React.FC = () => {
  const { shareCode = '' } = useParams();
  const [note, setNote] = useState<SharedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setNote(null);
    setError(null);
    setLoading(true);
    notesApi.getSharedNote(shareCode).then((sharedNote) => {
      if (active) setNote(sharedNote);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'This shared note is unavailable.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [shareCode]);

  return (
    <main className="min-h-screen bg-dream-bg dark:bg-[#130E26] p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm font-bold text-primary">Taskora shared note</p>
        {loading && <Card className="p-6 text-sm text-muted-purple">Loading note...</Card>}
        {error && <Card role="alert" className="p-6 text-sm text-rose-600">{error}</Card>}
        {!loading && !error && note && (
          <Card className="p-6 sm:p-8 space-y-4">
            <header>
              <h1 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">{note.title}</h1>
              {note.subjectName && <p className="mt-1 text-sm text-muted-purple">{note.subjectName}</p>}
            </header>
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-deep-purple dark:text-lavender-100">
              {note.content}
            </div>
            {note.tags.length > 0 && (
              <p className="border-t border-subtle pt-3 text-xs text-muted-purple">
                Tags: {note.tags.join(', ')}
              </p>
            )}
          </Card>
        )}
      </div>
    </main>
  );
};
