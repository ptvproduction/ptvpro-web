import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PTVSelect } from '../../src/shared/components/PTVSelect';

describe('PTV PRO Hub Design System — Continuous Corner & PTVSelect Tests', () => {
  describe('1. Concentric Corner Geometry Rules', () => {
    it('1.1 Should correctly calculate inner radius using concentric formula R_inner = max(0, R_outer - inset)', () => {
      const calculateInnerRadius = (rOuter: number, inset: number) => Math.max(0, rOuter - inset);

      // Card (20px) with padding/border inset 6px -> thumbnail radius 14px
      expect(calculateInnerRadius(20, 6)).toBe(14);

      // Dropdown panel (14px) with padding inset 4px -> option item radius 10px
      expect(calculateInnerRadius(14, 4)).toBe(10);

      // Large modal (28px) with padding inset 14px -> inner surface 14px
      expect(calculateInnerRadius(28, 14)).toBe(14);

      // Inset larger than outer radius should clamp safely to 0
      expect(calculateInnerRadius(8, 12)).toBe(0);
    });

    it('1.2 Defined corner token scales should be monotonically increasing and positive', () => {
      const cornerTokens = {
        '--ptv-corner-xs': 6,
        '--ptv-corner-sm': 10,
        '--ptv-corner-md': 14,
        '--ptv-corner-lg': 20,
        '--ptv-corner-xl': 28,
        '--ptv-corner-2xl': 36,
      };

      const values = Object.values(cornerTokens);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
      expect(values[0]).toBeGreaterThan(0);
    });
  });

  describe('2. PTVSelect Component Contracts & Accessibility', () => {
    const mockOptions = [
      { value: 'all', label: 'Semua Status' },
      { value: 'active', label: 'Aktif' },
      { value: 'unrecorded', label: 'Belum Dicatat', disabled: true },
    ];

    it('2.1 Should render trigger button with proper ARIA combobox semantics', () => {
      const html = renderToString(
        React.createElement(PTVSelect, {
          id: 'test-select',
          value: 'all',
          onChange: () => {},
          options: mockOptions,
          ariaLabel: 'Filter Test',
        })
      );

      // Check combobox attributes
      expect(html).toContain('role="combobox"');
      expect(html).toContain('id="test-select"');
      expect(html).toContain('aria-haspopup="listbox"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-label="Filter Test"');
      expect(html).toContain('Semua Status');
      expect(html).toContain('ptv-select-trigger');
      expect(html).toContain('fa-chevron-down');
    });

    it('2.2 Should render placeholder when no matching value is selected', () => {
      const html = renderToString(
        React.createElement(PTVSelect, {
          id: 'placeholder-select',
          value: '',
          onChange: () => {},
          options: mockOptions,
          placeholder: 'Silakan Pilih...',
        })
      );

      expect(html).toContain('ptv-select-placeholder');
      expect(html).toContain('Silakan Pilih...');
    });

    it('2.3 Should render disabled attribute when disabled is true', () => {
      const html = renderToString(
        React.createElement(PTVSelect, {
          id: 'disabled-select',
          value: 'all',
          onChange: () => {},
          options: mockOptions,
          disabled: true,
        })
      );

      expect(html).toContain('disabled=""');
    });

    it('2.4 Should apply error class when error state is active', () => {
      const html = renderToString(
        React.createElement(PTVSelect, {
          id: 'error-select',
          value: 'all',
          onChange: () => {},
          options: mockOptions,
          error: true,
        })
      );

      expect(html).toContain('is-error');
    });

    it('2.5 Should render hidden input when name attribute is provided for form compatibility', () => {
      const html = renderToString(
        React.createElement(PTVSelect, {
          id: 'form-select',
          name: 'filter_category',
          value: 'active',
          onChange: () => {},
          options: mockOptions,
        })
      );

      expect(html).toContain('<input type="hidden" name="filter_category" value="active"/>');
    });
  });
});
