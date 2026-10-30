import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("backup-supabase.py")
SPEC = importlib.util.spec_from_file_location("backup_supabase", SCRIPT_PATH)
backup_script = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup_script)


class BackupScriptTests(unittest.TestCase):
    def test_connection_url_keeps_password_in_environment_and_requires_tls(self):
        environment = backup_script.connection_environment(
            "postgresql://backup%40user:secret%3Avalue@db.example.test:6543/campaigns?sslmode=verify-full"
        )

        self.assertEqual(environment["PGUSER"], "backup@user")
        self.assertEqual(environment["PGPASSWORD"], "secret:value")
        self.assertEqual(environment["PGHOST"], "db.example.test")
        self.assertEqual(environment["PGPORT"], "6543")
        self.assertEqual(environment["PGDATABASE"], "campaigns")
        self.assertEqual(environment["PGSSLMODE"], "verify-full")

    def test_connection_url_rejects_disabled_tls(self):
        with self.assertRaises(ValueError):
            backup_script.connection_environment(
                "postgresql://backup:secret@db.example.test/campaigns?sslmode=disable"
            )

    def test_backup_rejects_repository_destinations(self):
        with self.assertRaises(ValueError):
            backup_script.create_backup(
                "postgresql://backup:secret@db.example.test/campaigns",
                backup_script.REPOSITORY_ROOT / "backup",
            )

    def test_backup_uses_private_atomic_destination_and_password_environment(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_directory = Path(temporary_directory) / "backups"

            def fake_dump(arguments, env, check):
                Path(arguments[arguments.index("--file") + 1]).write_bytes(b"dump")
                self.assertEqual(env["PGPASSWORD"], "private")
                self.assertNotIn("DATABASE_URL", arguments)
                self.assertTrue(check)

            with (
                patch.object(backup_script.shutil, "which", return_value="/usr/bin/pg_dump"),
                patch.object(backup_script.subprocess, "run", side_effect=fake_dump),
            ):
                destination = backup_script.create_backup(
                    "postgresql://backup:private@db.example.test/campaigns",
                    output_directory,
                )

            self.assertEqual(destination.read_bytes(), b"dump")
            self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
            self.assertEqual(output_directory.stat().st_mode & 0o777, 0o700)
            self.assertEqual(list(output_directory.glob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
