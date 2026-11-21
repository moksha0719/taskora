import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('analytics loading states', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.setItem('taskora_auth_token', 'test-token');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows note-only analytics instead of incorrectly reporting an empty period', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      analytics: {
        taskCounts: { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0 },
        focusMinutes: 0,
        xpEarned: 0,
        habitCheckIns: 0,
        noteCount: 3,
        focusByDay: {},
        subjectDistribution: {},
      },
    }));

    render(<AnalyticsPage />);

    expect(await screen.findByText('Notes Created')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('No analytics data is available for this period.')).not.toBeInTheDocument();
  });

  it('shows the request failure without rendering stale zero-valued analytics', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Analytics unavailable' }, 503));

    render(<AnalyticsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable');
    expect(screen.queryByText('Tasks Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('No analytics data is available for this period.')).not.toBeInTheDocument();
  });
});
