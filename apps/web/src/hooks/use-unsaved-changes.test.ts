import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnsavedChanges } from './use-unsaved-changes';

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers and unregisters listeners only when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = renderHook(({ dirty }: { dirty: boolean }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: false },
    });

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ dirty: true });

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('sets beforeunload returnValue when dirty', () => {
    renderHook(() => useUnsavedChanges(true));

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', {
      writable: true,
      value: undefined,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe('');
  });

  it('blocks in-app link navigation when user cancels', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHook(() => useUnsavedChanges(true));

    const anchor = document.createElement('a');
    anchor.href = '/balances';
    document.body.appendChild(anchor);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const allowed = anchor.dispatchEvent(event);

    expect(confirmSpy).toHaveBeenCalled();
    expect(allowed).toBe(false);
  });

  it('moves back forward again when user cancels browser back navigation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    renderHook(() => useUnsavedChanges(true));

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(goSpy).toHaveBeenCalledWith(1);
  });

  it('allows browser back navigation when user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {});
    renderHook(() => useUnsavedChanges(true));

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(goSpy).not.toHaveBeenCalled();
  });
});


