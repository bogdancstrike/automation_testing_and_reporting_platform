import json
import hashlib
import platform
import statistics
import tempfile
import uuid
from datetime import datetime, timezone

import requests

from src.testkit import PythonTest, TYPE_PYTHON, TestMetadata


class QtpSelfPythonTest1(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_1',
        name='QTP Self PythonTest Test 1 - JSON Roundtrip',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'json']
    )

    def test(self, ctx):
        ctx.log('info', 'Running JSON roundtrip test')

        payload = {
            'service': 'qtp-self',
            'enabled': True,
            'retries': 3,
            'tags': ['python', 'json', 'roundtrip']
        }

        serialized = json.dumps(payload, sort_keys=True)
        deserialized = json.loads(serialized)

        ctx.log('info', f'Serialized payload: {serialized}')

        ctx.assert_that(
            'json_roundtrip',
            'equals',
            deserialized,
            payload,
            True,
            message='JSON payload should serialize and deserialize without data loss'
        )


class QtpSelfPythonTest2(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_2',
        name='QTP Self PythonTest Test 2 - Example.com HTTP',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'http']
    )

    def test(self, ctx):
        ctx.log('info', 'Running HTTP request test against example.com')

        response = requests.get(
            'https://example.com/',
            headers={
                'accept': 'text/html'
            },
            timeout=10
        )

        body_preview = response.text[:300].replace('\n', ' ')

        ctx.log('info', f'Status code: {response.status_code}')
        ctx.log('info', f'Body preview: {body_preview}')

        ctx.assert_that(
            'status_code',
            'equals',
            response.status_code,
            200,
            True,
            message='Example.com should return 200'
        )

        ctx.assert_that(
            'contains_example_domain',
            'equals',
            'Example Domain' in response.text,
            True,
            True,
            message='Example.com response should contain Example Domain'
        )


class QtpSelfPythonTest3(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_3',
        name='QTP Self PythonTest Test 3 - Statistics',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'statistics']
    )

    def test(self, ctx):
        ctx.log('info', 'Running statistics calculation test')

        response_times_ms = [120, 95, 210, 180, 150, 130, 170]

        average_ms = round(statistics.mean(response_times_ms), 2)
        median_ms = statistics.median(response_times_ms)
        max_ms = max(response_times_ms)

        ctx.log('info', f'Response times: {response_times_ms}')
        ctx.log('info', f'Average response time: {average_ms} ms')
        ctx.log('info', f'Median response time: {median_ms} ms')
        ctx.log('info', f'Max response time: {max_ms} ms')

        ctx.assert_that(
            'average_response_time_under_200',
            'equals',
            average_ms < 200,
            True,
            True,
            message='Average response time should be under 200 ms'
        )

        ctx.assert_that(
            'max_response_time',
            'equals',
            max_ms,
            210,
            True,
            message='Max response time should be 210 ms'
        )


class QtpSelfPythonTest4(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_4',
        name='QTP Self PythonTest Test 4 - Dog API Breeds',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'http', 'api']
    )

    def test(self, ctx):
        ctx.log('info', 'Running Dog API breeds test')

        response = requests.get(
            'https://dogapi.dog/api/v2/breeds',
            headers={
                'accept': 'application/json'
            },
            timeout=10
        )

        try:
            response_body = response.json()
        except ValueError:
            response_body = response.text

        ctx.log('info', json.dumps(response_body, indent=2, ensure_ascii=False))

        ctx.assert_that(
            'status_code',
            'equals',
            response.status_code,
            200,
            True,
            message='Dog API breeds endpoint should return 200'
        )

        breed_count = len(response_body.get('data', [])) if isinstance(response_body, dict) else 0

        ctx.log('info', f'Dog breeds returned: {breed_count}')

        ctx.assert_that(
            'dog_breeds_returned',
            'equals',
            breed_count > 0,
            True,
            True,
            message='Dog API should return at least one breed'
        )


class QtpSelfPythonTest5(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_5',
        name='QTP Self PythonTest Test 5 - HTTPBin JSON',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'http', 'json']
    )

    def test(self, ctx):
        ctx.log('info', 'Running HTTPBin JSON test')

        response = requests.get(
            'https://httpbin.org/json',
            headers={
                'accept': 'application/json'
            },
            timeout=10
        )

        response_body = response.json()

        ctx.log('info', json.dumps(response_body, indent=2, ensure_ascii=False))

        slideshow_title = response_body.get('slideshow', {}).get('title')

        ctx.log('info', f'HTTPBin slideshow title: {slideshow_title}')

        ctx.assert_that(
            'status_code',
            'equals',
            response.status_code,
            200,
            True,
            message='HTTPBin JSON endpoint should return 200'
        )

        ctx.assert_that(
            'slideshow_title_present',
            'equals',
            bool(slideshow_title),
            True,
            True,
            message='HTTPBin JSON response should contain slideshow.title'
        )


