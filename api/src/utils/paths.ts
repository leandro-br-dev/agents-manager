import path from 'path'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Path for an agent workspace.
 * Structure: {basePath}/{projectSlug}/agents/{agentName}/
 */
export function agentWorkspacePath(
  basePath: string,
  projectSlug: string,
  agentName: string
): string {
  return path.join(basePath, slugify(projectSlug), 'agents', slugify(agentName))
}

/**
 * Path for an environment's auto-generated agent.
 * Structure: {basePath}/{projectSlug}/{envSlug}/agent-coder/
 * (environments keep the current structure — they are tied to a specific env)
 */
export function envAgentPath(
  basePath: string,
  projectSlug: string,
  envSlug: string
): string {
  return path.join(basePath, slugify(projectSlug), slugify(envSlug), 'agent-coder')
}
