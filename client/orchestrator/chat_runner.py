"""
Chat runner: executa uma mensagem de sessão usando o Claude Agent SDK.

Mantém o sdk_session_id para permitir conversas iterativas.
"""

from __future__ import annotations

import json
import re
from typing import Callable, Awaitable

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)

from orchestrator import logger
from orchestrator.plan import extract_structured_output


# Structured output patterns for quick actions
STRUCTURED_PATTERNS = [
    ('plan', r'<plan>\s*({.*?})\s*</plan>'),
    ('review', r'<review>\s*({.*?})\s*</review>'),
    ('diagnosis', r'<diagnosis>\s*({.*?})\s*</diagnosis>'),
]


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
    options_kwargs = {
        "cwd": cwd,
        "workspace": workspace_path,
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
                    if block_type == 'text':
                        text = getattr(block, 'text', '')
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
