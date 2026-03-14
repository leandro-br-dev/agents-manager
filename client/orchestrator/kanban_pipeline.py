"""Processa kanban tasks ativas, gera planos via planning agent e cria workflows."""

from __future__ import annotations

import asyncio
import inspect
import json
import os
import re

from orchestrator import logger


def extract_plan_from_text(text: str, fallback_name: str = '') -> dict | None:
    """
    Extrai JSON de plano entre tags <plan>...</plan>.

    Args:
        text: Texto que pode conter um plano em formato JSON
        fallback_name: Nome a usar se o plano não tiver campo 'name'

    Returns:
        Dicionário do plano se encontrado e válido, None caso contrário
    """
    # Normaliza: remove code fences que possam envolver <plan>
    # Ex: ```\n<plan>...\n</plan>\n``` → <plan>...\n</plan>
    normalized = re.sub(r'```[\w]*\s*(<plan>[\s\S]*?</plan>)\s*```', r'\1', text)

    parts = normalized.split("<plan>")
    for i in range(1, len(parts)):
        closing = parts[i].find("</plan>")
        if closing == -1:
            continue
        raw = parts[i][:closing].strip()
        try:
            parsed = json.loads(raw)
            name = parsed.get('name', '')
            tasks = parsed.get('tasks', [])

            if name == 'Descriptive plan name':
                logger.info('[KanbanPipeline] Skipping template placeholder plan')
                continue

            if not isinstance(tasks, list) or len(tasks) == 0:
                logger.info(f'[KanbanPipeline] Plan has no tasks, skipping')
                continue

            # Aceita plano sem nome — usa fallback
            if not name and fallback_name:
                parsed['name'] = fallback_name
                logger.info(f'[KanbanPipeline] Plan has no name, using fallback: {fallback_name}')

            logger.info(f'[KanbanPipeline] Valid plan found: "{parsed.get("name")}" ({len(tasks)} tasks)')
            return parsed
        except (json.JSONDecodeError, KeyError) as e:
            logger.info(f'[KanbanPipeline] JSON parse failed: {type(e).__name__}: {e}')
            continue

    logger.warning(f'[KanbanPipeline] No valid <plan> found. <plan> count: {text.count("<plan>")}')
    return None


def normalize_plan_tasks(plan_data: dict) -> dict:
    """
    Normaliza o schema das tasks para o formato esperado pelo runner.

    Args:
        plan_data: Dicionário do plano com tasks em schema variável

    Returns:
        Dicionário do plano com tasks normalizadas
    """
    normalized_tasks = []
    for i, task in enumerate(plan_data.get('tasks', [])):
        # Normaliza campos com nomes alternativos
        cwd = (
            task.get('cwd') or
            task.get('workingDirectory') or
            task.get('working_directory') or
            ''
        )

        # workspace pode vir em task.workspace ou task.agent.workspace
        workspace = task.get('workspace') or ''
        if not workspace and isinstance(task.get('agent'), dict):
            workspace = task['agent'].get('workspace', '')

        # depends_on pode vir como dependencies
        depends_on = (
            task.get('depends_on') or
            task.get('dependencies') or
            []
        )

        # Garante que depends_on é lista de strings
        if isinstance(depends_on, list):
            depends_on = [str(d) for d in depends_on]

        normalized_tasks.append({
            'id': task.get('id') or f'task-{i+1}',
            'name': task.get('name') or task.get('title') or f'Task {i+1}',
            'prompt': task.get('prompt') or task.get('description') or task.get('instructions') or '',
            'cwd': cwd,
            'workspace': workspace,
            'tools': task.get('tools') or ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
            'permission_mode': task.get('permission_mode') or 'acceptEdits',
            'depends_on': depends_on,
        })

    plan_data['tasks'] = normalized_tasks
    return plan_data


