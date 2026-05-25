import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MetricCard } from '../components/MetricCard'
import { api } from '../lib/api'
import { money, titleCase } from '../lib/format'
import type { Trip } from '../lib/types'

const columnHelper = createColumnHelper<Trip>()

export function DashboardPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }])
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => api.dashboardSummary() })
  const trips = useQuery({ queryKey: ['dashboard', 'trips'], queryFn: () => api.dashboardTrips() })
  const messages = useQuery({ queryKey: ['dashboard', 'messages'], queryFn: () => api.dashboardMessages() })

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Trip',
        cell: (info) => <strong>{info.getValue()}</strong>,
      }),
      columnHelper.accessor('destination', {
        header: 'Destination',
      }),
      columnHelper.accessor('travelerType', {
        header: 'Traveler',
        cell: (info) => titleCase(info.getValue()),
      }),
      columnHelper.accessor('budgetLevel', {
        header: 'Budget',
        cell: (info) => titleCase(info.getValue()),
      }),
      columnHelper.accessor('estimatedCost', {
        header: 'Value',
        cell: (info) => money(info.getValue()),
      }),
      columnHelper.accessor('confidence', {
        header: 'Confidence',
        cell: (info) => `${info.getValue()}%`,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => titleCase(info.getValue()),
      }),
      columnHelper.accessor('updatedAt', {
        header: 'Updated',
        cell: (info) => new Date(info.getValue()).toLocaleDateString('en-SG'),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: trips.data ?? [],
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="page">
      <section className="page-title">
        <h1>
          Operator <span>dashboard</span>
        </h1>
        <p>Use this view to inspect demand signals, generated trip value, message volume, and traveler segments.</p>
      </section>

      {summary.isLoading ? (
        <LoadingState />
      ) : summary.isError ? (
        <ErrorState error={summary.error} />
      ) : summary.data ? (
        <section className="metrics-row">
          <MetricCard label="Trips" value={summary.data.trips} detail="stored locally" />
          <MetricCard label="Messages" value={summary.data.messages} detail="planning turns" />
          <MetricCard label="Ready" value={summary.data.readyTrips} detail="conversion proxy" />
          <MetricCard label="Avg value" value={money(summary.data.averageTripValue)} detail="simulated GMV" />
        </section>
      ) : null}

      <section className="dashboard-layout">
        <div className="table-panel">
          <div className="table-toolbar">
            <div>
              <h2>Trip pipeline</h2>
              <p>TanStack Table with global filtering and sortable columns.</p>
            </div>
            <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Filter rows" />
          </div>
          {trips.isLoading ? (
            <LoadingState />
          ) : trips.isError ? (
            <ErrorState error={trips.error} />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          <button type="button" onClick={header.column.getToggleSortingHandler()}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[header.column.getIsSorted() as string] ?? null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="side-panel">
          <h2>Recent intent</h2>
          {messages.isLoading ? (
            <LoadingState />
          ) : messages.isError ? (
            <ErrorState error={messages.error} />
          ) : (
            <div className="compact-messages">
              {messages.data?.slice(0, 10).map((message) => (
                <div key={message.id} className={`compact-message ${message.role}`}>
                  <strong>{message.role}</strong>
                  <span>{message.content}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}
