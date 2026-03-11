import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlansList } from './PlansList';
import * as ReactRouter from 'react-router';
import * as plansApi from '@/api/plans';

const mockPlans = [
  {
    id: '1',
    name: 'Test Plan 1',
    status: 'pending',
    tasks: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Test Plan 2',
    status: 'running',
    tasks: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

vi.mock('@/api/plans', () => ({
  useGetPlans: vi.fn(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ReactRouter.BrowserRouter>{ui}</ReactRouter.BrowserRouter>
    </QueryClientProvider>
  );
}

describe('PlansList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plans table with correct columns', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PlansList />);

    expect(screen.getByText('Test Plan 1')).toBeInTheDocument();
    expect(screen.getByText('Test Plan 2')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Created At')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders status badges with correct colors', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PlansList />);

    const pendingBadge = screen.getByText('pending');
    const runningBadge = screen.getByText('running');

    expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(runningBadge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('renders view button for each plan', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PlansList />);

    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });

  it('displays loading state when isLoading is true', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    renderWithProviders(<PlansList />);

    expect(screen.getByText('Loading plans...')).toBeInTheDocument();
  });

  it('displays error state when there is an error', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch'),
    } as any);

    renderWithProviders(<PlansList />);

    expect(screen.getByText(/Error loading plans/)).toBeInTheDocument();
  });

  it('displays empty state when there are no plans', () => {
    vi.mocked(plansApi.useGetPlans).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    renderWithProviders(<PlansList />);

    expect(screen.getByText('No plans found')).toBeInTheDocument();
    expect(screen.getByText('Create your first plan')).toBeInTheDocument();
  });
});
