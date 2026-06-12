import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

export default function QRModal({ assetId, assetName, open, onClose }) {
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !assetId) return;
    setLoading(true);
    api.get(`/assets/${assetId}/qr`)
      .then(({ data }) => setQrCode(data.qrCode))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, assetId]);

  const download = () => {
    const link = document.createElement('a');
    link.href = `/api/v1/assets/${assetId}/qr/download`;
    link.download = `qr_${assetName?.replace(/\s+/g, '_').toLowerCase()}.png`;
    link.click();
  };

  return (
    <Modal open={open} onClose={onClose} title={`QR Code — ${assetName}`}>
      <div className="flex flex-col items-center gap-4">
        {loading ? <Spinner /> : qrCode ? (
          <>
            <img src={qrCode} alt="QR Code" className="w-56 h-56 border border-gray-200 rounded-lg" />
            <p className="text-xs text-gray-500 text-center">Scan to open asset page on mobile</p>
            <Button onClick={download} variant="secondary">Download PNG</Button>
          </>
        ) : (
          <p className="text-sm text-gray-400">Failed to load QR code.</p>
        )}
      </div>
    </Modal>
  );
}
