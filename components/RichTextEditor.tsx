
import React, { useRef, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, className = '', label }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleInput();
  };

  return (
    <div className={`flex flex-col border border-slate-200 rounded-lg bg-white overflow-hidden ${className}`}>
      {label && <label className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b">{label}</label>}
      <div className="flex items-center gap-1 p-2 border-b bg-slate-50 no-print">
        <button onClick={() => execCommand('bold')} className="p-2 hover:bg-slate-200 rounded" title="Negreta"><i className="fas fa-bold"></i></button>
        <button onClick={() => execCommand('italic')} className="p-2 hover:bg-slate-200 rounded" title="Cursiva"><i className="fas fa-italic"></i></button>
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-slate-200 rounded" title="Llista"><i className="fas fa-list-ul"></i></button>
        <button onClick={() => execCommand('formatBlock', 'h3')} className="p-2 hover:bg-slate-200 rounded font-bold" title="Títol">H</button>
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        <button onClick={() => execCommand('removeFormat')} className="p-2 hover:bg-slate-200 rounded" title="Neteja format"><i className="fas fa-eraser"></i></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-[300px] outline-none prose prose-slate max-w-none"
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};
