"""Processa kanban tasks ativas, gera planos via planning agent e cria workflows."""

from __future__ import annotations

import asyncio
import inspect
import json

from orchestrator import logger


def extract_plan_from_text(text: str) -> dict | None:
    """
    Extrai JSON de plano entre tags <plan>...</plan>.

    Args:
        text: Texto que pode conter um plano em formato JSON

    Returns:
        Dicionário do plano se encontrado e válido, None caso contrário
    """
    parts = text.split("<plan>")
    for i in range(1, len(parts)):
        closing = parts[i].find("</plan>")
        if closing == -1:
            continue
        raw = parts[i][:closing].strip()
        try:
            parsed = json.loads(raw)
            if (
                parsed.get("name")
                and parsed["name"] != "Descriptive plan name"
                and isinstance(parsed.get("tasks"), list)
                and len(parsed["tasks"]) > 0
            ):
                return parsed
        except (json.JSONDecodeError, KeyError):
            continue
    return None


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
        raw_agents = await client._get(f"/api/projects/{project_id}/agents-context")
        handled = client._handle_response(raw_agents)
        if handled.error:
            return None

        agents = handled.data or []
        planners = [a for a in agents if a.get("role") == "planner"]
        if planners:
            return planners[0].get("workspace_path")
    except Exception as e:
        logger.warning(f"Could not find planner workspace: {e}")
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

    logger.info(f"[KanbanPipeline] Processing task: {title} ({task_id})")

    # Marca como 'planning'
    await client.update_kanban_pipeline(project_id, task_id, pipeline_status="planning")

    try:
        # Encontra o planning agent do projeto
        planner_workspace = await find_planner_workspace(project_id, client)
        if not planner_workspace:
            raise ValueError(f"No planner agent found for project {project_id}")

        logger.info(f"[KanbanPipeline] Using planner workspace: {planner_workspace}")

        # Monta o contexto de agentes disponíveis
        agents_context = await client.get_project_agents_context(project_id)

        # Prompt para o planning agent
        prompt = f"""You are processing a task from the project kanban board.

Task Title: {title}
Task Description: {description}

{agents_context}

Analyze the task, read the relevant codebase, and generate a precise execution plan.
Output the plan using the <plan>...</plan> format as instructed in your planning skill."""

        # Executa o planning agent via SDK
        from claude_agent_sdk import query, ClaudeCodeOptions

        # Get valid SDK fields
        valid_fields = set(inspect.signature(ClaudeCodeOptions.__init__).parameters.keys()) - {"self"}

        opts_kwargs = {
            "cwd": planner_workspace,
            "permission_mode": "acceptEdits",
            "setting_sources": ["project", "local"],
        }
        # Filtra apenas campos válidos
        opts_kwargs = {k: v for k, v in opts_kwargs.items() if k in valid_fields}
        opts = ClaudeCodeOptions(**opts_kwargs)

        full_response = ""
        logger.info("[KanbanPipeline] Running planning agent...")
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

        logger.info(f"[KanbanPipeline] Planning agent response length: {len(full_response)}")

        # Extrai o plano da resposta
        plan_data = extract_plan_from_text(full_response)
        if not plan_data:
            raise ValueError("Planning agent did not produce a valid <plan> block")

        logger.info(
            f"[KanbanPipeline] Plan extracted: {plan_data['name']} "
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
        created_plan = await client.create_plan_from_data(plan_data)
        plan_id = created_plan.get("id")
        if not plan_id:
            raise ValueError("Failed to create workflow from plan")

        logger.info(f"[KanbanPipeline] Workflow created: {plan_id}")

        # Vincula workflow à kanban task
        await client.update_kanban_pipeline(
            project_id, task_id, pipeline_status="awaiting_approval", workflow_id=plan_id
        )

        # Auto-aprova se configurado
        auto_approve = project_settings.get("auto_approve_workflows", False)
        if auto_approve:
            await client.start_plan_async(plan_id)
            await client.update_kanban_pipeline(project_id, task_id, pipeline_status="running")
            logger.success(
                f"[KanbanPipeline] Workflow auto-approved and started: {plan_id}"
            )
        else:
            logger.info(f"[KanbanPipeline] Workflow awaiting manual approval: {plan_id}")

    except Exception as e:
        logger.error(f"[KanbanPipeline] Error processing task {task_id}: {e}")
        await client.update_kanban_pipeline(
            project_id, task_id, pipeline_status="failed", error_message=str(e)
        )


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
                raw_tasks = await client._get(f"/kanban/{project_id}")
                handled = client._handle_response(raw_tasks)
                tasks = handled.data if not handled.error else []
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
                    raw_plan = await client._get(f"/plans/{workflow_id}")
                    handled_plan = client._handle_response(raw_plan)

                    if handled_plan.error or not handled_plan.data:
                        continue

                    plan = handled_plan.data
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
        return
    _running_kanban_tasks.add(task_id)
    try:
        await process_kanban_task(task, client)
    finally:
        _running_kanban_tasks.discard(task_id)
