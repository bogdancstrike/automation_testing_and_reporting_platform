from src.testkit import CliTest, TYPE_CLI, TestMetadata

class QtpSelfCliTest1(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_1',
        name='QTP Self CliTest Test 1',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest2(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_2',
        name='QTP Self CliTest Test 2',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest3(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_3',
        name='QTP Self CliTest Test 3',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest4(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_4',
        name='QTP Self CliTest Test 4',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest5(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_5',
        name='QTP Self CliTest Test 5',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest6(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_6',
        name='QTP Self CliTest Test 6',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest7(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_7',
        name='QTP Self CliTest Test 7',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest8(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_8',
        name='QTP Self CliTest Test 8',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest9(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_9',
        name='QTP Self CliTest Test 9',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

class QtpSelfCliTest10(CliTest):
    metadata = TestMetadata(
        key='qtp_self.cli.test_10',
        name='QTP Self CliTest Test 10',
        type=TYPE_CLI,
        target='qtp_self',
        tags=['qtp_self', 'cli']
    )

    def test(self, ctx):
        res = ctx.cli.run('curl -s https://dogapi.dog/api/v2/facts')
        ctx.log('info', f'CLI Output: {res.stdout[:500]}')
        print(f'CLI Output: {res.stdout[:500]}')
        ctx.assert_that('test', 'equals', True, True, True, message='always pass')

