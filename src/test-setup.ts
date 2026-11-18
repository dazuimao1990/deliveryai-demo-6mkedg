import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  // 每个测试前重置 DOM 和 localStorage
  document.documentElement.className = ''
  localStorage.clear()
})
