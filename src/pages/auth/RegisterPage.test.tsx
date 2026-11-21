import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../context/ThemeContext';
import { RegisterPage } from './RegisterPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ register: vi.fn(), authError: null }),
}));

describe('registration form', () => {
  it('uses a general-purpose email example', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <RegisterPage />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('example@gmail.com')).toBeInTheDocument();
  });
});
