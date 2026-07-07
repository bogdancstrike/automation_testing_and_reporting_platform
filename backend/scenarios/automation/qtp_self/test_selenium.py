from src.testkit import SeleniumTest, TYPE_SELENIUM, TestMetadata

class QtpSelfSeleniumTest1(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_1',
        name='QTP Self SeleniumTest Test 1',
        type=TYPE_SELENIUM,
        target='qtp_self',
        tags=['qtp_self', 'selenium']
    )

    def test(self, ctx):
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        driver = webdriver.Chrome(options=options)

        try:
            driver.get('https://example.com/')

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )

            title = driver.find_element(By.TAG_NAME, 'h1').text.strip()
            body_text = driver.find_element(By.TAG_NAME, 'body').text.strip()

            ctx.log('info', f'Title: {title}')
            ctx.log('info', f'Body: {body_text}')

            print(f'Selenium scraped title: {title}')
            print(f'Selenium scraped body: {body_text}')

            ctx.assert_that(
                'example_title',
                'equals',
                title,
                'Example Domain',
                True,
                message='Example.com title should be visible'
            )

        finally:
            driver.quit()