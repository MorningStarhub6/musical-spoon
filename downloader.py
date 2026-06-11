import os
import sys
import math
import asyncio
import subprocess
from pathlib import Path
from telethon import TelegramClient
from telethon.sessions import StringSession

# These values are injected by GitHub Actions from your secrets
API_ID = int(os.environ["TELEGRAM_API_ID"])
API_HASH = os.environ["TELEGRAM_API_HASH"]
SESSION_STRING = os.environ["TELEGRAM_SESSION"]
USER_ID = int(os.environ["TELEGRAM_USER_ID"])
DOWNLOAD_URL = os.environ["DOWNLOAD_URL"]

# 2GB in bytes
CHUNK_SIZE = 2 * 1024 * 1024 * 1024

DOWNLOAD_DIR = Path("/tmp/pocket_downloader")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def download_file(url: str) -> Path:
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
        ]
    )
    if result.returncode != 0:
        raise RuntimeError(f"aria2c failed with return code {result.returncode}")

    files = [f for f in DOWNLOAD_DIR.iterdir() if not f.suffix == ".aria2"]
    if not files:
        raise RuntimeError("No file found after download")

    return max(files, key=lambda f: f.stat().st_mtime)


def split_file(file_path: Path) -> list:
    file_size = file_path.stat().st_size

    if file_size <= CHUNK_SIZE:
        print(f"File size {file_size / (1024**2):.1f} MB, no splitting needed.")
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


async def main():
    # Use StringSession so Telethon never asks for phone number
    client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)

    await client.connect()

    if not await client.is_user_authorized():
        raise RuntimeError("Session string is invalid or expired. Please regenerate it.")

    print("=== Pocket Downloader ===")
    print(f"URL: {DOWNLOAD_URL}")

    try:
        # Notify start
        await client.send_message(USER_ID, f"⏳ Starting download...\n\n🔗 {DOWNLOAD_URL}")

        # Download
        file_path = download_file(DOWNLOAD_URL)
        print(f"Downloaded: {file_path} ({file_path.stat().st_size / (1024**2):.1f} MB)")

        # Split if needed
        file_paths = split_file(file_path)

        # Send to Telegram
        total = len(file_paths)
        for i, fp in enumerate(file_paths):
            print(f"Sending file {i+1}/{total}: {fp.name}")

            caption = f"📦 {fp.name}"
            if total > 1:
                caption += f"\n\nPart {i+1} of {total}"

            await client.send_file(
                USER_ID,
                fp,
                caption=caption,
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
        try:
            await client.send_message(USER_ID, f"❌ Error: {e}")
        except:
            pass
        sys.exit(1)
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())