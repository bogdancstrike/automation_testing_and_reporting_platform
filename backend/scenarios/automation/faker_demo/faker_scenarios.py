"""Faker integration demo scenarios.

These scenarios exercise the native ``ctx.faker`` instance (and the
``{{faker.*}}`` template tokens) that QTP injects into every scenario context, so
developers can generate realistic random test data — names, emails, UUIDs,
addresses, and more — without wiring up Faker themselves.

Most are ``PythonTest`` scenarios that generate data and assert on its shape, so
they are self-contained and always meaningful. The last one shows the real
payoff: seeding an actual QTP API request with Faker-generated data.
"""
from __future__ import annotations

import re

from src.testkit import HttpTest, PythonTest, TYPE_HTTP, TYPE_PYTHON, TestMetadata

TARGET = "qtp_self"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_IPV4_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")


class FakerNames(PythonTest):
    """ctx.faker.name() / first_name() / last_name() produce realistic people."""

    metadata = TestMetadata(
        key="faker.names", name="Faker · realistic person names",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        names = [ctx.faker.name() for _ in range(20)]
        ctx.log("info", f"sample names: {names[:3]}")
        ctx.assert_that("faker_names", "all_non_empty", True,
                        all(bool(n.strip()) for n in names), all(bool(n.strip()) for n in names),
                        message="every generated name is non-empty")
        ctx.assert_that("faker_names", "look_like_full_names", True,
                        all(" " in n for n in names), all(" " in n for n in names),
                        message="names include at least a first and last part")
        first, last = ctx.faker.first_name(), ctx.faker.last_name()
        ctx.assert_that("faker_names", "first_and_last_present", True,
                        bool(first and last), bool(first and last),
                        message=f"first_name/last_name resolved ({first} {last})")


class FakerEmails(PythonTest):
    """ctx.faker.email() yields syntactically valid, unique-ish addresses."""

    metadata = TestMetadata(
        key="faker.emails", name="Faker · valid email addresses",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        emails = [ctx.faker.email() for _ in range(25)]
        ctx.log("info", f"sample emails: {emails[:3]}")
        all_valid = all(_EMAIL_RE.match(e) for e in emails)
        ctx.assert_that("faker_emails", "match_email_regex", True, all_valid, all_valid,
                        message="every generated email matches user@host.tld")
        company_email = ctx.faker.company_email()
        ctx.assert_that("faker_emails", "company_email_valid", True,
                        bool(_EMAIL_RE.match(company_email)), bool(_EMAIL_RE.match(company_email)),
                        message=f"company_email is well-formed ({company_email})")


class FakerUuids(PythonTest):
    """ctx.faker.uuid4() yields valid, unique UUIDs — ideal for idempotency keys."""

    metadata = TestMetadata(
        key="faker.uuids", name="Faker · unique UUIDs",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        uuids = [str(ctx.faker.uuid4()) for _ in range(100)]
        all_valid = all(_UUID_RE.match(u) for u in uuids)
        ctx.assert_that("faker_uuids", "match_uuid_regex", True, all_valid, all_valid,
                        message="every value is a canonical UUID")
        unique = len(set(uuids))
        ctx.assert_that("faker_uuids", "all_unique", 100, unique, unique == 100,
                        message=f"100 generated UUIDs are all distinct (got {unique})")


class FakerAddresses(PythonTest):
    """ctx.faker.address()/city()/country()/postcode() produce postal data."""

    metadata = TestMetadata(
        key="faker.addresses", name="Faker · postal addresses",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        address = ctx.faker.address()
        ctx.log("info", f"address: {address!r}")
        ctx.assert_that("faker_address", "non_empty", True, bool(address.strip()), bool(address.strip()),
                        message="address is non-empty")
        ctx.assert_that("faker_address", "multiline", True, "\n" in address, "\n" in address,
                        message="a full address spans multiple lines")
        for part in ("city", "country", "postcode", "street_address"):
            value = getattr(ctx.faker, part)()
            ctx.assert_that("faker_address", f"{part}_non_empty", True,
                            bool(str(value).strip()), bool(str(value).strip()),
                            message=f"{part} resolved ({value!r})")


class FakerPhoneNumbers(PythonTest):
    """ctx.faker.phone_number() produces plausible phone strings with digits."""

    metadata = TestMetadata(
        key="faker.phone_numbers", name="Faker · phone numbers",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        phones = [ctx.faker.phone_number() for _ in range(15)]
        ctx.log("info", f"sample phones: {phones[:3]}")
        has_digits = all(any(c.isdigit() for c in p) for p in phones)
        ctx.assert_that("faker_phone", "contains_digits", True, has_digits, has_digits,
                        message="every phone number contains digits")


class FakerCompanyAndJob(PythonTest):
    """ctx.faker.company()/job()/catch_phrase() for B2B-style fixtures."""

    metadata = TestMetadata(
        key="faker.company_job", name="Faker · company and job titles",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        company, job, phrase = ctx.faker.company(), ctx.faker.job(), ctx.faker.catch_phrase()
        ctx.log("info", f"{company} — {job} — {phrase}")
        for label, value in (("company", company), ("job", job), ("catch_phrase", phrase)):
            ctx.assert_that("faker_company", f"{label}_non_empty", True,
                            bool(str(value).strip()), bool(str(value).strip()),
                            message=f"{label} resolved ({value!r})")


class FakerInternet(PythonTest):
    """ctx.faker.user_name()/url()/ipv4()/domain_name() — network fixtures."""

    metadata = TestMetadata(
        key="faker.internet", name="Faker · internet fixtures",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        url = ctx.faker.url()
        ipv4 = ctx.faker.ipv4()
        user = ctx.faker.user_name()
        ctx.log("info", f"user={user} url={url} ipv4={ipv4}")
        ctx.assert_that("faker_internet", "url_scheme", True,
                        url.startswith("http://") or url.startswith("https://"),
                        url.startswith("http://") or url.startswith("https://"),
                        message=f"url has an http(s) scheme ({url})")
        ctx.assert_that("faker_internet", "ipv4_shape", True,
                        bool(_IPV4_RE.match(ipv4)), bool(_IPV4_RE.match(ipv4)),
                        message=f"ipv4 looks like an IPv4 address ({ipv4})")
        ctx.assert_that("faker_internet", "user_non_empty", True,
                        bool(user.strip()), bool(user.strip()),
                        message="user_name is non-empty")


class FakerNumbersAndDates(PythonTest):
    """Bounded random numbers and dates: random_int, pyfloat, date_of_birth."""

    metadata = TestMetadata(
        key="faker.numbers_dates", name="Faker · numbers and dates",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        import datetime as _dt
        ints = [ctx.faker.random_int(min=10, max=20) for _ in range(50)]
        in_range = all(10 <= n <= 20 for n in ints)
        ctx.assert_that("faker_numbers", "random_int_in_range", True, in_range, in_range,
                        message="random_int(min=10, max=20) stays within bounds")
        dob = ctx.faker.date_of_birth(minimum_age=18, maximum_age=90)
        ctx.log("info", f"date_of_birth={dob}")
        is_past = isinstance(dob, _dt.date) and dob < _dt.date.today()
        ctx.assert_that("faker_dates", "dob_in_past", True, is_past, is_past,
                        message=f"date_of_birth is a real past date ({dob})")


class FakerLoremText(PythonTest):
    """ctx.faker.sentence()/paragraph()/text() for free-text fixtures."""

    metadata = TestMetadata(
        key="faker.lorem_text", name="Faker · lorem text",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        sentence = ctx.faker.sentence(nb_words=6)
        paragraph = ctx.faker.paragraph(nb_sentences=3)
        ctx.log("info", f"sentence={sentence!r}")
        ctx.assert_that("faker_lorem", "sentence_has_words", True,
                        len(sentence.split()) >= 3, len(sentence.split()) >= 3,
                        message="sentence has several words")
        ctx.assert_that("faker_lorem", "paragraph_non_empty", True,
                        len(paragraph) > len(sentence), len(paragraph) > len(sentence),
                        message="paragraph is longer than a single sentence")


class FakerReproducibleSeed(PythonTest):
    """Seeding makes Faker deterministic — vital for reproducible test data."""

    metadata = TestMetadata(
        key="faker.reproducible_seed", name="Faker · reproducible via seed",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data"],
    )

    def test(self, ctx):
        ctx.faker.seed_instance(1234)
        run1 = [ctx.faker.name(), ctx.faker.email(), str(ctx.faker.uuid4())]
        ctx.faker.seed_instance(1234)
        run2 = [ctx.faker.name(), ctx.faker.email(), str(ctx.faker.uuid4())]
        ctx.log("info", f"seeded run1={run1}")
        ctx.assert_that("faker_seed", "deterministic", run1, run2, run1 == run2,
                        message="re-seeding with the same value reproduces the exact data")


class FakerTemplateTokens(PythonTest):
    """{{faker.*}} template tokens resolve inside ctx.render — usable from UI tests."""

    metadata = TestMetadata(
        key="faker.template_tokens", name="Faker · {{faker.*}} template tokens",
        type=TYPE_PYTHON, target=TARGET, tags=["faker", "test-data", "template"],
    )

    def test(self, ctx):
        email = ctx.render("{{faker.email}}")
        name = ctx.render("Hello {{faker.name}}")
        uuid_val = ctx.render("{{faker.uuid4}}")
        ctx.log("info", f"rendered: email={email!r} name={name!r} uuid={uuid_val!r}")
        ctx.assert_that("faker_template", "email_token_valid", True,
                        bool(_EMAIL_RE.match(email)), bool(_EMAIL_RE.match(email)),
                        message=f"{{{{faker.email}}}} rendered a valid email ({email})")
        ctx.assert_that("faker_template", "name_token_substituted", True,
                        name.startswith("Hello ") and len(name) > len("Hello "),
                        name.startswith("Hello ") and len(name) > len("Hello "),
                        message=f"{{{{faker.name}}}} substituted into surrounding text ({name!r})")
        ctx.assert_that("faker_template", "uuid_token_valid", True,
                        bool(_UUID_RE.match(uuid_val)), bool(_UUID_RE.match(uuid_val)),
                        message="{{faker.uuid4}} rendered a valid UUID")
        # Unknown providers are left untouched, not blanked.
        untouched = ctx.render("{{faker.not_a_real_provider}}")
        ctx.assert_that("faker_template", "unknown_left_intact", "{{faker.not_a_real_provider}}",
                        untouched, untouched == "{{faker.not_a_real_provider}}",
                        message="unknown faker providers leave the token untouched")


class FakerApiRequestWithData(HttpTest):
    """The real payoff: seed a live QTP API request with Faker-generated data,
    then clean it up. Creates a request-test named with faker.company()."""

    metadata = TestMetadata(
        key="faker.api_request_with_data", name="Faker · drive a real API request",
        type=TYPE_HTTP, target=TARGET, tags=["faker", "test-data", "api"],
    )

    _TOKEN = {"type": "bearer", "token": "system-bearer-token"}

    def test(self, ctx):
        name = f"{ctx.faker.company()} · {ctx.faker.uuid4()}"
        ctx.set_var("created_id", "")
        with ctx.step("Create request-test with faker data"):
            resp = ctx.http.post("/api/request-tests", auth=self._TOKEN, json={
                "name": name,
                "config": {"method": "GET", "url": "http://example.com"},
            })
            resp.should.have_status(201)
            created_id = resp.json.get("$.id")
            ctx.set_var("created_id", created_id or "")
            ctx.assert_that("faker_api", "created", True, bool(created_id), bool(created_id),
                            message=f"created request-test named with faker data ({name})")

        with ctx.step("Delete it"):
            created_id = ctx.get_var("created_id")
            if created_id:
                ctx.http.delete(f"/api/request-tests/{created_id}", auth=self._TOKEN).should.have_status(200)
                ctx.set_var("created_id", "")

    def cleanup(self, ctx):
        created_id = ctx.get_var("created_id")
        if created_id:
            ctx.http.delete(f"/api/request-tests/{created_id}", auth=self._TOKEN)
            ctx.log("info", f"cleanup: removed leftover request-test {created_id}")
