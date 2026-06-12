import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(`/bookings/${id}`).then(({ data }) => setBooking(data.booking)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const action = async (type) => {
    await api.put(`/bookings/${id}/${type}`);
    load();
  };

  if (loading) return <Spinner />;
  if (!booking) return <p className="text-center py-12 text-gray-400">Booking not found.</p>;

  const b = booking;
  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Back</button>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Booking Detail</h1>
          <Badge label={b.status} />
        </div>
        <Row label="Asset" value={b.asset?.name} />
        <Row label="Category" value={b.asset?.category} />
        <Row label="Quantity" value={b.quantityRequested} />
        <Row label="Purpose" value={b.purpose} />
        <Row label="Start Date" value={new Date(b.startDate).toLocaleDateString()} />
        <Row label="End Date" value={new Date(b.endDate).toLocaleDateString()} />
        {b.user?.name && <Row label="User" value={`${b.user.name} (${b.user.email})`} />}
        {b.adminNote && <Row label="Admin Note" value={b.adminNote} />}
        {b.issueDetails?.issuedAt && <Row label="Issued At" value={new Date(b.issueDetails.issuedAt).toLocaleString()} />}
        {b.issueDetails?.dueDate && <Row label="Due Date" value={new Date(b.issueDetails.dueDate).toLocaleDateString()} />}
        {b.returnDetails?.returnedAt && <Row label="Returned At" value={new Date(b.returnDetails.returnedAt).toLocaleString()} />}
        {b.returnDetails?.conditionAtReturn && <Row label="Return Condition" value={b.returnDetails.conditionAtReturn} />}
        {b.returnDetails?.damageNotes && <Row label="Damage Notes" value={b.returnDetails.damageNotes} />}

        {user?.role === 'admin' && (
          <div className="flex gap-3 mt-5 flex-wrap">
            {b.status === 'pending' && <>
              <Button onClick={() => action('approve')}>Approve</Button>
              <Button variant="danger" onClick={() => action('reject')}>Reject</Button>
            </>}
            {b.status === 'approved' && <Button onClick={() => action('issue')}>Issue Asset</Button>}
            {['issued','overdue'].includes(b.status) && <Button variant="secondary" onClick={() => action('return')}>Record Return</Button>}
          </div>
        )}
      </Card>
    </div>
  );
}
