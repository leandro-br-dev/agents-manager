import { Link } from 'react-router';
import { RefreshCw, Trash2, Upload, Loader2 } from 'lucide-react';
import { useGetPlans, useDeletePlan, useCreatePlan } from '@/api/plans';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

interface StatusBadgeProps {
  status: keyof typeof statusColors;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status]
      )}
    >
      {status}
    </span>
  );
}

export function PlansList() {
  const { data: plans, isLoading, error, refetch, isFetching } = useGetPlans();
  const deletePlan = useDeletePlan();
  const importPlan = useCreatePlan();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Validar estrutura mínima
      if (!json.name || !Array.isArray(json.tasks)) {
        alert('JSON inválido: deve ter "name" (string) e "tasks" (array)');
        return;
      }

      // Criar plano via API
      await importPlan.mutateAsync({
        name: json.name,
        tasks: json.tasks,
      });

      // Reset input para permitir reimport do mesmo arquivo
      e.target.value = '';
    } catch (err) {
      alert(`Erro ao importar: ${err instanceof Error ? err.message : 'JSON inválido'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading plans: {(error as Error).message}</div>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-gray-500 mb-4">No plans found</div>
        <Link
          to="/plans/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Create your first plan
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h2 className="text-base font-semibold leading-7 text-gray-900">Plans</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
            title="Refresh plans"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 ${importPlan.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {importPlan.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import JSON
              </>
            )}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJson}
              disabled={importPlan.isPending}
            />
          </label>
          <Link
            to="/plans/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            New Plan
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Name
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Tasks
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Created At
              </th>
              <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                  {plan.name}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {plan.status === 'running' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <span className="animate-spin h-3 w-3 border border-blue-700 border-t-transparent rounded-full" />
                      running
                    </span>
                  ) : (
                    <StatusBadge status={plan.status} />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {plan.tasks.length}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {new Date(plan.created_at).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      to={`/plans/${plan.id}`}
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      View
                    </Link>
                    {confirmId === plan.id ? (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Excluir?</span>
                        <button
                          onClick={() => {
                            deletePlan.mutate(plan.id);
                            setConfirmId(null);
                          }}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Não
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(plan.id)}
                        disabled={plan.status === 'running'}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={plan.status === 'running' ? 'Não é possível excluir plano em execução' : 'Excluir plano'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
