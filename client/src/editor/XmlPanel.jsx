import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/features/register.all.js';
import 'monaco-editor/languages/definitions/xml/register.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { openStack } from './xmlScan.js';

/*
  The XML panel: Monaco, bundled with the client (no CDN; the worker is a
  same-origin file, so the CSP needs nothing new), XML only. Completion is
  schema-aware, from the same content model as the structured view:
    after "<"           the elements allowed at that position in the parent
    inside a start tag   the parent's attributes not yet present
    inside a value       the attribute's permitted values
  Markers show the parse error and the last validation's findings.
  Loaded lazily, so pages without an editor do not carry Monaco.
*/

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

// One completion provider for every panel; each model carries its content model.
const contentModels = new Map(); // model uri -> content model
let providerRegistered = false;

function registerProvider() {
  if (providerRegistered) return;
  providerRegistered = true;
  monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<', ' ', '"'],
    provideCompletionItems(model, position) {
      const cm = contentModels.get(model.uri.toString());
      if (!cm) return { suggestions: [] };
      const before = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const lt = before.lastIndexOf('<');
      const gt = before.lastIndexOf('>');
      if (lt > gt) {
        const tag = before.slice(lt + 1);
        // Inside an attribute value: its permitted values.
        const val = /([\w:.-]+)\s*=\s*"([^"]*)$/.exec(tag);
        const nameMatch = /^([\w:.-]+)/.exec(tag);
        if (val && nameMatch) {
          const values = cm.attributesOf(nameMatch[1])[val[1]] || [];
          return { suggestions: values.map((v) => ({ label: v, kind: monaco.languages.CompletionItemKind.EnumMember, insertText: v, range })) };
        }
        // Inside a start tag, after its name: the attributes not yet present.
        if (nameMatch && /\s/.test(tag)) {
          const present = new Set([...tag.matchAll(/([\w:.-]+)\s*=/g)].map((x) => x[1]));
          const attrs = Object.entries(cm.attributesOf(nameMatch[1])).filter(([a]) => !present.has(a));
          return { suggestions: attrs.map(([a, values]) => ({ label: a, kind: monaco.languages.CompletionItemKind.Property, insertText: `${a}="$1"`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: values.length ? values.slice(0, 6).join(' | ') : 'text', range })) };
        }
        // Right after "<": the elements allowed at this position.
        if (/^[\w:.-]*$/.test(tag)) {
          const stack = openStack(before.slice(0, lt));
          const parent = stack[stack.length - 1];
          const names = parent ? cm.insertableAt(parent.name, parent.children, parent.children.length) : ['dmodule'];
          return {
            suggestions: names.map((n, i) => ({
              label: n, kind: monaco.languages.CompletionItemKind.Class, sortText: String(i).padStart(4, '0'),
              insertText: cm.holdsText(n) || cm.isContainer(n) ? `${n}>$0</${n}>` : `${n}/>`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: parent ? `allowed here in <${parent.name}>` : 'root element', range,
            })),
          };
        }
      }
      return { suggestions: [] };
    },
  });
}

const isDark = () => document.documentElement.classList.contains('dark');

/*
  value / onChange: the XML text (the parent owns it). markers: [{ line, message, severity: 'error'|'warning' }].
  revealLine: a line to scroll to when it changes.
*/
export default function XmlPanel({ value, onChange, readOnly, contentModel, markers = [], revealLine, height = '62vh', label = 'XML source' }) {
  const host = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const applying = useRef(false);

  useEffect(() => {
    registerProvider();
    const editor = monaco.editor.create(host.current, {
      value, language: 'xml', readOnly, automaticLayout: true, minimap: { enabled: false }, wordWrap: 'off',
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 12.5, lineHeight: 20, scrollBeyondLastLine: false,
      theme: isDark() ? 'vs-dark' : 'vs', tabSize: 2, renderWhitespace: 'none', ariaLabel: label,
      quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true,
    });
    editorRef.current = editor;
    // Browser tests (only when their harness sets the flag) read the text the author sees.
    if (window.__AGASTYA_E2E__) window.__agastyaXml = () => editor.getValue();
    const sub = editor.onDidChangeModelContent(() => { if (!applying.current) onChangeRef.current(editor.getValue()); });
    // Follow the app's light/dark theme.
    const mo = new MutationObserver(() => monaco.editor.setTheme(isDark() ? 'vs-dark' : 'vs'));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      sub.dispose(); mo.disconnect();
      const model = editor.getModel();
      contentModels.delete(model.uri.toString());
      if (window.__agastyaXml) delete window.__agastyaXml;
      editor.dispose(); // the editor first, then its model
      model.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outside changes (the structured view, a reload) replace the text as one undoable edit.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.getValue() === value) return;
    applying.current = true;
    const model = editor.getModel();
    editor.pushUndoStop();
    editor.executeEdits('agastya', [{ range: model.getFullModelRange(), text: value }]);
    editor.pushUndoStop();
    applying.current = false;
  }, [value]);

  useEffect(() => { if (editorRef.current) editorRef.current.updateOptions({ readOnly }); }, [readOnly]);
  useEffect(() => { if (editorRef.current && contentModel) contentModels.set(editorRef.current.getModel().uri.toString(), contentModel); }, [contentModel]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    monaco.editor.setModelMarkers(model, 'agastya', markers.filter((m) => m.line).map((m) => {
      const line = Math.min(Math.max(1, m.line), model.getLineCount());
      return { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: model.getLineMaxColumn(line), message: m.message, severity: m.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error };
    }));
  }, [markers, value]);

  useEffect(() => {
    if (!editorRef.current || !revealLine) return;
    editorRef.current.revealLineInCenter(revealLine.line);
    editorRef.current.setPosition({ lineNumber: revealLine.line, column: 1 });
    editorRef.current.focus();
  }, [revealLine]);

  return <div ref={host} data-testid="xml-panel" className="w-full" style={{ height }} />;
}

