import os
import sys
import math
import asyncio
import subprocess
from pathlib import Path
from telethon import TelegramClient
from telethon.tl.types import DocumentAttributeFilename

# These values are injected by GitHub Actions from your secrets
API_ID = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]
USER_ID = int(os.environ["TELEGRAM_USER_ID"])
DOWNLOAD_URL = os.environ["DOWNLOAD_URL"]

# 2GB in bytes (Telegram user API limit)
CHUNK_SIZE = 2 * 1024 * 1024 * 1024

DOWNLOAD_DIR = Path("/tmp/pocket_downloader")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def download_file(url: str) -> Path:
    """Download a file using aria2c for fast multi-connection downloading."""
    print(f"Starting download: {url}")
    result = subprocess.run(
        [
            "aria2c",
            "--dir", str(DOWNLOAD_DIR),
            "--max-connection-per-server=16",
            "--split=16",
            "--min-split-size=1M",
            "--console-log-level=warn",
            url
        ],
        capture_output=False
    )
    if result.returncode != 0:
        raise RuntimeError(f"aria2c failed with return code {result.returncode}")

    # Find the downloaded file (aria2c saves with original filename)
    files = list(DOWNLOAD_DIR.iterdir())
    if not files:
        raise RuntimeError("No file found after download")

    # Return the most recently modified file
    return max(files, key=lambda f: f.stat().st_mtime)


def split_file(file_path: Path) -> list:
    """Split a file into chunks if it exceeds 2GB."""
    file_size = file_path.stat().st_size

    if file_size <= CHUNK_SIZE:
        print(f"File size {file_size} bytes, no splitting needed.")
        return [file_path]

    num_chunks = math.ceil(file_size / CHUNK_SIZE)
    print(f"File is {file_size / (1024**3):.2f} GB, splitting into {num_chunks} chunks...")

    chunk_paths = []
    with open(file_path, "rb") as f:
        for i in range(num_chunks):
            chunk_path = DOWNLOAD_DIR / f"{file_path.stem}.part{i+1:03d}{file_path.suffix}"
            data = f.read(CHUNK_SIZE)
            with open(chunk_path, "wb") as chunk_file:
                chunk_file.write(data)
            chunk_paths.append(chunk_path)
            print(f"  Created chunk {i+1}/{num_chunks}: {chunk_path.name}")

    return chunk_paths


async def send_files(file_paths: list):
    """Send files to Telegram using the user API (supports up to 2GB per file)."""
    client = TelegramClient.start(
        session=StringSession(SESSION_STRING),
        api_id=API_ID,
        api_hash=API_HASH
    )

    async with client:
        total = len(file_paths)
        for i, file_path in enumerate(file_paths):
            print(f"Sending file {i+1}/{total}: {file_path.name}")

            caption = f"📦 {file_path.name}"
            if total > 1:
                caption += f"\n\nPart {i+1} of {total}"

            await client.send_file(
                USER_ID,
                file_path,
                caption=caption,
                attributes=[DocumentAttributeFilename(file_path.name)],
                progress_callback=lambda current, total_bytes: print(
                    f"  Uploading: {current / total_bytes * 100:.1f}%", end="\r"
                )
            )
            print(f"\n  ✅ Sent: {file_path.name}")

        if total > 1:
            await client.send_message(USER_ID, f"✅ All {total} parts sent successfully!")
        else:
            await client.send_message(USER_ID, "✅ File sent successfully!")


async def notify_error(message: str):
    """Send an error message to the user on Telegram."""
    try:
        from telethon.sessions import StringSession
        client = TelegramClient(
            StringSession(SESSION_STRING),
            API_ID,
            API_HASH
        )
        async with client:
            await client.send_message(USER_ID, f"❌ Error: {message}")
    except Exception as e:
        print(f"Could not send error notification: {e}")


async def main():
    from telethon.sessions import StringSession

    print("=== Pocket Downloader ===")
    print(f"URL: {DOWNLOAD_URL}")

    try:
        # Step 1: Download
        await notify_start()
        file_path = download_file(DOWNLOAD_URL)
        print(f"Downloaded: {file_path} ({file_path.stat().st_size / (1024**2):.1f} MB)")

        # Step 2: Split if needed
        file_paths = split_file(file_path)

        # Step 3: Send to Telegram
        client = TelegramClient(
            StringSession(SESSION_STRING),
            API_ID,
            API_HASH
        )

        total = len(file_paths)
        async with client:
            for i, fp in enumerate(file_paths):
                print(f"Sending file {i+1}/{total}: {fp.name}")

                caption = f"📦 {fp.name}"
                if total > 1:
                    caption += f"\n\nPart {i+1} of {total}"

                await client.send_file(
                    USER_ID,
                    fp,
                    caption=caption,
                    attributes=[DocumentAttributeFilename(fp.name)],
                    progress_callback=lambda cur, tot: print(
                        f"  Uploading: {cur / tot * 100:.1f}%", end="\r"
                    )
                )
                print(f"\n  Sent: {fp.name}")

            if total > 1:
                await client.send_message(USER_ID, f"✅ Done! All {total} parts sent.")
            else:
                await client.send_message(USER_ID, "✅ Done! File sent successfully.")

    except Exception as e:
        print(f"ERROR: {e}")
        await notify_error(str(e))
        sys.exit(1)


async def notify_start():
    """Notify user that download has started."""
    from telethon.sessions import StringSession
    client = TelegramClient(
        StringSession(SESSION_STRING),
        API_ID,
        API_HASH
    )
    async with client:
        await client.send_message(
            USER_ID,
            f"⏳ Starting download...\n\n🔗 {DOWNLOAD_URL}"
        )


if __name__ == "__main__":
    asyncio.run(main())
