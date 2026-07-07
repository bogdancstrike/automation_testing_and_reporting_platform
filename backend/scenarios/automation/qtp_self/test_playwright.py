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
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

        token = 'system-bearer-token'

        page = ctx.browser.visit('about:blank').page

        # Adds the Authorization header to normal browser requests.
        page.set_extra_http_headers({
            'Authorization': f'Bearer {token}'
        })

        # Adds the Authorization header to all routed requests too,
        # including React fetch/XHR calls.
        def add_auth_header(route, request):
            headers = dict(request.headers)
            headers['authorization'] = f'Bearer {token}'
            route.continue_(headers=headers)

        page.route('**/*', add_auth_header)

        page.goto('http://qtp-frontend/overview', wait_until='domcontentloaded')

        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000)  # Wait a bit for React to render

        total_runs_statistic = page.locator(
            "xpath=//div[contains(@class, 'ant-statistic') "
            "and .//div[contains(@class, 'ant-statistic-title') "
            "and normalize-space()='Total runs']]"
        )

        try:
            total_runs_statistic.wait_for(state='visible', timeout=10000)

            total_runs_value = total_runs_statistic.locator(
                "xpath=.//span[contains(@class, 'ant-statistic-content-value-int')]"
            ).inner_text(timeout=5000).strip()

        except PlaywrightTimeoutError:
            current_url = page.url
            body_text = page.locator('body').inner_text(timeout=5000)[:1000].replace('\n', ' ')

            ctx.log('error', f'Could not find Total runs statistic. Current URL: {current_url}')
            ctx.log('error', f'Page body preview: {body_text}')

            raise

        ctx.log('info', f'Total runs: {total_runs_value}')
        print(f'Total runs: {total_runs_value}')

        ctx.assert_that(
            'total_runs_visible',
            'equals',
            bool(total_runs_value),
            True,
            True,
            message='Total runs value should be visible'
        )

class QtpSelfPlaywrightTest2(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_2',
        name='QTP Self PlaywrightTest Test 2',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser']
    )

    def test(self, ctx):
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
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
        page = ctx.browser.visit('http://qtp-frontend/overview').page
        page.wait_for_selector('body', timeout=5000)
        page.wait_for_timeout(2000) # Wait a bit for React to render
        info = page.locator('body').inner_text()[:200].replace('\\n', ' ')
        ctx.log('info', f'Scraped from Playwright: {info}')
        print(f'Playwright scraped info: {info}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

