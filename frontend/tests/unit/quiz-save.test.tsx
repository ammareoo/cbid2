import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { AttemptView, QuizQuestion } from '../../src/api/types';
import QuizAttempt from '../../src/pages/student/QuizAttempt';
import { ToastProvider } from '../../src/components/Toast';

function showAttempt(kind: QuizQuestion['kind']) {
  const attempt: AttemptView = {
    attempt: { id: 'a1', quizId: 'quiz1', courseId: 'course1', quizTitle: 'Saving answers', description: '', attemptNo: 1,
      status: 'in_progress', startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + 3600_000).toISOString(),
      submittedAt: null, score: null, maxScore: 1, serverNow: new Date().toISOString() },
    questions: [{ id: 'q1', kind, prompt: 'Choose an answer', points: 1, position: 0,
      options: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }] }], isOwner: true,
  };
  vi.spyOn(api, 'get').mockResolvedValue(attempt);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/attempts/a1']}><ToastProvider>
    <Routes><Route path="/attempts/:attemptId" element={<QuizAttempt />} /></Routes>
  </ToastProvider></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
});
afterEach(() => vi.restoreAllMocks());

describe('quiz answer persistence', () => {
  it('blocks submit immediately while a typed answer is waiting for its debounce', async () => {
    const save = vi.spyOn(api, 'put').mockResolvedValue({});
    showAttempt('short');
    const input = await screen.findByLabelText('Your answer');
    fireEvent.change(input, { target: { value: 'Inclusive practice' } });
    expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
    await waitFor(() => expect(save).toHaveBeenCalledWith('/attempts/a1/answers/q1', { textAnswer: 'Inclusive practice' }), { timeout: 2000 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeEnabled());
  });

  it('sends rapid selections in order and waits for the newest response before allowing submit', async () => {
    let finishFirst!: (value: unknown) => void;
    let finishSecond!: (value: unknown) => void;
    const save = vi.spyOn(api, 'put')
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishSecond = resolve; }));
    showAttempt('single');
    await userEvent.click(await screen.findByLabelText('First'));
    await userEvent.click(screen.getByLabelText('Second'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeDisabled();
    await act(async () => finishFirst({}));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenNthCalledWith(2, '/attempts/a1/answers/q1', { selectedOptionIds: ['second'] });
    expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeDisabled();
    await act(async () => finishSecond({}));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeEnabled());
  });

  it('keeps submit blocked after a failed save and lets the learner retry their current answer', async () => {
    const save = vi.spyOn(api, 'put').mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({});
    showAttempt('single');
    await userEvent.click(await screen.findByLabelText('Second'));
    const retry = await screen.findByRole('button', { name: 'Retry saving this answer' });
    expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeDisabled();
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit quiz' })).toBeEnabled());
    expect(save).toHaveBeenLastCalledWith('/attempts/a1/answers/q1', { selectedOptionIds: ['second'] });
  });
});
