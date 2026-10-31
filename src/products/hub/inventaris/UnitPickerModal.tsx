import React, { useSyncExternalStore, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ItemInventaris, InventarisUnit } from './types';
import { loanBasketStore } from './loanBasketStore';
import { resolveInventoryPhotoUrl } from './utils/inventoryPhotoUtils';
import { useModalScrollLock } from '@shared/hooks/useModalScrollLock';

interface UnitPickerModalProps {
  isOpen: boolean;
  asset: ItemInventaris | null;
  onClose: () => void;
  onOpenLoanModal: () => void;
}

export const UnitPickerModal: React.FC<UnitPickerModalProps> = ({
  isOpen,
  asset,
  onClose,
  onOpenLoanModal,
}) => {
  const modalRef = useRef<HTMLElement>(null);

  // Subscribe to basket changes
  const basketItems = useSyncExternalStore(
    (cb) => loanBasketStore.subscribe(cb),
    () => loanBasketStore.getItems(),
    () => []
  );

  // Lifecycle dialog & accessibility hook
  useModalScrollLock({
    isOpen: Boolean(isOpen && asset),
    onClose,
    modalRef,
    id: 'unit-picker-modal',
  });

  if (!isOpen || !asset) return null;

  const totalCount = asset.units?.length || 0;
  const availCount = (asset.units || []).filter(
    (u) => (u.status_peminjaman || '').toLowerCase() === 'tersedia' && (u.kondisi || '').toLowerCase() === 'bagus'
  ).length;

  const handleToggleUnit = (u: InventarisUnit, idx: number) => {
    const isAvail =
      (u.status_peminjaman || '').toLowerCase() === 'tersedia' &&
      (u.kondisi || '').toLowerCase() === 'bagus';
    if (!isAvail) return;

    const uNum = parseInt(u.kode_unit.split('-U')[1] || `${idx + 1}`, 10) || idx + 1;
    loanBasketStore.toggle({
      key: `${asset.id}_${u.id}`,
      assetId: asset.id,
      unitId: u.id,
      unitNo: uNum,
      unitCode: u.kode_unit,
      unitName: u.nama_unit?.trim() || `Unit ${uNum.toString().padStart(2, '0')} (${u.kode_unit})`,
      assetName: asset.nama_alat,
      invCode: asset.kode,
    });
  };

  const getStatusBadge = (u: InventarisUnit) => {
    const status = (u.status_peminjaman || '').toLowerCase();
    const kondisi = (u.kondisi || '').toLowerCase();

    if (status === 'tersedia' && kondisi === 'bagus') {
      return (
        <span className="chip ok" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
          <i className="fa-solid fa-circle-check" style={{ marginRight: '4px', fontSize: '10px' }} />
          Tersedia
        </span>
      );
    }
    if (status === 'dipinjam') {
      return (
        <span className="chip warn" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
          <i className="fa-solid fa-user-clock" style={{ marginRight: '4px', fontSize: '10px' }} />
          Dipinjam
        </span>
      );
    }
    if (kondisi === 'rusak' || status === 'rusak') {
      return (
        <span className="chip dang" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px', fontSize: '10px' }} />
          Rusak
        </span>
      );
    }
    if (kondisi === 'perlu_servis' || status === 'maintenance') {
      return (
        <span className="chip warn" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
          <i className="fa-solid fa-wrench" style={{ marginRight: '4px', fontSize: '10px' }} />
          Perlu Servis
        </span>
      );
    }
    return (
      <span className="chip" style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
        {u.status_peminjaman || 'Tidak Tersedia'}
      </span>
    );
  };

  const modalContent = (
    <div className="ptv-hub-root unit-picker-portal-root" style={{ position: 'relative', zIndex: 9999 }}>
      {/* Fullscreen Scrim */}
      <div
        className="loan-modal-scrim"
        onClick={onClose}
        style={{ zIndex: 9998 }}
        aria-hidden="true"
      />

      {/* Centered Dialog / Bottom Sheet Container */}
      <div
        className="loan-modal-container"
        style={{ zIndex: 9999 }}
        role="presentation"
      >
        <section
          ref={modalRef}
          className="unit-picker-dialog-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unitPickerTitle"
        >
          {/* Mobile Grab Bar */}
          <div className="sheet-grab only-mobile" style={{ margin: '8px auto 0' }} />

          {/* Modal Header */}
          <div className="unit-picker-hd">
            <div className="unit-picker-title-group">
              <i className="fa-solid fa-layer-group" style={{ color: 'var(--b-600)', fontSize: '18px' }} />
              <h3 id="unitPickerTitle" style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>
                Pilih Unit untuk Daftar Pinjaman
              </h3>
            </div>
            <button
              type="button"
              className="loan-modal-close-btn"
              onClick={onClose}
              aria-label="Tutup"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="unit-picker-body">
            {/* Asset Summary Banner */}
            <div className="unit-picker-asset-banner" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(() => {
                const photoUrl = resolveInventoryPhotoUrl(asset.foto_url);
                if (photoUrl) {
                  return (
                    <img
                      src={photoUrl}
                      alt={asset.nama_alat}
                      style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--line-2)' }}
                    />
                  );
                }
                return null;
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)', lineHeight: 1.3 }}>
                  {asset.nama_alat}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                  <b style={{ color: availCount > 0 ? 'var(--ok)' : 'var(--dang)' }}>{availCount}</b> dari {totalCount} unit fisik siap dipinjam
                </div>
              </div>
              <span className="chip blue" style={{ fontSize: '11.5px', fontWeight: 750, padding: '4px 10px', flexShrink: 0 }}>
                {asset.kode || `INV-${String(asset.id).slice(0, 5).toUpperCase()}`}
              </span>
            </div>

            {/* Instruction Label */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pilih satu atau beberapa unit yang ingin dimasukkan ke daftar pinjaman:
            </div>

            {/* Physical Units List */}
            <div className="unit-picker-list">
              {totalCount === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', background: 'var(--bg-2)', borderRadius: 'var(--ptv-curve-md)' }}>
                  Belum ada unit fisik terdaftar untuk alat ini.
                </div>
              ) : (
                asset.units.map((u, idx) => {
                  const isAvail =
                    (u.status_peminjaman || '').toLowerCase() === 'tersedia' &&
                    (u.kondisi || '').toLowerCase() === 'bagus';
                  const inBasket = loanBasketStore.has(u.id) || loanBasketStore.has(`${asset.id}_${u.id}`);
                  const uNum = parseInt(u.kode_unit.split('-U')[1] || `${idx + 1}`, 10) || idx + 1;
                  const displayName = u.nama_unit?.trim() || `Unit ${uNum.toString().padStart(2, '0')}`;

                  return (
                    <div
                      key={u.id || idx}
                      className={`unit-picker-item ${inBasket ? 'selected' : ''} ${!isAvail ? 'disabled' : ''}`}
                    >
                      <div className="unit-picker-item-left">
                        <div
                          className="unit-picker-number-box"
                          style={{
                            background: isAvail ? 'var(--b-050)' : 'var(--bg-2)',
                            color: isAvail ? 'var(--b-700)' : 'var(--muted)',
                          }}
                        >
                          #{uNum}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink)' }}>
                              {displayName}
                            </span>
                            <span className="unit-code-badge font-mono">
                              {u.kode_unit}
                            </span>
                            {getStatusBadge(u)}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>Kondisi: <b style={{ color: 'var(--ink)' }}>{u.kondisi === 'bagus' ? 'Baik' : u.kondisi}</b></span>
                            <span>&bull;</span>
                            <span>{u.lokasi_penyimpanan || 'Studio PTV'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {isAvail ? (
                          <button
                            type="button"
                            className={`btn sm ${inBasket ? 'pri' : ''}`}
                            onClick={() => handleToggleUnit(u, idx)}
                            style={{
                              minHeight: '34px',
                              padding: '0 14px',
                              borderRadius: 'var(--ptv-curve-pill)',
                              fontWeight: 700,
                              fontSize: '12px',
                              boxShadow: inBasket ? 'var(--shadow-blue)' : 'none',
                            }}
                          >
                            <i className={`fa-solid ${inBasket ? 'fa-check' : 'fa-plus'}`} style={{ marginRight: '5px' }} />
                            {inBasket ? 'Dipilih' : 'Pilih Unit'}
                          </button>
                        ) : (
                          <span
                            className="chip"
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--muted)',
                              background: 'var(--bg-2)',
                              border: '1px solid var(--line-2)',
                            }}
                          >
                            Tidak Tersedia
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="unit-picker-foot">
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--b-600)', marginRight: '6px' }} />
              {basketItems.length} unit di daftar pinjaman
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn sm"
                onClick={onClose}
                style={{ minHeight: '38px', padding: '0 16px', borderRadius: 'var(--ptv-curve-pill)', fontWeight: 650 }}
              >
                Selesai
              </button>
              <button
                type="button"
                className="btn sm pri"
                onClick={onOpenLoanModal}
                style={{
                  minHeight: '38px',
                  padding: '0 18px',
                  borderRadius: 'var(--ptv-curve-pill)',
                  fontWeight: 700,
                  boxShadow: 'var(--shadow-blue)',
                }}
              >
                Lihat Daftar Pinjaman <i className="fa-solid fa-arrow-right" style={{ marginLeft: '5px' }} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
