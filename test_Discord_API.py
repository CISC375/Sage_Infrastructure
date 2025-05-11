import pytest
import discord
from discord.ext import commands
import asyncio

@pytest.mark.asyncio
async def test_bot_responds_to_ping():
    bot = commands.Bot(command_prefix='!')
    
    @bot.event
    async def on_ready():
        print("Bot is ready")

    @bot.command()
    async def ping(ctx):
        await ctx.send('Pong!')

    # Simulate invoking the ping command — use a testing bot/user or mock context
    mock_ctx = ...  # You'd mock this or run a test server with a test client
    await ping(mock_ctx)
    assert mock_ctx.send.called_with('Pong!')
