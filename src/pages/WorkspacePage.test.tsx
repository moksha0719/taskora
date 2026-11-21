import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from './WorkspacePage';
import type { ApiStudyPlan, StudyNote } from '../types';

const api = vi.hoisted(() => ({
  getNotes: vi.fn(),
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
  getPlans: vi.fn(),
}));

vi.mock('../lib/api/client', () => ({
  notesApi: {
    getNotes: api.getNotes,
    saveNote: api.saveNote,
    deleteNote: api.deleteNote,
  },
  studyPlansApi: { getPlans: api.getPlans },
}));

const studyPlan: ApiStudyPlan = {
  id: 'plan-1',
  userId: 'user-1',
  activeUserId: null,
  title: 'Current plan',
  status: 'ACTIVE',
  startDate: '2026-11-01',
  endDate: '2026-12-01',
  nextSessionDate: null,
  timeZone: 'UTC',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 5,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  subjects: [{
    id: 'subject-1',
    planId: 'plan-1',
    name: 'Algorithms',
    code: 'ALG',
    color: '#9885E8',
    targetMinutesPerWeek: 300,
  }],
};

function makeNote(overrides: Partial<StudyNote> = {}): StudyNote {
  return {
    id: 'note-1',
    userId: 'user-1',
    subjectId: 'subject-1',
    subjectName: 'Algorithms',
    title: 'Untitled Study Note',
    content: 'Start writing your lecture summary or revision notes here...',
    tags: ['Revision'],
    isPrivate: true,
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('WorkspacePage subjects', () => {
  beforeEach(() => {
    api.getNotes.mockReset().mockResolvedValue([]);
    api.saveNote.mockReset().mockImplementation(async (note) => makeNote(note));
    api.deleteNote.mockReset();
    api.getPlans.mockReset().mockResolvedValue([]);
  });

  it('uses the authenticated user’s Study Planner subjects for filtering and new notes', async () => {
    api.getPlans.mockResolvedValue([studyPlan]);
    render(<WorkspacePage />);

    const subjectButton = await screen.findByRole('button', { name: /Algorithms/ });
    fireEvent.click(subjectButton);
    fireEvent.click(screen.getByRole('button', { name: 'New Note' }));

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledWith(expect.objectContaining({
      subjectId: 'subject-1',
      subjectName: 'Algorithms',
    })));
  });

  it('uses the generic General subject when the user has no planned subjects', async () => {
    render(<WorkspacePage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Note' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'New Note' }));

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledWith(expect.objectContaining({
      subjectId: 'sub_general',
      subjectName: 'General',
    })));
  });
});
