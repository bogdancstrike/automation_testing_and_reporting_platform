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