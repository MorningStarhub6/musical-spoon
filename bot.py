import os
import logging
import httpx
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.environ["BOT_TOKEN"]
ALLOWED_USER_ID = int(os.environ["TELEGRAM_USER_ID"])
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPO = os.environ["GITHUB_REPO"]  # format: username/reponame


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    # Only respond to your messages
    if user_id != ALLOWED_USER_ID:
        await update.message.reply_text("Sorry, you are not authorized to use this bot.")
        return

    text = update.message.text.strip()

    # Basic URL check
    if not (text.startswith("http://") or text.startswith("https://")):
        await update.message.reply_text(
            "Please send a direct download URL starting with http:// or https://"
        )
        return

    await update.message.reply_text(f"Got it! Triggering download for:\n{text}")

    # Trigger GitHub Actions workflow
    success = await trigger_github_action(text)

    if success:
        await update.message.reply_text(
            "✅ GitHub Actions workflow started!\n\n"
            "The file will be sent to you here once it's downloaded. "
            "This usually takes a few minutes depending on the file size."
        )
    else:
        await update.message.reply_text(
            "❌ Failed to trigger the workflow. "
            "Please check your GitHub token and repo settings."
        )


async def trigger_github_action(url: str) -> bool:
    """Call GitHub API to trigger the download workflow."""
    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/download.yml/dispatches"

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    payload = {
        "ref": "main",
        "inputs": {
            "url": url
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(api_url, json=payload, headers=headers)

    if response.status_code == 204:
        return True
    else:
        logging.error(f"GitHub API error: {response.status_code} - {response.text}")
        return False


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()