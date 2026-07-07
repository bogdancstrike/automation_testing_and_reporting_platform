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

class QtpSelfSeleniumTest2(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_2',
        name='QTP Self SeleniumTest Test 2 - Example.org',
        type=TYPE_SELENIUM,
        target='qtp_self',
        tags=['qtp_self', 'selenium', 'scraping']
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
            driver.get('https://example.org/')

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )

            title = driver.find_element(By.TAG_NAME, 'h1').text.strip()
            body_text = driver.find_element(By.TAG_NAME, 'body').text.strip()

            ctx.log('info', f'Example.org title: {title}')
            ctx.log('info', f'Example.org body: {body_text}')

            print(f'Selenium Example.org title: {title}')
            print(f'Selenium Example.org body: {body_text}')

            ctx.assert_that(
                'example_org_title',
                'equals',
                title,
                'Example Domain',
                True,
                message='Example.org should render the Example Domain heading'
            )

        finally:
            driver.quit()


class QtpSelfSeleniumTest3(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_3',
        name='QTP Self SeleniumTest Test 3 - HTTPBin HTML',
        type=TYPE_SELENIUM,
        target='qtp_self',
        tags=['qtp_self', 'selenium', 'scraping']
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
            driver.get('https://httpbin.org/html')

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )

            title = driver.find_element(By.TAG_NAME, 'h1').text.strip()
            paragraph = driver.find_element(By.TAG_NAME, 'p').text.strip()

            ctx.log('info', f'HTTPBin title: {title}')
            ctx.log('info', f'HTTPBin first paragraph preview: {paragraph[:300]}')

            print(f'Selenium HTTPBin title: {title}')
            print(f'Selenium HTTPBin first paragraph preview: {paragraph[:300]}')

            ctx.assert_that(
                'httpbin_title_visible',
                'equals',
                bool(title),
                True,
                True,
                message='HTTPBin HTML page should have a visible h1 title'
            )

        finally:
            driver.quit()


class QtpSelfSeleniumTest4(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_4',
        name='QTP Self SeleniumTest Test 4 - IANA Reserved Domains',
        type=TYPE_SELENIUM,
        target='qtp_self',
        tags=['qtp_self', 'selenium', 'scraping']
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
            driver.get('https://www.iana.org/domains/reserved')

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )

            title = driver.find_element(By.TAG_NAME, 'h1').text.strip()
            body_text = driver.find_element(By.TAG_NAME, 'body').text.strip()

            ctx.log('info', f'IANA page title: {title}')
            ctx.log('info', f'IANA body preview: {body_text[:500]}')

            print(f'Selenium IANA page title: {title}')
            print(f'Selenium IANA body preview: {body_text[:500]}')

            ctx.assert_that(
                'iana_reserved_domains_title_visible',
                'equals',
                bool(title),
                True,
                True,
                message='IANA Reserved Domains page should have a visible h1 title'
            )

        finally:
            driver.quit()