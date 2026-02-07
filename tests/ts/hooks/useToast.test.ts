import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../../../packages/ui/src/hooks/useToast';

describe('useToast', () => {
  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('should add a success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success!', 'Operation completed');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].title).toBe('Success!');
    expect(result.current.toasts[0].message).toBe('Operation completed');
  });

  it('should add an error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Error!', 'Something went wrong');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].title).toBe('Error!');
    expect(result.current.toasts[0].message).toBe('Something went wrong');
  });

  it('should add a warning toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Warning!', 'Be careful');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('should add an info toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('Info', 'For your information');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Toast 1');
      result.current.error('Toast 2');
      result.current.info('Toast 3');
    });

    expect(result.current.toasts).toHaveLength(3);
  });

  it('should dismiss a toast by id', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string = '';
    act(() => {
      toastId = result.current.success('Toast 1');
      result.current.error('Toast 2');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.dismiss(toastId);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Toast 2');
  });

  it('should generate unique ids for toasts', () => {
    const { result } = renderHook(() => useToast());

    let id1: string = '';
    let id2: string = '';

    act(() => {
      id1 = result.current.success('Toast 1');
      id2 = result.current.success('Toast 2');
    });

    expect(id1).not.toBe(id2);
  });

  it('should allow custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Toast', undefined, 5000);
    });

    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('should use default duration when not specified', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Toast');
    });

    expect(result.current.toasts[0].duration).toBe(3000);
  });
});
