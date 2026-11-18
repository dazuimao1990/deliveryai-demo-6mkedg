import { test, expect, type Page } from '@playwright/test'

/** 从首页绑定 A08 桌台并进入点餐视图（menu），此时 TopBar 可见。 */
async function enterMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click() // home → welcome
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click() // welcome → menu
}

test.describe('黑夜模式（Dark Mode） - E2E 验收测试', () => {
  test.beforeEach(async ({ page }) => {
    // 确保每个用例开始时为浅色模式
    await page.goto('/')
    await page.evaluate(() => {
      try { localStorage.removeItem('dark-mode') } catch { /* noop */ }
    })
    await page.reload()
  })

  test('REQ-001.1: TopBar 存在黑夜模式切换按钮（aria-label）', async ({ page }) => {
    await enterMenu(page)
    const darkToggle = page.getByRole('button', { name: '切换黑夜模式' })
    await expect(darkToggle).toBeVisible()
  })

  test('REQ-001.2: 浅色模式点击切换按钮后进入暗色模式', async ({ page }) => {
    await enterMenu(page)
    const darkToggle = page.getByRole('button', { name: '切换黑夜模式' })
    await darkToggle.click()
    // html 元素应有 dark class
    await expect(page.locator('html')).toHaveClass(/dark/)
    // localStorage 中 dark-mode 为 'true'
    const stored = await page.evaluate(() => localStorage.getItem('dark-mode'))
    expect(stored).toBe('true')
  })

  test('REQ-001.3: 暗色模式点击切换按钮后回到浅色模式', async ({ page }) => {
    await enterMenu(page)
    const darkToggle = page.getByRole('button', { name: '切换黑夜模式' })
    // 先切到暗色
    await darkToggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 再切回浅色
    await darkToggle.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const stored = await page.evaluate(() => localStorage.getItem('dark-mode'))
    expect(stored).toBe('false')
  })

  test('REQ-001.4: 按钮图标随主题切换（浅色 Moon → 暗色 Sun）', async ({ page }) => {
    await enterMenu(page)
    const darkToggle = page.getByRole('button', { name: '切换黑夜模式' })
    // 浅色模式：Moon 图标可见（lucide-react Moon）
    await expect(darkToggle.locator('svg.lucide-moon')).toBeVisible()
    // 切换到暗色
    await darkToggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 暗色模式：Sun 图标可见
    await expect(darkToggle.locator('svg.lucide-sun')).toBeVisible()
  })

  test('REQ-001.5: 英文环境下按钮 aria-label 为 "Toggle dark mode"', async ({ page }) => {
    await enterMenu(page)
    // 切换到英文
    await page.getByRole('button', { name: '切换语言' }).click()
    const darkToggle = page.getByRole('button', { name: 'Toggle dark mode' })
    await expect(darkToggle).toBeVisible()
  })

  test('REQ-002.1: 首次访问默认浅色模式，html 无 dark class', async ({ page }) => {
    await enterMenu(page)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('REQ-002.2: 切换至暗色后 html 有 dark class 且 localStorage 为 true', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    const stored = await page.evaluate(() => localStorage.getItem('dark-mode'))
    expect(stored).toBe('true')
  })

  test('REQ-003.1: 暗色偏好已存储时刷新页面首屏直接暗色无闪烁', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 刷新页面，检查 html 在页面加载后立即有 dark class（不依赖 React 挂载）
    await page.reload()
    // reload 后立即检查 html class（FOUC 防护应在 React 前生效）
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('REQ-003.2: 无暗色偏好时刷新页面首屏为浅色', async ({ page }) => {
    await enterMenu(page)
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('REQ-004.1: tailwind darkMode 配置为 class 模式且暗色类名生效', async ({ page }) => {
    await enterMenu(page)
    // 切换到暗色模式
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 检查根容器有 dark:bg-dark-bg 样式
    const rootDiv = page.locator('div.min-h-screen')
    const bgClass = await rootDiv.evaluate((el) => el.className)
    expect(bgClass).toContain('dark:bg-dark-bg')
  })

  test('REQ-005: 全视图暗色无大面积浅色残留', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Menu 视图：菜品卡片背景为深色
    const menuArticle = page.locator('article').first()
    const menuClass = await menuArticle.evaluate((el) => el.className)
    expect(menuClass).toContain('dark:bg-dark-surface')

    // 切换到 order 视图
    await page.getByRole('button', { name: /订单|Orders/ }).first().click()
    await expect(page).toHaveURL(/#\/order$/)
    // order 页面可见
    const orderMain = page.locator('main')
    await expect(orderMain).toBeVisible()

    // 切换到 checkout 视图（深链接）
    await page.goto('/#/checkout')
    await expect(page).toHaveURL(/#\/checkout$/)
    // checkout 页面卡片有暗色样式
    const checkoutSection = page.locator('section').first()
    const checkoutClass = await checkoutSection.evaluate((el) => el.className)
    expect(checkoutClass).toContain('dark:bg-dark-surface')
  })

  test('REQ-005: ServiceSheet 弹窗暗色适配', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    // 打开服务弹窗（移动端底部导航）
    await page.setViewportSize({ width: 390, height: 844 })
    const serviceBtn = page.getByRole('button', { name: /服务|Service/ }).first()
    await serviceBtn.click()
    // 弹窗打开，[role="dialog"] 是 Radix DialogContent 渲染的元素，包含 dark:bg-dark-bg
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    const dialogClass = await dialog.evaluate((el) => el.className)
    expect(dialogClass).toContain('dark:bg-dark-bg')
    // 服务按钮卡片有暗色样式
    const serviceCard = dialog.locator('button').first()
    const cardClass = await serviceCard.evaluate((el) => el.className)
    expect(cardClass).toContain('dark:bg-dark-surface')
  })

  test('REQ-005: DemoConsole 弹窗暗色适配', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    // 打开演示控制台（通过 aria-label）
    await page.getByRole('button', { name: '演示控制台' }).click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    const dialogClass = await dialog.evaluate((el) => el.className)
    expect(dialogClass).toContain('dark:bg-dark-bg')
    // 控制台卡片有暗色样式
    const consoleSection = dialog.locator('section').first()
    const sectionClass = await consoleSection.evaluate((el) => el.className)
    expect(sectionClass).toContain('dark:bg-dark-surface')
  })

  test('NFR: 黑夜模式与老人模式可同时启用', async ({ page }) => {
    await enterMenu(page)
    // 开启黑夜模式
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 开启老人模式
    await page.getByRole('button', { name: '切换至老人模式' }).click()
    await expect(page.locator('html')).toHaveClass(/elderly/)
    // 两个 class 同时存在
    const htmlClass = await page.locator('html').evaluate((el) => el.className)
    expect(htmlClass).toContain('dark')
    expect(htmlClass).toContain('elderly')
  })

  test('NFR: 暗色模式刷新后保持偏好（持久化验证）', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: '切换黑夜模式' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 刷新
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 再次刷新确认稳定性
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
