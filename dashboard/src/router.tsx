import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { CreatePlanPage } from './pages/CreatePlanPage'
import WorkflowsPage from './pages/WorkflowsPage'
import AgentsPage from './pages/AgentsPage'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ChatPage from './pages/ChatPage'
import KanbanPage from './pages/KanbanPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <WorkflowsPage />,
      },
      {
        path: 'workflows',
        element: <WorkflowsPage />,
      },
      {
        path: 'plans/:id',
        element: <PlanDetailPage />,
      },
      {
        path: 'plans/new',
        element: <CreatePlanPage />,
      },
      {
        path: 'agents',
        element: <AgentsPage />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'kanban',
        element: <KanbanPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'approvals',
        element: <ApprovalsPage />,
      },
    ],
  },
])
