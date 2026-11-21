import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiApi, analyticsApi, authApi, flashcardsApi, focusApi, roomsApi, STUDY_PLANS_UPDATED_EVENT, studyPlansApi, tasksApi } from './client';
import type {
  ApiStudyPlan,
  StudyCompletion,
  StudyPlanInput,
  StudySchedulePreviewItem,
} from '../../types';

const planInput: StudyPlanInput = {
  title: 'Calendar refresh test',
  startDate: '2026-11-17',
  endDate: '2026-12-17',
  timeZone: 'Asia/Colombo',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 4,
  subjects: [{ name: 'Mathematics', targetMinutesPerWeek: 600 }],
};

const plan: ApiStudyPlan = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  activeUserId: null,
  title: 'Calendar refresh test',
  status: 'DRAFT',
  startDate: '2026-11-17',
  endDate: '2026-12-17',
  nextSessionDate: null,
  timeZone: 'Asia/Colombo',
  weeklyTargetMinutes: 600,
  studyDaysPerWeek: 4,
  createdAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
  subjects: [],
};

describe('study plan calendar refresh notifications', () => {
  const onUpdated = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.setItem('taskora_auth_token', 'test-token');
    window.addEventListener(STUDY_PLANS_UPDATED_EVENT, onUpdated);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('AI conversation persistence', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      sessionStorage.setItem('taskora_auth_token', 'test-token');
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      sessionStorage.clear();
      vi.unstubAllGlobals();
      vi.clearAllMocks();
    });

    it('restores persisted messages and proposals from the active conversation', async () => {
      sessionStorage.setItem('taskora_ai_conversation_id', 'conversation-1');
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        conversation: {
          messages: [
            { id: 'message-1', role: 'USER', content: 'Help me study', createdAt: '2026-11-20T08:00:00.000Z' },
            { id: 'message-2', role: 'ASSISTANT', content: 'Here is a plan.', createdAt: '2026-11-20T08:01:00.000Z' },
          ],
          proposals: [{
            id: 'proposal-1',
            payload: { title: 'Review notes', description: 'Read chapter one', priority: 'HIGH' },
            status: 'PENDING',
            createdAt: '2026-11-20T08:01:00.000Z',
          }],
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const messages = await aiApi.loadConversation();

      expect(messages).toHaveLength(3);
      expect(messages[0]).toMatchObject({ id: 'message-1', sender: 'user', content: 'Help me study' });
      expect(messages[1]).toMatchObject({ id: 'message-2', sender: 'assistant', content: 'Here is a plan.' });
      expect(messages[2].proposal).toMatchObject({
        id: 'proposal-1',
        status: 'pending',
        items: [{ title: 'Review notes', priority: 'high' }],
      });
      expect(fetchMock.mock.calls[0][0]).toContain('/api/ai/conversations/conversation-1');
    });

    it('replaces a stale active conversation with the latest owned conversation', async () => {
      sessionStorage.setItem('taskora_ai_conversation_id', 'deleted-conversation');
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          conversations: [{ id: 'latest-conversation' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          conversation: { messages: [], proposals: [] },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      await expect(aiApi.loadConversation()).resolves.toEqual([]);

      expect(sessionStorage.getItem('taskora_ai_conversation_id')).toBe('latest-conversation');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('keeps assistant text responses even when no task proposal is returned', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({
          conversation: { id: 'conversation-2' },
        }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          assistantMessage: {
            id: 'assistant-message-1',
            content: 'Here are some study tips.',
            createdAt: '2026-11-20T08:02:00.000Z',
          },
          proposals: [],
        }), { status: 201, headers: { 'Content-Type': 'application/json' } }));

      await expect(aiApi.generateProposal('Give me study tips')).resolves.toMatchObject({
        response: 'Here are some study tips.',
        assistantMessageId: 'assistant-message-1',
        proposals: [],
      });
      expect(sessionStorage.getItem('taskora_ai_conversation_id')).toBe('conversation-2');
    });
  });

  afterEach(() => {
    window.removeEventListener(STUDY_PLANS_UPDATED_EVENT, onUpdated);
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('notifies mounted calendar views after successful create, update, and delete requests', async () => {
    const successResponse = () => new Response(JSON.stringify({ studyPlan: plan }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ studyPlan: plan }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await studyPlansApi.createPlan(planInput);
    await studyPlansApi.updatePlan(plan.id, planInput);
    await studyPlansApi.deletePlan(plan.id);

    expect(onUpdated).toHaveBeenCalledTimes(3);
  });

  it('does not notify calendar views when a plan mutation fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(studyPlansApi.createPlan(planInput)).rejects.toThrow('Request failed');
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('loads completion history for the requested civil-date range', async () => {
    const completion: StudyCompletion = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      scheduleItemId: '550e8400-e29b-41d4-a716-446655440003',
      occurrenceDate: '2026-11-17',
      completed: true,
      completedAt: '2026-11-17T12:00:00.000Z',
      actualDurationMinutes: 45,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ completions: [completion] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(studyPlansApi.getCompletions(plan.id, '2026-11-17', '2026-11-18'))
      .resolves.toEqual([completion]);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `/api/study-plans/${plan.id}/completions?from=2026-11-17&to=2026-11-18`
    );
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('saves a generated schedule to its plan and notifies calendar views', async () => {
    const schedule: StudySchedulePreviewItem[] = [{
      subjectId: '550e8400-e29b-41d4-a716-446655440004',
      subjectName: 'Mathematics',
      dayOfWeek: 'MON',
      startMinuteOfDay: 540,
      durationMinutes: 60,
      kind: 'STUDY',
    }];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ studyPlan: plan }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(studyPlansApi.saveSchedule(plan.id, schedule)).resolves.toEqual(plan);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/study-plans/${plan.id}/schedule`);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body as string)).toEqual({ schedule });
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('reports a useful error when an API route returns an HTML error page', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<!doctype html><title>Not Found</title>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    }));

    await expect(studyPlansApi.getPlans()).rejects.toThrow(
      'The API returned a non-JSON error response (HTTP 404). Check VITE_API_BASE_URL and verify that the backend endpoint is available.'
    );
  });

  it('requests a generic password reset response without revealing account existence', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'If an account exists for that email, password reset instructions will be sent if email delivery is configured.',
    }), { status: 202, headers: { 'Content-Type': 'application/json' } }));

    await expect(authApi.forgotPassword('student@example.com')).resolves.toContain(
      'If an account exists'
    );
  });

  it('submits the reset token and new password to the password reset endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'Password reset successfully',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(authApi.resetPassword('opaque-token', 'new-password')).resolves.toBe(
      'Password reset successfully'
    );
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/reset-password');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      token: 'opaque-token',
      password: 'new-password',
    });
  });

  it('loads analytics for the selected period', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      analytics: {
        taskCounts: { TODO: 2, IN_PROGRESS: 1, COMPLETED: 4 },
        focusMinutes: 90,
        xpEarned: 150,
        habitCheckIns: 3,
        noteCount: 2,
        focusByDay: { '2026-11-18': 90 },
        subjectDistribution: { Mathematics: 90 },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(analyticsApi.getAnalytics('30d')).resolves.toMatchObject({ focusMinutes: 90 });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/analytics?period=30d');
  });

  it('creates tasks without trusting or sending a client-supplied owner ID', async () => {
    const task = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Review notes',
      description: null,
      category: 'Study',
      tags: [],
      subtasks: [],
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: null,
      createdAt: '2026-11-20T08:00:00.000Z',
      updatedAt: '2026-11-20T08:00:00.000Z',
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ task }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(tasksApi.createTask({
      title: 'Review notes',
      dueDate: '',
      priority: 'medium',
      status: 'todo',
      category: 'Study',
      tags: [],
      subtasks: [],
    })).resolves.toMatchObject({ id: task.id, userId: task.userId });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/tasks');
    expect(JSON.parse(String(options.body))).not.toHaveProperty('userId');
  });

  it('maps actual participant and message authors from study-room responses', async () => {
    const user = { id: 'participant-1', name: 'Current user', avatar: null };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      rooms: [{
        id: 'room-1',
        name: 'Study group',
        topic: 'Revision',
        isPrivate: false,
        maxParticipants: 8,
        participants: [{ userId: user.id, user, status: 'focusing', joinedAt: '2026-11-20T08:00:00.000Z' }],
        messages: [{ id: 'message-1', userId: user.id, user, content: 'Ready to start', createdAt: '2026-11-20T08:00:00.000Z' }],
        focusDurationMinutes: 25,
        breakDurationMinutes: 5,
        currentMode: 'FOCUS',
        timerRemainingSeconds: 900,
        createdAt: '2026-11-20T08:00:00.000Z',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(roomsApi.getRooms()).resolves.toMatchObject([{
      participants: [{ name: 'Current user' }],
      messages: [{ userName: 'Current user' }],
    }]);
  });

  it('uploads profile photos as image bytes and stores the backend avatar URL', async () => {
    localStorage.setItem('taskora_current_user', JSON.stringify({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Alex Doe',
      email: 'alex@example.com',
      role: 'student',
      avatar: 'https://example.test/old-avatar.png',
      joinedAt: '2026-11-20T08:00:00.000Z',
    }));
    const avatar = '/uploads/profile-photos/user-photo.png';
    const file = new File(['image bytes'], 'profile.png', { type: 'image/png' });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Alex Doe',
        email: 'alex@example.com',
        role: 'STUDENT',
        avatar,
        bio: null,
        major: null,
        createdAt: '2026-11-20T08:00:00.000Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(authApi.uploadProfilePhoto(file)).resolves.toMatchObject({
      avatar: `http://localhost:5000${avatar}`,
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/profile/avatar');
    expect(options.method).toBe('PUT');
    expect(new Headers(options.headers).get('Content-Type')).toBe('image/png');
    expect(options.body).toBe(file);
    expect(JSON.parse(localStorage.getItem('taskora_current_user') || '{}').avatar)
      .toBe(`http://localhost:5000${avatar}`);
  });

  it('starts and completes a focus session using the server-issued token', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessionToken: 'signed-session-token' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          subject: 'Mathematics',
          durationMinutes: 25,
          notes: null,
          xpEarned: 63,
          completedAt: '2026-11-20T08:25:00.000Z',
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }));

    const token = await focusApi.startSession('Mathematics', 25);
    expect(token).toBe('signed-session-token');
    const [, startOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(startOptions.body))).toEqual({
      subject: 'Mathematics',
      durationMinutes: 25,
    });

    await expect(focusApi.completeSession(token)).resolves.toMatchObject({
      subject: 'Mathematics',
      durationMinutes: 25,
      xpEarned: 63,
    });
    const [completionUrl, completionOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(completionUrl).toContain('/api/focus/sessions');
    expect(JSON.parse(String(completionOptions.body))).toEqual({ sessionToken: token });
  });

  it('loads today focus totals from the authenticated daily summary endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      date: '2026-11-21',
      timeZone: 'Asia/Colombo',
      totalFocusMinutes: 45,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(focusApi.getTodaySummary()).resolves.toEqual({
      date: '2026-11-21',
      timeZone: 'Asia/Colombo',
      totalFocusMinutes: 45,
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/focus-sessions/today');
    expect(new URL(url).searchParams.get('timeZone'))
      .toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('sends assistant messages through the authenticated assistant endpoint', async () => {
    sessionStorage.setItem('taskora_ai_conversation_id', 'conversation-1');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      conversationId: 'conversation-1',
      assistantMessage: {
        id: 'assistant-1',
        content: 'Break the work into three manageable steps.',
        createdAt: '2026-11-21T08:00:00.000Z',
      },
      proposals: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(aiApi.generateAssistantResponse('Help me plan')).resolves.toMatchObject({
      response: 'Break the work into three manageable steps.',
      assistantMessageId: 'assistant-1',
      proposals: [],
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/ai/assistant');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({
      message: 'Help me plan',
      conversationId: 'conversation-1',
    });
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
  });

  it('creates decks and cards and submits reviews through the flashcard API', async () => {
    const savedCard = {
      id: 'card-1',
      deckId: 'deck-1',
      front: 'Question',
      back: 'Answer',
      position: 0,
      repetitions: 0,
      intervalDays: 0,
      easeFactor: 2.5,
      reviewCount: 0,
      dueAt: '2026-11-21T00:00:00.000Z',
      lastReviewedAt: null,
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z',
    };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        deck: {
          id: 'deck-1',
          userId: 'user-1',
          title: 'Biology',
          description: null,
          createdAt: '2026-11-21T00:00:00.000Z',
          updatedAt: '2026-11-21T00:00:00.000Z',
        },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ card: savedCard }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        card: {
          ...savedCard,
          repetitions: 1,
          intervalDays: 1,
          reviewCount: 1,
          dueAt: '2026-11-22T00:00:00.000Z',
          lastReviewedAt: '2026-11-21T00:00:00.000Z',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(flashcardsApi.createDeck({ title: 'Biology' })).resolves.toMatchObject({
      id: 'deck-1',
      cardCount: 0,
    });
    await expect(flashcardsApi.createCard('deck-1', {
      front: 'Question',
      back: 'Answer',
    })).resolves.toMatchObject({ id: 'card-1' });
    await expect(flashcardsApi.reviewCard('card-1', 4)).resolves.toMatchObject({
      intervalDays: 1,
      dueAt: '2026-11-22T00:00:00.000Z',
    });

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/flashcards/decks',
      '/api/flashcards/decks/deck-1/cards',
      '/api/flashcards/cards/card-1/review',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ title: 'Biology' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      front: 'Question',
      back: 'Answer',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({ quality: 4 });
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization'))
      .toBe('Bearer test-token');
  });

  it('loads calendar plans from the backend with the server-computed next session date', async () => {
    const calendarPlan = { ...plan, nextSessionDate: '2026-11-24' };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        studyPlans: [{ id: calendarPlan.id }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        studyPlan: calendarPlan,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(studyPlansApi.getCalendarPlans()).resolves.toEqual([calendarPlan]);

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/study-plans',
      `/api/study-plans/${calendarPlan.id}`,
    ]);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization'))
      .toBe('Bearer test-token');
  });
});
