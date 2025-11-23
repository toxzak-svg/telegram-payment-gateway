import React, { useEffect, useState } from 'react';
import { p2pService } from '../api/services';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Pagination from '../components/common/Pagination';
import { exportToCsv } from '../utils/exportCsv';
import { toast } from 'react-hot-toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { P2POrder as P2POrderType, ApiResponse } from '../types';

type LocalOrder = P2POrderType;

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  matched: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
  expired: 'bg-red-100 text-red-800',
};

export default function P2POrders() {
  const [filter, setFilter] = useState<'all' | keyof typeof statusColors>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<P2POrderType | null>(null);

  const queryClient = useQueryClient();
  const { data: ordersResp, isLoading } = useQuery<ApiResponse<P2POrderType[]>>({
    queryKey: ['p2p-orders', { page, pageSize }],
    queryFn: () => p2pService.getOrders({ limit: pageSize, offset: (page - 1) * pageSize }),
  });

  // ordersResp may be an ApiResponse<{ data, meta }> or a plain array fallback
  const items: P2POrderType[] = ordersResp && 'data' in (ordersResp as any) ? (ordersResp as any).data : Array.isArray(ordersResp) ? (ordersResp as any) : [];
  const total = ordersResp && 'meta' in (ordersResp as any) ? (ordersResp as any).meta?.total ?? items.length : items.length;

  const filteredOrders = filter === 'all' ? items : items.filter((o) => o.status === filter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">P2P Orders</h1>
      <div className="mb-4 flex gap-2">
        {['all', 'active', 'completed', 'cancelled'].map((f) => (
          <button
            key={f}
            className={`px-3 py-1 rounded ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            onClick={() => setFilter(f as any)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
            <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => exportToCsv('p2p_orders.csv', items as any)}
              className="px-3 py-1 bg-white border rounded text-sm"
            >Export CSV</button>
          </div>
          <div>
            <Pagination total={total ?? items.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        </div>
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="px-4 py-2">Order ID</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td className="border px-4 py-2">{order.id}</td>
                <td className="border px-4 py-2">{order.type}</td>
                <td className="border px-4 py-2">{order.userId}</td>
                <td className="border px-4 py-2">{order.starsAmount}</td>
                <td className="border px-4 py-2">{order.rate}</td>
                <td className={`border px-4 py-2 rounded ${statusColors[order.status]}`}>{order.status}</td>
                <td className="border px-4 py-2">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="border px-4 py-2">{new Date(order.updatedAt).toLocaleString()}</td>
                <td className="border px-4 py-2">
                  {order.status === 'open' && (
                    <button
                      onClick={() => { setSelectedOrder(order); setConfirmOpen(true); }}
                      className="px-2 py-1 text-sm rounded bg-red-50 text-red-600"
                    >Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Cancel Order"
        description={`Are you sure you want to cancel order ${selectedOrder?.id}?`}
        onConfirm={async () => {
          if (!selectedOrder) return;
            try {
            await p2pService.cancelOrder(selectedOrder.id);
            toast.success('Order cancelled');
            queryClient.invalidateQueries({ queryKey: ['p2p-orders'] });
          } catch (err: any) {
            toast.error(err?.message || 'Failed to cancel order');
          } finally {
            setConfirmOpen(false);
            setSelectedOrder(null);
          }
        }}
        onClose={() => { setConfirmOpen(false); setSelectedOrder(null); }}
      />
    </div>
  );
}