async def find_planner_workspace(project_id: str, client) -> str | None:
    """
    Encontra o workspace do agente planner do projeto.

    Args:
        project_id: ID do projeto
        client: DaemonClient instance

    Returns:
        Caminho do workspace do planner ou None se não encontrado
    """
    try:
        url = f"/projects/{project_id}/agents-context"
        logger.info(f'[KanbanPipeline] Calling: {url}')
        response = await client._get(url)
        logger.info(f'[KanbanPipeline] Raw response type: {type(response).__name__}')
        logger.info(f'[KanbanPipeline] Raw response: {str(response)[:300] if response else "None"}')

        # A API pode retornar {"data": [...]} ou diretamente [...]
        if isinstance(response, dict):
            agents = response.get('data') or []
        elif isinstance(response, list):
            agents = response
        else:
            agents = []

        if not agents:
            logger.warning(f'[KanbanPipeline] No agents returned for project {project_id}')
            return None

        logger.info(f'[KanbanPipeline] Agents for project: {[(a.get("name"), a.get("role")) for a in agents]}')

        planners = [a for a in agents if a.get('role') == 'planner']
        if not planners:
            logger.warning(f'[KanbanPipeline] No planner among agents: {[a.get("name") for a in agents]}')
            return None

        workspace = planners[0].get('workspace_path')
        logger.info(f'[KanbanPipeline] Found planner workspace: {workspace}')
        return workspace
    except Exception as e:
        logger.warning(f'Could not find planner workspace: {type(e).__name__}: {e}')
        return None


async def process_kanban_task(task: dict, client) -> None:
    """
    Processa uma kanban task: roda planning agent e cria workflow.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    task_id = task["id"]
    project_id = task["project_id"]
    title = task.get("title", "Untitled")
    description = task.get("description", "")
    project_settings = task.get("project_settings", {})
    if isinstance(project_settings, str):
        try:
            project_settings = json.loads(project_settings)
        except Exception:
            project_settings = {}

    logger.info(f"[KanbanPipeline] Starting process for task {task_id}")

    # Marca como 'planning'
    await client.update_kanban_pipeline(project_id, task_id, pipeline_status="planning")

    try:
        # Log cada etapa para diagnóstico
        logger.info('[KanbanPipeline] Step 1: finding planner workspace...')
        planner_workspace = await find_planner_workspace(project_id, client)
        logger.info(f'[KanbanPipeline] Planner workspace: {planner_workspace}')

        if not planner_workspace:
            raise ValueError(f'No planner agent with role=planner found for project {project_id}. Assign a planner agent to this project first.')

        logger.info('[KanbanPipeline] Step 2: fetching agents context...')
        agents_context = await client.get_project_agents_context(project_id)

        logger.info('[KanbanPipeline] Step 3: preparing planning prompt...')
        # Prompt para o planning agent
        base_prompt = f"""You are processing a task from the project kanban board.

Task Title: {title}
Task Description: {description}

{agents_context}

