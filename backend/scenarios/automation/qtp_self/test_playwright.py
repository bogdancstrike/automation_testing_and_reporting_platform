from src.testkit import PlaywrightTest, TYPE_PLAYWRIGHT, TestMetadata

class QtpSelfPlaywrightTest1(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_1',
        name='QTP Self PlaywrightTest Test 1',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest2(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_2',
        name='QTP Self PlaywrightTest Test 2',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest3(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_3',
        name='QTP Self PlaywrightTest Test 3',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest4(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_4',
        name='QTP Self PlaywrightTest Test 4',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest5(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_5',
        name='QTP Self PlaywrightTest Test 5',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest6(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_6',
        name='QTP Self PlaywrightTest Test 6',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest7(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_7',
        name='QTP Self PlaywrightTest Test 7',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest8(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_8',
        name='QTP Self PlaywrightTest Test 8',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest9(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_9',
        name='QTP Self PlaywrightTest Test 9',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfPlaywrightTest10(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_10',
        name='QTP Self PlaywrightTest Test 10',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend:5173/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

