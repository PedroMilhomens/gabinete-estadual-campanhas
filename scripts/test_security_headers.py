import unittest
from pathlib import Path


HEADER_FILE = Path(__file__).parents[1] / "public" / "_headers"


class SecurityHeadersTests(unittest.TestCase):
    def test_static_host_headers_cover_required_policy(self):
        headers = HEADER_FILE.read_text(encoding="utf-8").lower()

        self.assertIn("content-security-policy:", headers)
        self.assertIn("default-src 'self'", headers)
        self.assertIn("https://*.supabase.co", headers)
        self.assertIn("https://challenges.cloudflare.com", headers)
        self.assertIn("frame-ancestors 'none'", headers)
        self.assertIn("x-content-type-options: nosniff", headers)
        self.assertIn(
            "referrer-policy: strict-origin-when-cross-origin", headers
        )


if __name__ == "__main__":
    unittest.main()
