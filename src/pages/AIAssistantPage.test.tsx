import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantPage } from './AIAssistantPage';
import { ThemeProvider } from '../context/ThemeContext';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const firstConversation = {
  id: 'conversation-1',
  title: 'First conversation',
  updatedAt: '2026-11-20T08:00:00.000Z',
};
const secondConversation = {
  id: 'conversation-2',
  title: 'Second conversation',
  updatedAt: '2026-11-20T09:00:00.000Z',
};
const newConversation = {
  id: 'conversation-3',
  title: 'Taskora study assistant',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  return render(
    <ThemeProvider>
      <AIAssistantPage />
    </ThemeProvider>
  );
}

describe('AI assistant conversation workflows', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.setItem('taskora_auth_token', 'test-token');
    sessionStorage.setItem('taskora_ai_conversation_id', firstConversation.id);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends through the assistant endpoint while preserving conversation and proposal workflows', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/ai/conversations' && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ conversations: [secondConversation, firstConversation] });
      }
      if (url.pathname === '/api/ai/conversations' && init?.method === 'POST') {
        return jsonResponse({ conversation: newConversation }, 201);
      }
      if (url.pathname === `/api/ai/conversations/${firstConversation.id}`) {
        return jsonResponse({
          conversation: {
            messages: [{
              id: 'first-message',
              role: 'USER',
              content: 'First saved message',
              createdAt: '2026-11-20T08:00:00.000Z',
            }],
            proposals: [],
          },
        });
      }
      if (url.pathname === `/api/ai/conversations/${secondConversation.id}`) {
        return jsonResponse({
          conversation: {
            messages: [{
              id: 'second-message',
              role: 'USER',
              content: 'Second saved message',
              createdAt: '2026-11-20T09:00:00.000Z',
            }],
            proposals: [],
          },
        });
      }
      if (url.pathname === '/api/ai/assistant' && init?.method === 'POST') {
        return jsonResponse({
          conversationId: secondConversation.id,
          userMessage: { id: 'saved-user-message', content: 'Plan my revision' },
          assistantMessage: {
            id: 'assistant-message',
            content: 'I saved a response for you.',
            createdAt: '2026-11-20T09:01:00.000Z',
          },
          proposals: [
            {
              id: 'proposal-approve',
              payload: { title: 'Review chapter one', priority: 'HIGH' },
              status: 'PENDING',
              createdAt: '2026-11-20T09:01:00.000Z',
            },
            {
              id: 'proposal-reject',
              payload: { title: 'Review chapter two', priority: 'LOW' },
              status: 'PENDING',
              createdAt: '2026-11-20T09:01:00.000Z',
            },
          ],
        }, 201);
      }
      if (url.pathname === '/api/ai/proposals/proposal-approve/approve') {
        return jsonResponse({
          proposal: {
            id: 'proposal-approve',
            payload: { title: 'Review chapter one', priority: 'HIGH' },
            status: 'APPROVED',
            createdAt: '2026-11-20T09:01:00.000Z',
          },
          task: {
            id: 'task-1',
            title: 'Review chapter one',
            description: null,
            category: 'Study',
            tags: [],
            subtasks: [],
            status: 'TODO',
            priority: 'HIGH',
            dueDate: null,
            createdAt: '2026-11-20T09:02:00.000Z',
            updatedAt: '2026-11-20T09:02:00.000Z',
          },
        });
      }
      if (url.pathname === '/api/ai/proposals/proposal-reject/reject') {
        return jsonResponse({
          proposal: {
            id: 'proposal-reject',
            payload: { title: 'Review chapter two', priority: 'LOW' },
            status: 'REJECTED',
            createdAt: '2026-11-20T09:01:00.000Z',
          },
        });
      }
      throw new Error(`Unexpected API request: ${init?.method || 'GET'} ${url.pathname}`);
    });

    renderPage();
    expect(await screen.findByText('First saved message')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Saved conversations' }), {
      target: { value: secondConversation.id },
    });
    expect(await screen.findByText('Second saved message')).toBeInTheDocument();
    expect(screen.queryByText('First saved message')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Plan my revision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('I saved a response for you.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve & Save Tasks' })[0]);
    expect(await screen.findByText('Approved & Saved')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    expect(await screen.findByText('Rejected')).toBeInTheDocument();

    expect(fetchMock.mock.calls.filter(([input, init]) =>
      new URL(String(input)).pathname === '/api/ai/conversations' && init?.method === 'POST'
    )).toHaveLength(0);

    const sentCall = fetchMock.mock.calls.find(([input, init]) =>
      new URL(String(input)).pathname === '/api/ai/assistant' && init?.method === 'POST'
    );
    expect(sentCall).toBeDefined();
    expect(JSON.parse(String(sentCall?.[1]?.body))).toEqual({
      message: 'Plan my revision',
      conversationId: secondConversation.id,
    });
    expect(sessionStorage.getItem('taskora_ai_conversation_id')).toBe(secondConversation.id);

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Saved conversations' })).toHaveValue(newConversation.id);
    });
    expect(sessionStorage.getItem('taskora_ai_conversation_id')).toBe(newConversation.id);
    expect(screen.queryByText('I saved a response for you.')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input, init]) =>
      new URL(String(input)).pathname === '/api/ai/conversations' && init?.method === 'POST'
    )).toHaveLength(1);
  });

  it('shows an API error and preserves the draft when sending fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === `/api/ai/conversations/${firstConversation.id}`) {
        return jsonResponse({ conversation: { messages: [], proposals: [] } });
      }
      if (url.pathname === '/api/ai/conversations' && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ conversations: [firstConversation] });
      }
      if (url.pathname === '/api/ai/assistant' && init?.method === 'POST') {
        return jsonResponse({ error: 'AI service is not configured' }, 503);
      }
      throw new Error(`Unexpected API request: ${init?.method || 'GET'} ${url.pathname}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The AI provider is unavailable (503). Please try again later.'
    );
    expect(screen.getByRole('textbox')).toHaveValue('Help me plan');
    expect(screen.queryByText('Help me plan')).not.toBeInTheDocument();
  });

  it('shows a loading indicator until the assistant endpoint responds', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === `/api/ai/conversations/${firstConversation.id}`) {
        return jsonResponse({ conversation: { messages: [], proposals: [] } });
      }
      if (url.pathname === '/api/ai/conversations') {
        return jsonResponse({ conversations: [firstConversation] });
      }
      if (url.pathname === '/api/ai/assistant' && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        });
      }
      throw new Error(`Unexpected API request: ${init?.method || 'GET'} ${url.pathname}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me focus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Taskora AI is preparing a response...'
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await act(async () => {
      resolveResponse?.(jsonResponse({
        conversationId: firstConversation.id,
        assistantMessage: {
          id: 'assistant-message',
          content: 'Try one small step at a time.',
          createdAt: '2026-11-20T09:01:00.000Z',
        },
        proposals: [],
      }, 201));
    });
    expect(await screen.findByText('Try one small step at a time.')).toBeInTheDocument();
  });

  it('shows a clear timeout message when the AI provider returns 504', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === `/api/ai/conversations/${firstConversation.id}`) {
        return jsonResponse({ conversation: { messages: [], proposals: [] } });
      }
      if (url.pathname === '/api/ai/conversations') {
        return jsonResponse({ conversations: [firstConversation] });
      }
      if (url.pathname === '/api/ai/assistant' && init?.method === 'POST') {
        return jsonResponse({ error: 'AI response timed out' }, 504);
      }
      throw new Error(`Unexpected API request: ${init?.method || 'GET'} ${url.pathname}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Help me focus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The AI provider timed out (504). Please try again.'
    );
    expect(screen.getByRole('textbox')).toHaveValue('Help me focus');
  });

  it('keeps the previous conversation selected when loading another one fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === `/api/ai/conversations/${firstConversation.id}`) {
        return jsonResponse({
          conversation: {
            messages: [{
              id: 'first-message',
              role: 'USER',
              content: 'Previous conversation remains visible',
              createdAt: '2026-11-20T08:00:00.000Z',
            }],
            proposals: [],
          },
        });
      }
      if (url.pathname === `/api/ai/conversations/${secondConversation.id}`) {
        return jsonResponse({ error: 'Conversation temporarily unavailable' }, 503);
      }
      if (url.pathname === '/api/ai/conversations') {
        return jsonResponse({ conversations: [firstConversation, secondConversation] });
      }
      throw new Error(`Unexpected API request: ${init?.method || 'GET'} ${url.pathname}`);
    });

    renderPage();
    expect(await screen.findByText('Previous conversation remains visible')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Saved conversations' }), {
      target: { value: secondConversation.id },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Conversation temporarily unavailable');
    expect(screen.getByRole('combobox', { name: 'Saved conversations' })).toHaveValue(firstConversation.id);
    expect(sessionStorage.getItem('taskora_ai_conversation_id')).toBe(firstConversation.id);
    expect(screen.getByText('Previous conversation remains visible')).toBeInTheDocument();
  });
});
