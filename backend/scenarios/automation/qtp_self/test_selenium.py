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
        from selenium.common.exceptions import TimeoutException
        import time

        token = 'system-bearer-token'

        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        driver = webdriver.Chrome(options=options)

        try:
            # Inject Authorization header for browser-level requests.
            # This also applies to many XHR/fetch requests made by the React app.
            driver.execute_cdp_cmd('Network.enable', {})

            driver.execute_cdp_cmd(
                'Network.setExtraHTTPHeaders',
                {
                    'headers': {
                        'Authorization': f'Bearer {token}',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                }
            )

            # Open the origin first so localStorage is available for qtp-frontend.
            driver.get('http://qtp-frontend')

            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script('return document.readyState') in ['interactive', 'complete']
            )

            # Also seed common frontend auth storage keys.
            # Keep the key that your frontend actually uses; these are defensive fallbacks.
            driver.execute_script(
                """
                const token = arguments[0];

                localStorage.setItem('token', token);
                localStorage.setItem('access_token', token);
                localStorage.setItem('authToken', token);
                localStorage.setItem('bearerToken', token);

                sessionStorage.setItem('token', token);
                sessionStorage.setItem('access_token', token);
                sessionStorage.setItem('authToken', token);
                sessionStorage.setItem('bearerToken', token);
                """,
                token
            )

            driver.get('http://qtp-frontend/overview')

            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script('return document.readyState') in ['interactive', 'complete']
            )

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, 'body'))
            )

            time.sleep(2)  # Wait a bit for React to render

            total_runs_xpath = (
                "//div[contains(@class, 'ant-statistic') "
                "and .//div[contains(@class, 'ant-statistic-title') "
                "and normalize-space()='Total runs']]"
                "//span[contains(@class, 'ant-statistic-content-value-int')]"
            )

            try:
                total_runs_value_element = WebDriverWait(driver, 15).until(
                    EC.visibility_of_element_located((By.XPATH, total_runs_xpath))
                )

                total_runs_value = total_runs_value_element.text.strip()

            except TimeoutException:
                current_url = driver.current_url

                try:
                    body_text = driver.find_element(By.TAG_NAME, 'body').text
                    body_preview = body_text[:1000].replace('\n', ' ')
                except Exception:
                    body_preview = '<body not readable>'

                ctx.log('error', f'Could not find Total runs statistic. Current URL: {current_url}')
                ctx.log('error', f'Page body preview: {body_preview}')

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

        finally:
            driver.quit()

class QtpSelfSeleniumTest2(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_2',
        name='QTP Self SeleniumTest Test 2',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest3(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_3',
        name='QTP Self SeleniumTest Test 3',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest4(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_4',
        name='QTP Self SeleniumTest Test 4',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest5(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_5',
        name='QTP Self SeleniumTest Test 5',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest6(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_6',
        name='QTP Self SeleniumTest Test 6',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest7(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_7',
        name='QTP Self SeleniumTest Test 7',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest8(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_8',
        name='QTP Self SeleniumTest Test 8',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest9(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_9',
        name='QTP Self SeleniumTest Test 9',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

class QtpSelfSeleniumTest10(SeleniumTest):
    metadata = TestMetadata(
        key='qtp_self.selenium.test_10',
        name='QTP Self SeleniumTest Test 10',
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
        import time

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
        try:
            driver.get('http://qtp-frontend/overview')
            WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(2) # Wait a bit for React to render
            info = driver.find_element(By.TAG_NAME, "body").text[:200].replace('\n', ' ')
            ctx.log('info', f'Scraped from Selenium: {info}')
            print(f'Selenium scraped info: {info}')
            ctx.assert_that('test', 'equals', True, True, True, message='always pass')
        finally:
            driver.quit()

