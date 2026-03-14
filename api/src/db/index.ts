import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'database.db')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = new Database(dbPath)

// Initialize database schema
export function initDatabase() {
  // Create agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT,
      output TEXT,
      error TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    )
  `)

  // Create plans table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tasks TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      client_id TEXT,
      result TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create plan_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      task_id TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create approvals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      input TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      responded_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create environments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'local-wsl',
      project_path TEXT NOT NULL,
      agent_workspace TEXT NOT NULL,
      ssh_config TEXT,
      env_vars TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create project_agents table (links projects to workspace/agent paths)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_agents (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      workspace_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, workspace_path)
    )
  `)

  // Create agent_environments table (links workspaces to environments)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_environments (
        workspace_path TEXT NOT NULL,
        environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (workspace_path, environment_id)
      );
    `)
  } catch (e) {
    // Table already exists - ignore error
  }

  // Add project_id column to plans table if it doesn't exist
  try {
    db.exec('ALTER TABLE plans ADD COLUMN project_id TEXT')
  } catch (e: any) {
    // Column already exists - ignore error
    if (!e.message.includes('duplicate column name')) {
      console.warn('Warning adding project_id column:', e.message)
    }
  }

  // Add type column to plans table if it doesn't exist
  try {
    db.exec("ALTER TABLE plans ADD COLUMN type TEXT DEFAULT 'workflow'")
  } catch (e: any) {
    // Column already exists - ignore error
    if (!e.message.includes('duplicate column name')) {
      console.warn('Warning adding type column:', e.message)
    }
  }

  // Add structured_output column to plans table if it doesn't exist
  try {
    db.exec('ALTER TABLE plans ADD COLUMN structured_output TEXT')
  } catch (e: any) {
    // Column already exists - ignore error
    if (!e.message.includes('duplicate column name')) {
      console.warn('Warning adding structured_output column:', e.message)
    }
  }

  // Create chat_sessions table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_id TEXT,
        workspace_path TEXT NOT NULL,
        environment_id TEXT,
        sdk_session_id TEXT,
        status TEXT DEFAULT 'idle',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `)
  } catch (e) {
    // Table already exists - ignore error
  }

  // Create chat_messages table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)
  } catch (e) {
    // Table already exists - ignore error
  }

  // Create kanban_tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      column TEXT NOT NULL DEFAULT 'backlog' CHECK(column IN ('backlog','active','in_progress','done')),
      priority INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
      order_index INTEGER NOT NULL DEFAULT 0,
      workflow_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
      result_status TEXT CHECK(result_status IN ('success','partial','needs_rework')),
      result_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Create workspace_roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_roles (
      workspace_path TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'coder' CHECK(role IN ('planner','coder','reviewer','tester','debugger','devops','generic'))
    );
  `)

  console.log('Database initialized successfully')
}

// Initialize on import
initDatabase()
