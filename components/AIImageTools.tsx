
import React, { useState } from 'react';
import { ImageSize, AspectRatio } from '../types';
import { generateRecipeImage, editRecipeImage, checkApiKeySelection, openApiKeySelection } from '../services/geminiService';

interface AIImageToolsProps {
  currentImageUrl: string;
  onImageGenerated: (url: string) => void;
  title: string;
}

const AIImageTools: React.FC<AIImageToolsProps> = ({ currentImageUrl, onImageGenerated, title }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [size, setSize] = useState<ImageSize>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const isKeySelected = await checkApiKeySelection();
      if (!isKeySelected) {
        await openApiKeySelection();
      }

      const imageUrl = await generateRecipeImage(prompt, size, aspectRatio);
      onImageGenerated(imageUrl);
      setPrompt('');
    } catch (err: any) {
      if (err.message === 'API_KEY_ERROR') {
        setError("請選擇有效的 API 金鑰以使用高品質生成功能。");
        await openApiKeySelection();
      } else {
        setError("生成圖片失敗，請稍後再試。");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!prompt.trim() || !currentImageUrl) return;
    setIsGenerating(true);
    setError(null);

    try {
      const imageUrl = await editRecipeImage(currentImageUrl, prompt);
      onImageGenerated(imageUrl);
      setPrompt('');
    } catch (err: any) {
      setError("編輯圖片失敗，請確保原始圖片有效。");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
      <div className="flex gap-2 mb-4 bg-slate-200/50 p-1 rounded-xl">
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            mode === 'generate' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          AI 生成 (Pro)
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
            mode === 'edit' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          AI 編輯 (Flash)
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            {mode === 'generate' ? '描述你想要的畫面' : '你想要如何修改？'}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'generate' ? `例如：一張俯瞰 ${title} 的照片，放在質樸的木桌上，光線柔和...` : "例如：添加復古濾鏡、移除背景、加入幾片薄荷葉作為裝飾..."}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none text-sm h-24"
          />
        </div>

        {mode === 'generate' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">品質</label>
              <select 
                value={size}
                onChange={(e) => setSize(e.target.value as ImageSize)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="1K">1K (標準)</option>
                <option value="2K">2K (高畫質)</option>
                <option value="4K">4K (超高畫質)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">比例</label>
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="1:1">正方形 (1:1)</option>
                <option value="4:3">標準 (4:3)</option>
                <option value="16:9">寬螢幕 (16:9)</option>
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={mode === 'generate' ? handleGenerate : handleEdit}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI 思考中...
            </>
          ) : (
            mode === 'generate' ? '生成圖片' : '應用 AI 編輯'
          )}
        </button>
        
        {mode === 'generate' && (
          <p className="text-[10px] text-center text-slate-400 mt-2">
            此功能需要付費版 Gemini API 金鑰。 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-slate-600">帳單說明</a>
          </p>
        )}
      </div>
    </div>
  );
};

export default AIImageTools;
