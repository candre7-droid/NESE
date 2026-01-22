
import React, { useRef, useEffect, useState } from 'react';
import { geminiService } from '../services/geminiService';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, className = '', label }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (editorRef.current && !isFocused.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, val: string = '') => {
    document.execCommand(command, false, val);
    handleInput();
  };

  const handleAiRefinement = async (instruction: string) => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    try {
      const refinedText = await geminiService.refineText(editorRef.current?.innerHTML || '', instruction);
      if (editorRef.current) {
        editorRef.current.innerHTML = refinedText;
        onChange(refinedText);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className={`flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden ${className}`}>
      {label && (
        <div className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 border-b flex justify-between items-center">
          <span>{label}</span>
          <div className="flex items-center gap-2">
            {isAiLoading && <span className="text-[10px] text-emerald-600 animate-pulse"><i className="fas fa-sparkles mr-1"></i>IA treballant...</span>}
            <span className="text-[10px] font-normal text-slate-400 italic">Pots editar aquest text directament</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50 no-print">
        <button onClick={() => execCommand('bold')} className="p-2 hover:bg-emerald-100 rounded text-slate-700" title="Negreta"><i className="fas fa-bold"></i></button>
        <button onClick={() => execCommand('italic')} className="p-2 hover:bg-emerald-100 rounded text-slate-700" title="Cursiva"><i className="fas fa-italic"></i></button>
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-emerald-100 rounded text-slate-700" title="Llista"><i className="fas fa-list-ul"></i></button>
        <button onClick={() => execCommand('formatBlock', 'h3')} className="p-2 hover:bg-emerald-100 rounded font-bold text-slate-700" title="Títol">H</button>
        
        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        
        <div className="flex items-center bg-emerald-50 rounded-lg px-1 gap-1 border border-emerald-100">
          <span className="text-[10px] font-black text-emerald-800 px-1">AI TOOLS:</span>
          <button 
            disabled={isAiLoading}
            onClick={() => handleAiRefinement("Millora la redacció fent-la més professional i fluida, però mantingues el contingut.")} 
            className="p-2 hover:bg-emerald-200 rounded text-emerald-700 text-xs font-bold transition-all flex items-center gap-1"
            title="Millorar redacció"
          >
            <i className="fas fa-magic text-[10px]"></i> Polir
          </button>
          <button 
            disabled={isAiLoading}
            onClick={() => handleAiRefinement("Fes el text més concís i directe, eliminant redundàncies.")} 
            className="p-2 hover:bg-emerald-200 rounded text-emerald-700 text-xs font-bold transition-all flex items-center gap-1"
            title="Més concís"
          >
            <i className="fas fa-compress-alt text-[10px]"></i> Resumir
          </button>
          <button 
            disabled={isAiLoading}
            onClick={() => handleAiRefinement("Desenvolupa més els punts clau sense inventar dades noves.")} 
            className="p-2 hover:bg-emerald-200 rounded text-emerald-700 text-xs font-bold transition-all flex items-center gap-1"
            title="Més detallat"
          >
            <i className="fas fa-expand-alt text-[10px]"></i> Expandir
          </button>
        </div>

        <div className="w-px h-6 bg-slate-300 mx-1"></div>
        <button onClick={() => execCommand('removeFormat')} className="p-2 hover:bg-emerald-100 rounded text-slate-700" title="Neteja format"><i className="fas fa-eraser"></i></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        className="p-6 min-h-[400px] outline-none prose prose-slate max-w-none focus:ring-2 focus:ring-emerald-100 transition-all"
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
};
