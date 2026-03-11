import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import { PlansPage } from './pages/PlansPage'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { CreatePlanPage } from './pages/CreatePlanPage'
import WorkflowsPage from './pages/WorkflowsPage'
import AgentsPage from './pages/AgentsPage'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import ApprovalsPage from './pages/ApprovalsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <PlansPage />,
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
        path: 'workflows',
        element: <WorkflowsPage />,
      },
      {
        path: 'agents',
        element: <AgentsPage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
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