Analyze the task, read the relevant codebase, and generate a precise execution plan.
Output the plan using the <plan>...</plan> format as instructed in your planning skill."""

        # Lê o SKILL.md do planner como fallback
        skill_path = os.path.join(planner_workspace, '.claude', 'skills', 'planning', 'SKILL.md')
        skill_content = ''
        if os.path.exists(skill_path):
            with open(skill_path) as f:
                skill_content = f.read()
            logger.info(f'[KanbanPipeline] Loaded planning skill ({len(skill_content)} chars)')
        else:
            logger.warning(f'[KanbanPipeline] Planning skill not found at {skill_path}')

        # Executa o planning agent via SDK
        logger.info('[KanbanPipeline] Step 4: importing SDK and preparing options...')
        from claude_agent_sdk import query, ClaudeAgentOptions

        # Get valid SDK fields
        valid_fields = set(inspect.signature(ClaudeAgentOptions.__init__).parameters.keys()) - {"self"}

        opts_kwargs = {
            "cwd": planner_workspace,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project", "local"],
        }
        # Filtra apenas campos válidos
        opts_kwargs = {k: v for k, v in opts_kwargs.items() if k in valid_fields}

        # Adiciona skill ao prompt se setting_sources não disponível
        prompt = base_prompt
        if skill_content and 'setting_sources' not in valid_fields:
            logger.info('[KanbanPipeline] setting_sources unavailable, injecting skill into prompt')
            prompt = f"{skill_content}\n\n---\n\n{base_prompt}"

        opts = ClaudeAgentOptions(**opts_kwargs)

        full_response = ""
        logger.info('[KanbanPipeline] Step 5: running planning agent...')
        async for event in query(prompt=prompt, options=opts):
            event_type = type(event).__name__
            if event_type == "AssistantMessage":
                for block in getattr(event, "content", []):
                    if hasattr(block, "text"):
                        full_response += block.text
            elif event_type == "ResultMessage":
                result_text = getattr(event, "result", "") or ""
                if result_text:
                    full_response += result_text

        logger.info(f'[KanbanPipeline] Step 6: planning agent response length: {len(full_response)}')

        # Salva resposta para diagnóstico
        log_path = f'/tmp/kanban_agent_response_{task_id[:8]}.txt'
        with open(log_path, 'w') as f:
            f.write(full_response)
        logger.info(f'[KanbanPipeline] Response saved to {log_path}')

        # Log dos primeiros 500 chars e dos últimos 500 chars
        logger.info(f'[KanbanPipeline] Response start: {repr(full_response[:500])}')
        logger.info(f'[KanbanPipeline] Response end: {repr(full_response[-500:])}')
        logger.info(f'[KanbanPipeline] Has <plan>: {"<plan>" in full_response}')
        logger.info(f'[KanbanPipeline] Has </plan>: {"</plan>" in full_response}')

        # Extrai o plano da resposta
        logger.info('[KanbanPipeline] Step 7: extracting plan from response...')
        plan_data = extract_plan_from_text(full_response, fallback_name=title)
        if not plan_data:
            raise ValueError("Planning agent did not produce a valid <plan> block")

        # Normaliza schema das tasks
        plan_data = normalize_plan_tasks(plan_data)
        logger.info(f'[KanbanPipeline] Tasks after normalization: {[(t["id"], t["name"][:30]) for t in plan_data["tasks"]]}')

        logger.info(
            f"[KanbanPipeline] Step 8: plan extracted: {plan_data['name']} "
            f"({len(plan_data['tasks'])} tasks)"
        )

        # Garanta que tasks têm IDs
        for i, t in enumerate(plan_data["tasks"]):
            if not t.get("id"):
                t["id"] = f"task-{i+1}"

        # Adiciona project_id ao plano
        plan_data["project_id"] = project_id
        plan_data["kanban_task_id"] = task_id  # para rastreabilidade

        # Cria o workflow
        logger.info('[KanbanPipeline] Step 9: creating workflow from plan...')
        created_plan = await client.create_plan_from_data(plan_data)
        plan_id = created_plan.get("id")
        if not plan_id:
            raise ValueError("Failed to create workflow from plan")

        logger.info(f'[KanbanPipeline] Step 10: workflow created: {plan_id}')

        # Vincula workflow à kanban task
        logger.info('[KanbanPipeline] Step 11: linking workflow to kanban task...')
        await client.update_kanban_pipeline(
            project_id, task_id, pipeline_status="awaiting_approval", workflow_id=plan_id
        )

        # Auto-aprova se configurado
        auto_approve = project_settings.get("auto_approve_workflows", False)
        if auto_approve:
            logger.info('[KanbanPipeline] Step 12: auto-approving workflow...')
            await client.start_plan_async(plan_id)
            await client.update_kanban_pipeline(project_id, task_id, pipeline_status="running")
            logger.success(
                f"[KanbanPipeline] Workflow auto-approved and started: {plan_id}"
            )
        else:
            logger.info(f'[KanbanPipeline] Step 12: workflow awaiting manual approval: {plan_id}')

    except Exception as e:
        logger.error(f'[KanbanPipeline] Unhandled error in task {task_id}: {type(e).__name__}: {e}')
        # Garante que a task não fica presa em 'planning' para sempre
        try:
            await client.update_kanban_pipeline(
                project_id, task_id,
                pipeline_status="failed",
                error_message=f'Unhandled error: {str(e)}'
            )
        except Exception:
            pass


async def sync_workflow_status(client) -> None:
    """
    Sincroniza status de workflows vinculados a kanban tasks.

    Verifica se workflows vinculados a kanban tasks concluíram e atualiza
    o status das tasks correspondentes.

    Args:
        client: DaemonClient instance
    """
    try:
        projects = await client.get_all_projects()
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue

            # Busca tasks com pipeline 'running' ou 'awaiting_approval'
            try:
                tasks = await client._get(f"/kanban/{project_id}")
                if not isinstance(tasks, list):
                    continue
            except Exception as e:
                logger.warning(f"Failed to fetch kanban tasks for project {project_id}: {e}")
                continue

            active_tasks = [
                t for t in tasks
                if t.get("pipeline_status") in ("running", "awaiting_approval")
                and t.get("workflow_id")
            ]

            for task in active_tasks:
                workflow_id = task["workflow_id"]
                try:
                    plan = await client._get(f"/plans/{workflow_id}")
                    if not isinstance(plan, dict):
                        continue

                    plan_status = plan.get("status")
                    task_id = task["id"]

                    if plan_status == "success" and task.get("column") != "done":
                        await client._patch(f"/kanban/{project_id}/{task_id}", {
                            "column": "done",
                            "pipeline_status": "done"
                        })
                        logger.success(f"[KanbanPipeline] Auto-moved task to done: {task_id}")

                    elif plan_status == "failed" and task.get("pipeline_status") != "failed":
                        await client.update_kanban_pipeline(
                            project_id, task_id,
                            pipeline_status="failed",
                            error_message="Workflow failed"
                        )

                    elif plan_status == "pending" and task.get("pipeline_status") == "awaiting_approval":
                        # Usuário aprovou manualmente no dashboard
                        await client.update_kanban_pipeline(
                            project_id, task_id,
                            pipeline_status="running"
                        )

                except Exception as e:
                    logger.warning(f"Failed to sync workflow {workflow_id}: {e}")
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Sync error: {e}")


async def poll_kanban_tasks(client) -> None:
    """
    Verifica todos os projetos por kanban tasks ativas sem workflow.

    Args:
        client: DaemonClient instance
    """
    try:
        projects = await client.get_all_projects()
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue
            pending = await client.get_pending_kanban_tasks(project_id)
            for task in pending:
                # Processa em background sem bloquear o daemon loop
                asyncio.create_task(_run_kanban_task(task, client))

        # Sincroniza status de workflows ativos
        await sync_workflow_status(client)
    except Exception as e:
        logger.warning(f"[KanbanPipeline] Poll error: {e}")


# Rastreia tasks em processamento para evitar duplicatas
_running_kanban_tasks: set = set()


async def _run_kanban_task(task: dict, client) -> None:
    """
    Wrapper para processar kanban task com tracking.

    Args:
        task: Kanban task data
        client: DaemonClient instance
    """
    task_id = task["id"]
    if task_id in _running_kanban_tasks:
        logger.debug(f'[KanbanPipeline] Task {task_id} already running, skipping')
        return
    _running_kanban_tasks.add(task_id)
    try:
        await process_kanban_task(task, client)
    except Exception as e:
        logger.error(f'[KanbanPipeline] Unhandled error in task {task_id}: {type(e).__name__}: {e}')
        # Garante que a task não fica presa em 'planning' para sempre
        try:
            await client.update_kanban_pipeline(
                task['project_id'], task_id,
                pipeline_status='failed',
                error_message=f'Unhandled error: {str(e)}'
            )
        except Exception:
            pass
    finally:
        _running_kanban_tasks.discard(task_id)
