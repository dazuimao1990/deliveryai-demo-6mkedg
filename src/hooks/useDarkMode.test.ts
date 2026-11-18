import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDarkMode } from '@/hooks/useDarkMode'

describe('useDarkMode', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    localStorage.clear()
  })

  describe('REQ-002.1: 首次访问默认浅色模式', () => {
    it('localStorage 无 dark-mode 键时默认为 false', () => {
      const { result } = renderHook(() => useDarkMode())
      expect(result.current.enabled).toBe(false)
    })

    it('首次访问时 html 元素无 dark class', () => {
      renderHook(() => useDarkMode())
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('REQ-002.2: 切换至暗色模式', () => {
    it('toggle 后 enabled 为 true', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => {
        result.current.toggle()
      })
      expect(result.current.enabled).toBe(true)
    })

    it('toggle 后 html 元素添加 dark class', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => {
        result.current.toggle()
      })
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('toggle 后 localStorage 中 dark-mode 为 "true"', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => {
        result.current.toggle()
      })
      expect(localStorage.getItem('dark-mode')).toBe('true')
    })
  })

  describe('REQ-001.3: 暗色切换回浅色', () => {
    it('二次 toggle 后 enabled 回到 false', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => result.current.toggle())
      expect(result.current.enabled).toBe(true)
      act(() => result.current.toggle())
      expect(result.current.enabled).toBe(false)
    })

    it('二次 toggle 后 html 元素移除 dark class', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => result.current.toggle())
      act(() => result.current.toggle())
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('二次 toggle 后 localStorage 中 dark-mode 为 "false"', () => {
      const { result } = renderHook(() => useDarkMode())
      act(() => result.current.toggle())
      act(() => result.current.toggle())
      expect(localStorage.getItem('dark-mode')).toBe('false')
    })
  })

  describe('REQ-002.3: 从 localStorage 恢复偏好', () => {
    it('localStorage 为 "true" 时初始状态为暗色', () => {
      localStorage.setItem('dark-mode', 'true')
      const { result } = renderHook(() => useDarkMode())
      expect(result.current.enabled).toBe(true)
    })

    it('localStorage 为 "true" 时 html 有 dark class（初始化即应用）', () => {
      localStorage.setItem('dark-mode', 'true')
      renderHook(() => useDarkMode())
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('localStorage 为 "false" 时初始状态为浅色', () => {
      localStorage.setItem('dark-mode', 'false')
      const { result } = renderHook(() => useDarkMode())
      expect(result.current.enabled).toBe(false)
    })

    it('localStorage 为 "false" 时 html 无 dark class', () => {
      localStorage.setItem('dark-mode', 'false')
      renderHook(() => useDarkMode())
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('localStorage 为无效值时默认浅色', () => {
      localStorage.setItem('dark-mode', 'invalid')
      const { result } = renderHook(() => useDarkMode())
      expect(result.current.enabled).toBe(false)
    })
  })

  describe('REQ-002.4: localStorage 不可用时降级', () => {
    it('localStorage 不可用时不抛出错误', () => {
      const original = window.localStorage
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      expect(() => renderHook(() => useDarkMode())).not.toThrow()

      vi.restoreAllMocks()
      Object.defineProperty(window, 'localStorage', { value: original, writable: true })
    })

    it('localStorage setItem 抛错时 toggle 仍正常切换内存态', () => {
      const { result } = renderHook(() => useDarkMode())
      // 模拟 localStorage.setItem 抛错
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('QuotaExceeded')
      })

      act(() => {
        result.current.toggle()
      })

      // 内存态已切换
      expect(result.current.enabled).toBe(true)
      // html class 已应用
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      Storage.prototype.setItem = originalSetItem
    })

    it('localStorage getItem 抛错时默认浅色不报错', () => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('SecurityError')
      })

      expect(() => {
        const { result } = renderHook(() => useDarkMode())
        expect(result.current.enabled).toBe(false)
      }).not.toThrow()

      Storage.prototype.getItem = originalGetItem
    })
  })

  describe('toggle 回调稳定性', () => {
    it('toggle 引用稳定（useCallback）', () => {
      const { result, rerender } = renderHook(() => useDarkMode())
      const firstToggle = result.current.toggle
      rerender()
      expect(result.current.toggle).toBe(firstToggle)
    })

    it('多次 toggle 正确循环切换', () => {
      const { result } = renderHook(() => useDarkMode())
      // false → true → false → true
      act(() => result.current.toggle())
      expect(result.current.enabled).toBe(true)
      act(() => result.current.toggle())
      expect(result.current.enabled).toBe(false)
      act(() => result.current.toggle())
      expect(result.current.enabled).toBe(true)
      expect(localStorage.getItem('dark-mode')).toBe('true')
    })
  })

  describe('html class 同步', () => {
    it('enabled 为 true 时 html 有 dark class', () => {
      localStorage.setItem('dark-mode', 'true')
      renderHook(() => useDarkMode())
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('从暗色 toggle 到浅色时 html 移除 dark class', () => {
      localStorage.setItem('dark-mode', 'true')
      const { result } = renderHook(() => useDarkMode())
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      act(() => result.current.toggle())
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})
