import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AIAssistantWidget } from './AIAssistantWidget';

const AssistantTarget = () => {
  const location = useLocation();
  const state = location.state as { initialPrompt?: string } | null;
  return <p>{state?.initialPrompt}</p>;
};

describe('AIAssistantWidget', () => {
  it('redirects to the assistant with the entered prompt', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AIAssistantWidget />} />
          <Route path="/ai-assistant" element={<AssistantTarget />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Ask AI' }), {
      target: { value: 'Plan my revision' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(await screen.findByText('Plan my revision')).toBeInTheDocument();
  });
});
