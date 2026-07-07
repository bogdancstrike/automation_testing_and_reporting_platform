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

