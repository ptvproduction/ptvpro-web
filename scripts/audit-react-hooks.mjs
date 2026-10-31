/**
 * PTV PRO — AST-based React Rules of Hooks Extended Checker
 * Checks:
 * 1. Hook after return statement
 * 2. Hook inside conditional branch (if / ternary / switch)
 * 3. Hook inside loop (for / while / do-while)
 * 4. Hook inside nested function or event handler
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function findTsxFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'backups', 'docs', 'legacy', 'scratch'].includes(entry.name)) {
        results.push(...findTsxFiles(full));
      }
    } else if (entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

const files = findTsxFiles('src');
console.log(`Analyzing ${files.length} TSX components with Full Rules of Hooks AST...`);

const violations = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function isHookName(name) {
    return /^use[A-Z0-9]/.test(name);
  }

  function inspectComponent(componentNode, componentName) {
    const body = ts.isBlock(componentNode.body) ? componentNode.body : null;
    if (!body || !body.statements) return;

    let hasReturn = false;
    let returnNodeInfo = null;

    // Check top-level statements in order
    for (const stmt of body.statements) {
      if (ts.isIfStatement(stmt)) {
        if (ts.isReturnStatement(stmt.thenStatement) || 
           (ts.isBlock(stmt.thenStatement) && stmt.thenStatement.statements.some(s => ts.isReturnStatement(s)))) {
          hasReturn = true;
          const { line } = sourceFile.getLineAndCharacterOfPosition(stmt.getStart());
          returnNodeInfo = { line: line + 1, text: stmt.getText(sourceFile).slice(0, 50) };
        }
      } else if (ts.isReturnStatement(stmt)) {
        hasReturn = true;
        const { line } = sourceFile.getLineAndCharacterOfPosition(stmt.getStart());
        returnNodeInfo = { line: line + 1, text: stmt.getText(sourceFile).slice(0, 50) };
      }

      function checkNode(node, context) {
        // Did we hit an inner function/arrow function? (Nested functions cannot call hooks)
        const isNestedFn = (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node !== componentNode;
        const isConditional = ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isSwitchStatement(node);
        const isLoop = ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node);

        const nextContext = {
          inConditional: context.inConditional || isConditional,
          inLoop: context.inLoop || isLoop,
          inNestedFn: context.inNestedFn || isNestedFn,
        };

        if (ts.isCallExpression(node)) {
          const expr = node.expression;
          let name = null;
          if (ts.isIdentifier(expr)) name = expr.text;
          else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) name = expr.name.text;

          if (name && isHookName(name)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            if (hasReturn) {
              violations.push({
                type: 'HOOK_AFTER_EARLY_RETURN',
                file: filePath.replace(/\\/g, '/'),
                component: componentName,
                hook: name,
                line: line + 1,
                col: character + 1,
                desc: `Hook dipanggil pada line ${line + 1} setelah early return line ${returnNodeInfo?.line}`
              });
            } else if (nextContext.inNestedFn) {
              // Note: Custom hook or callbacks might call hooks, but in standard components hooks inside callbacks like onClick are invalid
              // We check if this is an event callback
              violations.push({
                type: 'HOOK_IN_NESTED_FUNCTION',
                file: filePath.replace(/\\/g, '/'),
                component: componentName,
                hook: name,
                line: line + 1,
                col: character + 1,
                desc: `Hook dipanggil di dalam fungsi bersarang / event handler`
              });
            } else if (nextContext.inConditional) {
              violations.push({
                type: 'HOOK_IN_CONDITIONAL',
                file: filePath.replace(/\\/g, '/'),
                component: componentName,
                hook: name,
                line: line + 1,
                col: character + 1,
                desc: `Hook dipanggil di dalam blok kondisi (if/ternary/switch)`
              });
            } else if (nextContext.inLoop) {
              violations.push({
                type: 'HOOK_IN_LOOP',
                file: filePath.replace(/\\/g, '/'),
                component: componentName,
                hook: name,
                line: line + 1,
                col: character + 1,
                desc: `Hook dipanggil di dalam loop`
              });
            }
          }
        }

        // Don't traverse deeper into nested functions unless we want to track
        ts.forEachChild(node, child => checkNode(child, nextContext));
      }

      checkNode(stmt, { inConditional: false, inLoop: false, inNestedFn: false });
    }
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
      inspectComponent(node, node.name.text);
    }
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text)) {
      if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        inspectComponent(node.initializer, node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log(`\nFound ${violations.length} violations:`);
console.table(violations);
