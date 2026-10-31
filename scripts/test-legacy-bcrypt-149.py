"""Offline compatibility proof using synthetic credentials only; no database access."""
import json
import unittest

import bcrypt


class LegacyBcryptFixture(unittest.TestCase):
    def test_known_fixture_and_wrong_password(self):
        password = b"PTV149-SYNTHETIC-ONLY!"
        generated = bcrypt.hashpw(password, bcrypt.gensalt(rounds=10))
        for prefix in (b"2a", b"2b", b"2y"):
            with self.subTest(prefix=prefix.decode()):
                fixture = b"$" + prefix + generated[3:]
                self.assertTrue(bcrypt.checkpw(password, fixture))
                self.assertFalse(bcrypt.checkpw(b"WRONG-SYNTHETIC", fixture))

    def test_malformed_hash_rejected(self):
        with self.assertRaises(ValueError):
            bcrypt.checkpw(b"SYNTHETIC", b"invalid-fixture")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(LegacyBcryptFixture)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    print(json.dumps({"synthetic_only": True, "verifier": "Python bcrypt " + bcrypt.__version__,
                      "tests": result.testsRun, "passed": result.wasSuccessful(),
                      "node_portal_compatibility_proven": False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
