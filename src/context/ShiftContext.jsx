import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { getActiveShift } from '../api/shift.js';

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [pendingTarget, setPendingTarget] = useState(null);

  const refreshShift = useCallback(async () => {
    try {
      const shift = await getActiveShift();
      setActiveShift(shift);
    } catch {
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshShift(); }, [refreshShift]);

  const openStartModal = useCallback((onStarted) => {
    setPendingTarget(() => onStarted || null);
    setStartModalOpen(true);
  }, []);
  const openEndModal = useCallback(() => setEndModalOpen(true), []);

  const value = {
    activeShift, loading, refreshShift,
    startModalOpen, setStartModalOpen, openStartModal,
    endModalOpen, setEndModalOpen, openEndModal,
    summaryData, setSummaryData,
    pendingTarget, setPendingTarget,
  };

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be used within a ShiftProvider');
  return ctx;
}