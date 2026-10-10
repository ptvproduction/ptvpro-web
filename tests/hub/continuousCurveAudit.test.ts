import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PTV Unified Continuous Curve — Audit & Governance Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const hubSrcDir = path.join(rootDir, 'src/products/hub');
  const tokensCssPath = path.join(rootDir, 'src/styles/tokens.css');
  const dashboardCssPath = path.join(rootDir, 'src/styles/dashboard.css');

  describe('1. Token Scale & Mathematical Hierarchy', () => {
    const curveTokens = {
      '--ptv-curve-xs': 6,
      '--ptv-curve-sm': 9,
      '--ptv-curve-md': 12,
      '--ptv-curve-lg': 16,
      '--ptv-curve-xl': 22,
      '--ptv-curve-2xl': 28,
      '--ptv-curve-3xl': 34,
    };

    it('1.1 Should maintain monotonically increasing continuous scale without random gaps', () => {
      const values = Object.values(curveTokens);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
      expect(values[0]).toBeGreaterThan(0);
    });

    it('1.2 Should satisfy concentric nested formula: R_inner ≈ max(0, R_outer - inset)', () => {
      const calcInner = (rOuter: number, inset: number) => Math.max(0, rOuter - inset);

      // Card (22px) -> Thumbnail (12px) with inset 10px
      expect(calcInner(curveTokens['--ptv-curve-xl'], 10)).toBe(12);

      // Modal (28px) -> Subpanel (16px) with inset 12px
      expect(calcInner(curveTokens['--ptv-curve-2xl'], 12)).toBe(16);

      // Subpanel (16px) -> Control (12px) with inset 4px
      expect(calcInner(curveTokens['--ptv-curve-lg'], 4)).toBe(12);

      // Control (12px) -> Micro Badge (6px) with inset 6px
      expect(calcInner(curveTokens['--ptv-curve-md'], 6)).toBe(6);
    });
  });

  describe('2. Design System Tokens & Progressive Enhancement Definitions', () => {
    it('2.1 tokens.css must export all --ptv-curve-* tokens and concentric offsets', () => {
      const content = fs.readFileSync(tokensCssPath, 'utf-8');
      expect(content).toContain('--ptv-curve-xs: 6px;');
      expect(content).toContain('--ptv-curve-sm: 9px;');
      expect(content).toContain('--ptv-curve-md: 12px;');
      expect(content).toContain('--ptv-curve-lg: 16px;');
      expect(content).toContain('--ptv-curve-xl: 22px;');
      expect(content).toContain('--ptv-curve-2xl: 28px;');
      expect(content).toContain('--ptv-curve-3xl: 34px;');
      expect(content).toContain('--ptv-curve-pill: 9999px;');
      expect(content).toContain('--ptv-curve-circle: 50%;');
      expect(content).toContain('--ptv-concentric-inset-md: 10px;');
    });

    it('2.2 dashboard.css must contain .ptv-curve-* classes and progressive squircle @supports', () => {
      const content = fs.readFileSync(dashboardCssPath, 'utf-8');
      expect(content).toContain('.ptv-curve-xs');
      expect(content).toContain('.ptv-curve-md');
      expect(content).toContain('.ptv-curve-xl');
      expect(content).toContain('.ptv-curve-2xl');
      expect(content).toContain('@supports (corner-shape: squircle)');
    });
  });

  describe('3. Automated Hub Component Radius Governance Audit', () => {
    // Helper to recursively find all .tsx files in directory
    function getTsxFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getTsxFiles(fullPath));
        } else if (file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it('3.1 No Hub TSX component should use disallowed hardcoded inline pixel border-radius', () => {
      const tsxFiles = getTsxFiles(hubSrcDir);
      expect(tsxFiles.length).toBeGreaterThan(0);

      // Matches pattern borderRadius: '12px' or borderRadius: '8px' (excluding approved variables or special shapes)
      const hardcodedRadiusRegex = /borderRadius:\s*['"]([0-9]+px)['"]/g;
      const violations: { file: string; match: string; line: number }[] = [];

      for (const file of tsxFiles) {
        const relativePath = path.relative(rootDir, file);
        const lines = fs.readFileSync(file, 'utf-8').split('\n');

        lines.forEach((lineText, idx) => {
          let match;
          while ((match = hardcodedRadiusRegex.exec(lineText)) !== null) {
            const val = match[1];
            // Allowed exceptions: '0px', or deliberate pill '9999px'
            if (val !== '0px' && val !== '9999px') {
              violations.push({
                file: relativePath,
                match: match[0],
                line: idx + 1,
              });
            }
          }
        });
      }

      if (violations.length > 0) {
        console.error('Violations found:', violations);
      }

      expect(violations).toEqual([]);
    });
  });

  describe('4. Normalized Geometry & Actual Inset Verification', () => {
    it('4.1 Normalized scale factors should accurately normalize component radii to reference 120px', () => {
      const targetRef = 120;
      const componentRadii = {
        control: 12,
        panel: 16,
        card: 22,
        modal: 28,
      };

      const scaleFactors = {
        control: targetRef / componentRadii.control,
        panel: targetRef / componentRadii.panel,
        card: targetRef / componentRadii.card,
        modal: targetRef / componentRadii.modal,
      };

      expect(scaleFactors.control).toBe(10.0);
      expect(scaleFactors.panel).toBe(7.5);
      expect(scaleFactors.card).toBeCloseTo(5.4545, 4);
      expect(scaleFactors.modal).toBeCloseTo(4.2857, 4);

      // Verify each scaled radius equals the normalized reference
      Object.entries(componentRadii).forEach(([key, r]) => {
        const factor = scaleFactors[key as keyof typeof scaleFactors];
        expect(r * factor).toBeCloseTo(targetRef, 5);
      });
    });

    it('4.2 Actual inset formula should account for both padding and border', () => {
      const calcActualInset = (padding: number, border: number) => padding + border;
      const calcInnerConcentric = (rOuter: number, padding: number, border: number) => {
        const inset = calcActualInset(padding, border);
        return Math.max(0, rOuter - inset);
      };

      // Case: Card (22px) with padding 10px + border 2px
      expect(calcActualInset(10, 2)).toBe(12);
      expect(calcInnerConcentric(22, 10, 2)).toBe(10);

      // Case: Modal (28px) with padding 10px + border 2px
      expect(calcActualInset(10, 2)).toBe(12);
      expect(calcInnerConcentric(28, 10, 2)).toBe(16);
    });

    it('4.3 Mathematical superellipse comparison: n=2 (circle) vs n=3.5 (squircle)', () => {
      // Evaluate diagonal corner radius at theta = 45 deg (t = pi / 4)
      const r = 140;
      const t = Math.PI / 4;
      const cosT = Math.cos(t);

      // x coordinate at diagonal: r * (1 - cos^(2/n)(t))
      const getDiagonalOffset = (n: number) => r * (1 - Math.pow(cosT, 2 / n));

      const circleDiag = getDiagonalOffset(2.0); // Standard CSS arc
      const squircleDiag = getDiagonalOffset(3.5); // Apple squircle

      // Circle diagonal offset: r * (1 - 1/sqrt(2)) ≈ 0.2929 * 140 ≈ 41.00px
      expect(circleDiag).toBeCloseTo(41.005, 2);

      // Squircle diagonal offset: flatter corner, smaller offset from corner bounding box
      expect(squircleDiag).toBeCloseTo(25.17, 1);

      // There is an honest geometric difference of ~15.8px at R=140px
      expect(circleDiag - squircleDiag).toBeGreaterThan(15);
    });
  });
});
