"""
Chat runner: executa uma mensagem de sessão usando o Claude Agent SDK.

Mantém o sdk_session_id para permitir conversas iterativas.
"""

from __future__ import annotations

import os
import subprocess
from typing import Callable, Awaitable

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)
from claude_agent_sdk._errors import ProcessError

from orchestrator import logger
from orchestrator.runner import extract_structured_output, STRUCTURED_PATTERNS


async def run_chat_turn(
    *,
    session_id: str,
    message: str,
    workspace_path: str,
    cwd: str,
    sdk_session_id: str | None = None,
    on_sdk_session: Callable[[str], Awaitable[None]] | None = None,
    on_response: Callable[[str, dict | None], Awaitable[None]] | None = None,
    log_callback: Callable[[list], Awaitable[None]] | None = None,
) -> str | None:
    """
    Executa um turno da conversa.

    Retorna o sdk_session_id gerado (para persistir no banco).

    Args:
        session_id: ID da sessão no banco de dados
        message: Mensagem do usuário
        workspace_path: Caminho do workspace para o agente
        cwd: Diretório de trabalho para o agente
        sdk_session_id: ID da sessão do SDK (para retomar conversa)
        on_sdk_session: Callback chamado quando novo sdk_session_id é gerado
        on_response: Callback chamado quando resposta completa é recebida
        log_callback: Callback para streaming de logs em tempo real

    Returns:
        O sdk_session_id (novo ou existente) para persistência
    """
    # Build options for the SDK
    # Note: workspace_path is used for settings.local.json discovery, but the SDK
    # doesn't have a "workspace" field. The cwd field is used for working directory
    # and settings discovery. If workspace_path != cwd, we should use workspace_path
    # as cwd to ensure settings are loaded correctly.
    workspace_settings = os.path.join(workspace_path, '.claude', 'settings.local.json')
    effective_cwd = workspace_path if os.path.exists(workspace_settings) else cwd

    options_kwargs = {
        "cwd": effective_cwd,
        "permission_mode": "acceptEdits",
    }

    # Se temos um sdk_session_id, adicionar para retomar a sessão
    # O SDK usa resume internamente quando session_id é passado
    if sdk_session_id:
        options_kwargs["resume"] = sdk_session_id

    options = ClaudeAgentOptions(**options_kwargs)

    captured_texts = []
    final_result = None
    new_sdk_session_id = None

    try:
        async for message_obj in query(prompt=message, options=options):
            msg_type = getattr(message_obj, 'type', None) or type(message_obj).__name__

            if msg_type in ('assistant', 'AssistantMessage') or hasattr(message_obj, 'content'):
                content = getattr(message_obj, 'content', [])
                for block in (content if isinstance(content, list) else []):
                    block_type = getattr(block, 'type', None)
                    # Capture text blocks - type might be 'text' or None (for text-only blocks)
                    if block_type in ('text', None) and hasattr(block, 'text'):
                        text = getattr(block, 'text', '')
                        if text:  # Only append non-empty text
                            captured_texts.append(text)
                            if log_callback:
                                await log_callback([{
                                    'session_id': session_id,
                                    'role': 'assistant_chunk',
                                    'message': text
                                }])

            elif msg_type in ('result', 'ResultMessage') or isinstance(message_obj, ResultMessage):
                final_result = message_obj
                # Capturar sdk_session_id do resultado
                new_sdk_session_id = (
                    getattr(message_obj, 'session_id', None) or
                    getattr(message_obj, 'sessionId', None)
                )

    except ProcessError as e:
        # Enhanced error handling for ProcessError from SDK
        error_details = str(e)

        # Extract additional information from ProcessError
        if hasattr(e, 'exit_code') and e.exit_code:
            error_details += f"\nExit code: {e.exit_code}"

        if hasattr(e, 'stderr'):
            error_details += f"\nStderr: {e.stderr}"

        # Provide helpful context for common errors
        if 'nested session' in str(e).lower() or 'CLAUDECODE' in str(e):
            error_details += "\n\n💡 Tip: The daemon cannot run inside a Claude Code session. " \
                           "Ensure CLAUDECODE environment variable is not set when starting the daemon."

        # Check for ANTHROPIC_BASE_URL connectivity issues
        settings_path = os.path.join(workspace_path, '.claude', 'settings.local.json')
        if os.path.exists(settings_path):
            try:
                import json as _json
                with open(settings_path) as f:
                    settings = _json.load(f)
                base_url = settings.get('env', {}).get('ANTHROPIC_BASE_URL', '')
                if base_url and 'localhost' in base_url:
                    # Try to check if the service is accessible
                    try:
                        import urllib.request
                        urllib.request.urlopen(base_url, timeout=2)
                    except Exception as url_err:
                        error_details += f"\n\n⚠️  ANTHROPIC_BASE_URL={base_url} is not accessible: {url_err}"
                        error_details += "\n   Ensure the service (e.g., llm-router) is running."
            except Exception:
                pass  # Ignore errors when trying to provide helpful context

        logger.error(f'Chat turn ProcessError: {error_details}')
        if on_response:
            await on_response(f'❌ {error_details}', None)
        return sdk_session_id

    except Exception as e:
        logger.error(f'Chat turn error: {e}')
        if on_response:
            await on_response(str(e), None)
        return sdk_session_id

    # Montar resposta completa
    full_text = '\n'.join(captured_texts)
    structured = extract_structured_output(full_text)

    # Notificar via callback
    if on_response:
        await on_response(full_text, structured)

    # Notificar novo sdk_session_id se mudou
    if new_sdk_session_id and new_sdk_session_id != sdk_session_id:
        if on_sdk_session:
            await on_sdk_session(new_sdk_session_id)

    return new_sdk_session_id or sdk_session_id
