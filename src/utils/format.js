export function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-CA');
}

export function formatTime(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value)) {
    const [h, m] = value.split(':');
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}
