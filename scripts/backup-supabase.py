#!/usr/bin/env python3
"""Create a private PostgreSQL custom-format backup outside the repository."""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKUP_DIRECTORY = Path.home() / "backups" / "demolay-ro"


def connection_environment(database_url: str) -> dict[str, str]:
    parsed = urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL must use the postgres or postgresql scheme.")

    database = unquote(parsed.path.lstrip("/"))
    if not parsed.hostname or not parsed.username or not database:
        raise ValueError("DATABASE_URL must include a host, user, and database.")

    query = parse_qs(parsed.query)
    sslmode = query.get("sslmode", ["require"])[0]
    if sslmode not in {"require", "verify-ca", "verify-full"}:
        raise ValueError("DATABASE_URL must require TLS for remote backups.")

    environment = {
        "PGHOST": parsed.hostname,
        "PGPORT": str(parsed.port or 5432),
        "PGUSER": unquote(parsed.username),
        "PGDATABASE": database,
        "PGSSLMODE": sslmode,
    }
    if parsed.password is not None:
        environment["PGPASSWORD"] = unquote(parsed.password)
    return environment


def create_backup(database_url: str, output_directory: Path) -> Path:
    directory = output_directory.expanduser().resolve()
    if directory == REPOSITORY_ROOT or REPOSITORY_ROOT in directory.parents:
        raise ValueError("Backup destination must be outside the repository.")

    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)

    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        raise RuntimeError("pg_dump was not found. Install the PostgreSQL client tools.")

    environment = os.environ.copy()
    environment.pop("PGPASSWORD", None)
    environment.update(connection_environment(database_url))

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = directory / f"demolay-ro-{timestamp}.dump"
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".demolay-ro-", suffix=".dump.tmp", dir=directory
    )
    os.fchmod(descriptor, 0o600)
    os.close(descriptor)
    temporary = Path(temporary_name)

    try:
        subprocess.run(
            [
                pg_dump,
                "--format=custom",
                "--no-owner",
                "--no-acl",
                "--file",
                str(temporary),
            ],
            env=environment,
            check=True,
        )
        if temporary.stat().st_size == 0:
            raise RuntimeError("pg_dump produced an empty backup.")
        os.link(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)

    destination.chmod(0o600)
    return destination


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_BACKUP_DIRECTORY,
        help="private directory outside the repository (default: %(default)s)",
    )
    arguments = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        parser.error("set DATABASE_URL in the environment; do not pass it on the command line")

    try:
        backup = create_backup(database_url, arguments.output_dir)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        return 1

    print(f"Backup created: {backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
