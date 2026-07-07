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
        page = ctx.browser.visit('https://example.com/').page

        page.wait_for_selector('body', timeout=5000)

        title = page.locator('h1').inner_text(timeout=5000).strip()
        body_text = page.locator('body').inner_text(timeout=5000).strip()

        ctx.log('info', f'Title: {title}')
        ctx.log('info', f'Body: {body_text}')

        print(f'Playwright scraped title: {title}')
        print(f'Playwright scraped body: {body_text}')

        ctx.assert_that(
            'example_title',
            'equals',
            title,
            'Example Domain',
            True,
            message='Example.com title should be visible'
        )

class QtpSelfPlaywrightTest2(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_2',
        name='QTP Self PlaywrightTest Test 2 - Example.org',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser', 'scraping']
    )

    def test(self, ctx):
        page = ctx.browser.visit('https://example.org/').page

        page.wait_for_selector('body', timeout=5000)

        title = page.locator('h1').inner_text(timeout=5000).strip()
        body_text = page.locator('body').inner_text(timeout=5000).strip()

        ctx.log('info', f'Example.org title: {title}')
        ctx.log('info', f'Example.org body: {body_text}')

        print(f'Playwright Example.org title: {title}')
        print(f'Playwright Example.org body: {body_text}')

        ctx.assert_that(
            'example_org_title',
            'equals',
            title,
            'Example Domain',
            True,
            message='Example.org should render the Example Domain heading'
        )


class QtpSelfPlaywrightTest3(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_3',
        name='QTP Self PlaywrightTest Test 3 - HTTPBin HTML',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser', 'scraping']
    )

    def test(self, ctx):
        page = ctx.browser.visit('https://httpbin.org/html').page

        page.wait_for_selector('body', timeout=5000)

        title = page.locator('h1').inner_text(timeout=5000).strip()
        paragraph = page.locator('p').first.inner_text(timeout=5000).strip()

        ctx.log('info', f'HTTPBin title: {title}')
        ctx.log('info', f'HTTPBin first paragraph preview: {paragraph[:300]}')

        print(f'Playwright HTTPBin title: {title}')
        print(f'Playwright HTTPBin first paragraph preview: {paragraph[:300]}')

        ctx.assert_that(
            'httpbin_title_visible',
            'equals',
            bool(title),
            True,
            True,
            message='HTTPBin HTML page should have a visible h1 title'
        )


class QtpSelfPlaywrightTest4(PlaywrightTest):
    metadata = TestMetadata(
        key='qtp_self.browser.test_4',
        name='QTP Self PlaywrightTest Test 4 - IANA Reserved Domains',
        type=TYPE_PLAYWRIGHT,
        target='qtp_self',
        tags=['qtp_self', 'browser', 'scraping']
    )

    def test(self, ctx):
        page = ctx.browser.visit('https://www.iana.org/domains/reserved').page

        page.wait_for_selector('body', timeout=5000)

        title = page.locator('h1').inner_text(timeout=5000).strip()
        body_text = page.locator('body').inner_text(timeout=5000).strip()

        ctx.log('info', f'IANA page title: {title}')
        ctx.log('info', f'IANA body preview: {body_text[:500]}')

        print(f'Playwright IANA page title: {title}')
        print(f'Playwright IANA body preview: {body_text[:500]}')

        ctx.assert_that(
            'iana_reserved_domains_title_visible',
            'equals',
            bool(title),
            True,
            True,
            message='IANA Reserved Domains page should have a visible h1 title'
        )