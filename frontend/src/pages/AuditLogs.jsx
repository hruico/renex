import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/audit-logs?page=${page}&limit=20`).then(({ data }) => {
      setLogs(data.logs);
      setPagination(data.pagination);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Audit Logs</h1>
      {loading ? <Spinner /> : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Action','Entity','Performed By','Time'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{l.action}</td>
                    <td className="px-4 py-3 text-gray-500">{l.entityType}</td>
                    <td className="px-4 py-3">{l.performedBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(l.performedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="text-center text-gray-400 py-10">No logs yet.</p>}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {logs.map((l) => (
              <div key={l._id} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="font-mono text-xs text-blue-700 font-medium">{l.action}</p>
                <p className="text-xs text-gray-500 mt-1">{l.entityType} · {l.performedBy?.name || '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(l.performedAt).toLocaleString()}</p>
              </div>
            ))}
            {logs.length === 0 && <p className="text-center text-gray-400 py-10">No logs yet.</p>}
          </div>

          <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