class QtpSelfPythonTest6(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_6',
        name='QTP Self PythonTest Test 6 - SHA256 Hashing',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'hashing']
    )

    def test(self, ctx):
        ctx.log('info', 'Running SHA256 hashing test')

        input_value = 'qtp-self-python-test'
        digest = hashlib.sha256(input_value.encode('utf-8')).hexdigest()

        ctx.log('info', f'Input value: {input_value}')
        ctx.log('info', f'SHA256 digest: {digest}')

        ctx.assert_that(
            'sha256_length',
            'equals',
            len(digest),
            64,
            True,
            message='SHA256 hex digest should have 64 characters'
        )

        ctx.assert_that(
            'sha256_is_hex',
            'equals',
            all(char in '0123456789abcdef' for char in digest),
            True,
            True,
            message='SHA256 digest should contain only lowercase hexadecimal characters'
        )


class QtpSelfPythonTest7(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_7',
        name='QTP Self PythonTest Test 7 - Temp File IO',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'file-io']
    )

    def test(self, ctx):
        ctx.log('info', 'Running temporary file IO test')

        content = {
            'test': 'qtp_self.python.test_7',
            'status': 'created',
            'items': [1, 2, 3]
        }

        with tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=True) as temp_file:
            json.dump(content, temp_file)
            temp_file.flush()

            ctx.log('info', f'Temporary file path: {temp_file.name}')

            temp_file.seek(0)
            loaded_content = json.load(temp_file)

        ctx.log('info', f'Loaded content: {json.dumps(loaded_content, sort_keys=True)}')

        ctx.assert_that(
            'temp_file_content',
            'equals',
            loaded_content,
            content,
            True,
            message='Content loaded from temp file should match written content'
        )


class QtpSelfPythonTest8(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_8',
        name='QTP Self PythonTest Test 8 - UUID Validation',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'uuid']
    )

    def test(self, ctx):
        ctx.log('info', 'Running UUID validation test')

        generated_uuid = uuid.uuid4()
        generated_uuid_text = str(generated_uuid)

        parsed_uuid = uuid.UUID(generated_uuid_text)

        ctx.log('info', f'Generated UUID: {generated_uuid_text}')
        ctx.log('info', f'Parsed UUID version: {parsed_uuid.version}')

        ctx.assert_that(
            'uuid_roundtrip',
            'equals',
            str(parsed_uuid),
            generated_uuid_text,
            True,
            message='Generated UUID should be parseable back to the same value'
        )

        ctx.assert_that(
            'uuid_version',
            'equals',
            parsed_uuid.version,
            4,
            True,
            message='Generated UUID should be version 4'
        )


class QtpSelfPythonTest9(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_9',
        name='QTP Self PythonTest Test 9 - Data Filtering',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'data-processing']
    )

    def test(self, ctx):
        ctx.log('info', 'Running data filtering test')

        runs = [
            {'id': 1, 'status': 'passed', 'duration_ms': 120},
            {'id': 2, 'status': 'failed', 'duration_ms': 80},
            {'id': 3, 'status': 'passed', 'duration_ms': 300},
            {'id': 4, 'status': 'passed', 'duration_ms': 150},
            {'id': 5, 'status': 'skipped', 'duration_ms': 0},
        ]

        passed_runs = [run for run in runs if run['status'] == 'passed']
        slow_passed_runs = [run for run in passed_runs if run['duration_ms'] >= 150]

        passed_count = len(passed_runs)
        slow_passed_count = len(slow_passed_runs)

        ctx.log('info', f'All runs: {json.dumps(runs)}')
        ctx.log('info', f'Passed runs count: {passed_count}')
        ctx.log('info', f'Slow passed runs count: {slow_passed_count}')

        ctx.assert_that(
            'passed_count',
            'equals',
            passed_count,
            3,
            True,
            message='There should be exactly 3 passed runs'
        )

        ctx.assert_that(
            'slow_passed_count',
            'equals',
            slow_passed_count,
            2,
            True,
            message='There should be exactly 2 passed runs with duration >= 150 ms'
        )


class QtpSelfPythonTest10(PythonTest):
    metadata = TestMetadata(
        key='qtp_self.python.test_10',
        name='QTP Self PythonTest Test 10 - Runtime Info',
        type=TYPE_PYTHON,
        target='qtp_self',
        tags=['qtp_self', 'python', 'runtime']
    )

    def test(self, ctx):
        ctx.log('info', 'Running Python runtime info test')

        now_utc = datetime.now(timezone.utc)
        python_version = platform.python_version()
        implementation = platform.python_implementation()
        system = platform.system()
        machine = platform.machine()

        ctx.log('info', f'Current UTC time: {now_utc.isoformat()}')
        ctx.log('info', f'Python version: {python_version}')
        ctx.log('info', f'Python implementation: {implementation}')
        ctx.log('info', f'Operating system: {system}')
        ctx.log('info', f'Machine: {machine}')

        ctx.assert_that(
            'python_implementation',
            'equals',
            implementation,
            'CPython',
            True,
            message='Runtime should use CPython'
        )

        ctx.assert_that(
            'utc_timezone_present',
            'equals',
            now_utc.tzinfo is not None,
            True,
            True,
            message='UTC datetime should be timezone-aware'
        )