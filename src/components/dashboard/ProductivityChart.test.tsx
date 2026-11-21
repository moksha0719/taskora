import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductivityChart } from './ProductivityChart';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ProductivityChart', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.setItem('taskora_auth_token', 'test-token');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows an empty state when the account has no focus sessions', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      analytics: {
        taskCounts: {},
        focusMinutes: 0,
        xpEarned: 0,
        habitCheckIns: 0,
        noteCount: 0,
        focusByDay: {},
        subjectDistribution: {},
      },
    }));
    render(<ProductivityChart />);

    expect(await screen.findByText('No focus sessions recorded for this period.')).toBeInTheDocument();
  });

  it('surfaces analytics loading errors with a retry action', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Analytics unavailable' }, 503));
    render(<ProductivityChart />);

    expect(await screen.findByText('Analytics unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
