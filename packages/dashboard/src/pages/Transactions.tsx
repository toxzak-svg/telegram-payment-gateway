import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentService } from '../api/services';
import { ApiResponse, Payment } from '../types';
import Pagination from '../components/common/Pagination';
import { exportToCsv } from '../utils/exportCsv';

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: paymentsResp, isLoading } = useQuery<ApiResponse<Payment[]>>(
    ['payments', { page, pageSize }],
    () => paymentService.getPayments({ limit: pageSize, offset: (page - 1) * pageSize })
  );

  const items = paymentsResp && 'data' in (paymentsResp as any) ? (paymentsResp as any).data : Array.isArray(paymentsResp) ? (paymentsResp as any) : [];
  const total = paymentsResp && 'meta' in (paymentsResp as any) ? (paymentsResp as any).meta?.total ?? items.length : items.length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h1>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={() => exportToCsv('payments.csv', items as any)}
            className="px-3 py-2 rounded-lg border text-sm"
          >Export CSV</button>
        </div>
        <Pagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.map((tx: any) => (
              <tr key={tx.id}>
                <td className="px-4 py-2 font-mono text-sm text-blue-700">{tx.id}</td>
                <td className="px-4 py-2">{tx.userId || tx.user || tx.telegramUserId}</td>
                <td className="px-4 py-2">${tx.amount}</td>
                <td className="px-4 py-2 font-semibold">{tx.status}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{new Date(tx.createdAt || tx.date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
