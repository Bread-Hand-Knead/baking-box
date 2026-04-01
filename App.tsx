
import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- 1. 類型定義 (原 types.ts 內容) ---
export enum AppView { LIST, CREATE, EDIT, DETAIL, SCALING, COLLECTION, MANAGE_CATEGORIES }

export interface Ingredient { name: string; amount: string | number; unit: string; isFlour: boolean; }
export interface FermentationStage { name: string; time: string; timeUnit?: '分鐘' | '小時'; temperature: string; humidity: string; note?: string; }
export interface BakingStage { name: string; topHeat: string; bottomHeat: string; time: string; timeUnit?: '分鐘' | '小時'; note: string; }
export interface ExecutionLog { id: string; date: string; rating: number; feedback: string; photoUrl?: string; }
export interface Knowledge { id: string; title: string; content: string; master: string; createdAt: number; }
export interface Resource { id: string; title: string; url: string; category: string; }

export interface Recipe {
  id: string; title: string; master: string; sourceName?: string; sourceUrl?: string; sourceLinks?: { name: string; url: string; }[]; sourceDate?: string; onlineCourse?: string; sourcePage?: string; sourceNote?: string; recordDate: string;
  category: string; description: string; imageUrl: string; ingredients: Ingredient[]; instructions: string[];
  mainSectionName?: string; liquidStarterName?: string; liquidStarterIngredients?: Ingredient[];
  fillingSectionName?: string; fillingIngredients?: Ingredient[];
  decorationSectionName?: string; decorationIngredients?: Ingredient[];
  customSectionName?: string; customSectionIngredients?: Ingredient[];
  sectionsOrder?: string[]; isBakingRecipe: boolean; isTried: boolean;
  fermentationStages?: FermentationStage[]; bakingStages?: BakingStage[];
  notes?: string; tags?: string[]; moldName?: string;
  doughWeight?: number | string; crustWeight?: number | string; oilPasteWeight?: number | string; fillingWeight?: number | string;
  quantity?: number; shelfLife?: string; totalDuration?: string; createdAt: number; executionLogs?: ExecutionLog[];
}

interface Category { id: string; name: string; order: number; }

// --- 2. 內部小組件 (原 components 內容) ---
const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, confirmLabel = "確定", onConfirm, onCancel }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-200 ease-out ${isAnimating ? 'bg-black/20 opacity-100' : 'bg-black/0 opacity-0'}`}>
      <div className={`bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-orange-50 transition-all duration-200 ease-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-bold mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">取消</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const Toast: React.FC<{
  isOpen: boolean;
  message: string;
  onClose: () => void;
}> = ({ isOpen, message, onClose }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 10);
      const closeTimer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => setShouldRender(false), 200);
        onClose();
      }, 1500);
      return () => {
        clearTimeout(timer);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed top-24 left-0 right-0 z-[3000] flex justify-center pointer-events-none px-4">
      <div className={`bg-white/80 backdrop-blur-md border border-emerald-100 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-200 ease-out ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>
        <span className="text-emerald-500 text-lg">✅</span>
        <span className="text-slate-800 font-black text-sm">{message}</span>
      </div>
    </div>
  );
};

const RecipeCard: React.FC<{ recipe: Recipe; onClick: (r: Recipe) => void }> = ({ recipe, onClick }) => (
  <div onClick={() => onClick(recipe)} className="bg-white rounded-[32px] overflow-hidden border border-orange-50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
    <div className="aspect-[16/10] relative overflow-hidden">
      <img src={recipe.imageUrl || 'https://picsum.photos/400/250?random=' + recipe.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
      {recipe.isTried && (
        <div className="absolute bottom-4 right-4 px-4 py-1.5 bg-orange-100/90 backdrop-blur-sm text-orange-600 text-xs font-black rounded-full border border-orange-200/50 shadow-sm">⏳ 待嘗試</div>
      )}
    </div>
    <div className="p-5">
      <div className="flex justify-between items-start gap-2 mb-3">
        <h3 className="text-lg font-black text-slate-800 break-words leading-tight">{recipe.title}</h3>
        <span className="text-xs font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-xl border border-orange-100/50 shrink-0">{recipe.category}</span>
      </div>
      <p className="text-xs text-slate-400 font-bold mb-3">師傅：{recipe.master}</p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {recipe.totalDuration && (
          <div className="flex items-center gap-1 text-[11px] font-black text-[#E67E22] bg-orange-50/50 px-2 py-0.5 rounded-lg border border-orange-100/30">
            <span>⏱️</span>
            <span>{formatTimeWithUnit(recipe.totalDuration)}</span>
          </div>
        )}
        <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed flex-grow">{recipe.description || '點擊查看詳細配方...'}</p>
      </div>
    </div>
  </div>
);

// --- 3. 妳原本的主程式 App (修正了獨立計算與排版) ---
const STORAGE_KEY = 'ai_recipe_box_data_v4';
const CATEGORY_STORAGE_KEY = 'ai_recipe_box_categories_v4';
const KNOWLEDGE_STORAGE_KEY = 'ai_recipe_box_knowledge_v4';
const RESOURCE_STORAGE_KEY = 'ai_recipe_box_resources_v4';

const DEFAULT_SECTIONS_ORDER = [
  'liquidStarterIngredients', 'ingredients', 'fillingIngredients', 'decorationIngredients', 'customSectionIngredients'
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '麵包', order: 0 }, { id: 'cat-2', name: '蛋糕', order: 1 },
  { id: 'cat-3', name: '點心', order: 2 }, { id: 'cat-4', name: '餡料', order: 3 },
  { id: 'cat-5', name: '抹醬/其他', order: 4 }, { id: 'cat-6', name: '中式點心', order: 5 },
  { id: 'cat-7', name: '果醬', order: 6 }
];

const DEFAULT_KNOWLEDGE: Knowledge[] = [
  {
    id: 'kn-default',
    title: '鹽可頌整形技巧',
    content: '捲起時力道要輕，避免斷筋。尾端收口要壓在正下方，發酵後造型才不會散開。',
    master: '呂昇達老師',
    createdAt: Date.now()
  }
];

const MOLD_PRESETS = [
  { name: '自定義尺寸', type: 'none' },
  { name: '4吋圓模 (D10 H6)', type: 'circular', diameter: 10, height: 6 },
  { name: '6吋圓模 (D15 H7.5)', type: 'circular', diameter: 15, height: 7.5 },
  { name: '8吋圓模 (D20 H8)', type: 'circular', diameter: 20, height: 8 },
  { name: '12兩吐司模 (20x10x10)', type: 'rectangular', length: 20, width: 10, height: 10 },
  { name: '24兩吐司模 (32x10x10)', type: 'rectangular', length: 32, width: 10, height: 10 },
  { name: '半盤烤盤 (42x33x2)', type: 'rectangular', length: 42, width: 33, height: 2 }
];

const getTodayString = () => new Date().toISOString().split('T')[0];

const formatTimeWithUnit = (time: string, unit?: string) => {
  if (!time) return '--';
  const str = time.toString().trim();
  
  // 如果已經包含中文字（分鐘或小時），且沒有傳入 unit，則直接返回原字串（避免重複處理）
  if (!unit && (str.includes('分鐘') || str.includes('小時'))) {
    return str;
  }

  // 清理所有可能的單位
  const cleanTime = str.replace(/\s*(min|mins|m|h|hr|hrs|分鐘|小時)\b/gi, '').trim();
  
  // 偵測是否為數字或區間 (例如 40~50, 1.5-2)
  const isNumericish = /^[\d\s\.~-]+$/.test(cleanTime);
  
  // 如果清理後既不是數字也不是區間（例如：需隔夜），則直接返回原文字
  if (!isNumericish || cleanTime === '') {
    return str;
  }

  // 決定單位
  let detectedUnit = unit;
  if (!detectedUnit) {
    // 偵測舊資料中的單位
    const lowerStr = str.toLowerCase();
    if (lowerStr.includes('h') || lowerStr.includes('小時')) {
      detectedUnit = '小時';
    } else {
      // 預設或偵測到分鐘相關
      detectedUnit = '分鐘';
    }
  }
  
  // 加上空格並回傳，確保單位顯示
  return `${cleanTime} ${detectedUnit}`;
};

const DisplayIngredientSection: React.FC<{ 
  ingredients: Ingredient[], 
  title: string, 
  isBaking: boolean, 
  showPercentage: boolean
}> = ({ ingredients, title, isBaking, showPercentage }) => {
  if (!ingredients || ingredients.length === 0) return null;

  const localBaseInfo = useMemo(() => {
    let flourTotal = 0;
    let sectionTotal = 0;
    ingredients.forEach(ing => {
      const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
      const isWeight = isWeightUnit(ing.unit || 'g');
      if (isWeight) sectionTotal += amt;
      if (ing.isFlour && isWeight) flourTotal += amt;
    });
    
    if (flourTotal > 0) return { weight: flourTotal, name: '總粉量', sectionTotal };
    if (ingredients.length > 0) {
      const firstWeightIng = ingredients.find(ing => isWeightUnit(ing.unit || 'g'));
      const baseIng = firstWeightIng || ingredients[0];
      const baseAmt = typeof baseIng.amount === 'number' ? baseIng.amount : parseFloat(baseIng.amount as string) || 0;
      return { weight: baseAmt || 1, name: baseIng.name || '基準材料', sectionTotal };
    }
    return { weight: 1, name: '基準材料', sectionTotal };
  }, [ingredients]);

  return (
    <div className="mb-10 bg-white rounded-[40px] border-2 border-orange-50 p-8 shadow-sm overflow-hidden print:rounded-2xl print:border-slate-200 print:p-6 max-w-3xl mx-auto">
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex items-center">
          <span className="px-6 py-2 bg-[#E67E22] text-white text-base font-black rounded-2xl shadow-sm uppercase tracking-widest">
            {title}
          </span>
        </div>
        {isBaking && showPercentage && (
          <div className="ml-1 flex items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">基準:</span>
            <span className="text-sm font-bold text-slate-600 lowercase italic">
              (以 {localBaseInfo.name} 為 100%)
            </span>
          </div>
        )}
      </div>
      <div className="space-y-0">
        {/* 表頭 (僅桌面版) */}
        <div className="hidden sm:flex items-center px-6 py-4 border-b border-orange-100/50 text-xs font-black text-slate-500 uppercase tracking-widest bg-orange-50/30 rounded-t-2xl">
          <div className="flex-1 min-w-0">材料名稱</div>
          <div className="flex shrink-0 items-center">
            <div className="w-28 text-right pr-4">重量 (G)</div>
            {isBaking && showPercentage && <div className="w-28 text-right pr-4">百分比 (%)</div>}
          </div>
        </div>

        {ingredients.map((ing, idx) => {
          const rawAmt = ing.amount;
          const numericAmt = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt) || 0;
          const shouldHideUnit = typeof ing.amount === 'string' && (ing.amount === '適量' || ing.amount === '少許');
          const isWeight = isWeightUnit(ing.unit || 'g');
          const percentage = (localBaseInfo.weight > 0 && isWeight) ? (numericAmt / localBaseInfo.weight * 100).toFixed(1).replace(/\.0$/, '') : '';

          return (
            <div key={`scaling-ing-${idx}`} className="flex flex-col sm:flex-row sm:items-center py-6 sm:py-6 border-b border-orange-50/50 last:border-0 px-2 sm:px-6 hover:bg-orange-50/20 transition-colors rounded-2xl gap-3 sm:gap-0 mb-4 sm:mb-0">
              {/* 第一行：材料名稱 (手機版 100%，電腦版彈性寬度) */}
              <div className="flex items-center gap-4 flex-1 min-w-0 w-full px-2 sm:px-0">
                <span className={`shrink-0 w-3 h-3 rounded-full ${ing.isFlour ? 'bg-orange-500 shadow-[0_0_8px_rgba(230,126,34,0.4)]' : 'bg-slate-200'}`} />
                <span className="text-slate-800 font-black text-lg sm:text-[1.1rem] leading-tight truncate">{ing.name}</span>
              </div>

              {/* 第二行 (手機版) / 數據列 (電腦版) */}
              <div className="flex shrink-0 items-center justify-between sm:justify-end w-full sm:w-auto px-2 sm:px-0">
                {/* 重量 - 手機版靠左，電腦版固定寬度並靠右 */}
                <div className="w-auto sm:w-28 flex justify-start sm:justify-end items-center shrink-0 pr-4">
                  <div className="flex items-baseline gap-1 text-left sm:text-right w-full justify-end">
                    <span className="text-slate-900 font-black text-xl sm:text-lg leading-none">
                      {ing.amount}{!shouldHideUnit && ing.unit}
                    </span>
                  </div>
                </div>

                {/* 百分比 - 手機版靠右，電腦版固定寬度並靠右 */}
                {isBaking && showPercentage && (
                  <div className="w-auto sm:w-28 flex justify-end items-center shrink-0 pr-4">
                    {percentage ? (
                      <span className="text-xs sm:text-base font-black px-4 py-1.5 rounded-xl bg-orange-50 text-orange-600 shadow-sm inline-block min-w-[56px] sm:min-w-[70px] text-right border border-orange-100/50">
                        {percentage}%
                      </span>
                    ) : (
                      <div className="w-[56px] sm:w-[70px]" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 pt-6 border-t border-orange-100/50 flex justify-between items-center px-2 sm:px-6">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">區塊總重 (僅計重量單位):</span>
        <span className="text-xl font-black tabular-nums text-slate-700">
          {ingredients.reduce((acc, ing) => {
            if (!isWeightUnit(ing.unit || 'g')) return acc;
            const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
            return acc + amt;
          }, 0).toFixed(1).replace(/\.0$/, '')}
          <span className="text-sm font-bold text-slate-400 ml-1">g</span>
        </span>
      </div>
    </div>
  );
};

const isWeightUnit = (unit: string) => ['g', 'kg', 'ml'].includes(unit);

// Core UI: Stable Ingredient List
const IngredientList: React.FC<{ 
  items: Ingredient[], 
  title: string, 
  fieldKey: keyof Recipe, 
  customTitleKey?: keyof Recipe,
  onMoveSection: (direction: 'up' | 'down') => void,
  sectionIndex: number, 
  totalSections: number,
  formRecipe: Partial<Recipe>,
  setFormRecipe: React.Dispatch<React.SetStateAction<Partial<Recipe>>>,
  handleUpdateIngredient: (fieldKey: keyof Recipe, index: number, field: keyof Ingredient, val: any) => void,
  moveIngredient: (fieldKey: keyof Recipe, index: number, direction: 'up' | 'down') => void,
  triggerConfirm: (onConfirm: () => void) => void
}> = ({ 
  items, title, fieldKey, customTitleKey, onMoveSection, sectionIndex, totalSections, 
  formRecipe, setFormRecipe, handleUpdateIngredient, moveIngredient, triggerConfirm
}) => {
  const localBaseInfo = useMemo(() => {
    let flourTotal = 0;
    let sectionTotal = 0;
    items.forEach(ing => {
      const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
      if (isWeightUnit(ing.unit || 'g')) {
        sectionTotal += amt;
        if (ing.isFlour) flourTotal += amt;
      }
    });
    if (flourTotal > 0) return { weight: flourTotal, name: '總粉量', sectionTotal };
    if (items.length > 0) {
      return { weight: parseFloat(String(items[0].amount)) || 0, name: items[0].name || '基準材料', sectionTotal };
    }
    return { weight: 0, name: '基準材料', sectionTotal };
  }, [items]);

  const localBase = localBaseInfo.weight;

  return (
    <div className="mb-8 p-4 sm:p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm relative group/section overflow-hidden">
      {/* 修正後的 IngredientList 標題區塊：防止按鈕被擠出 */}
      <div className="flex justify-between items-center mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex flex-col shrink-0">
            <button type="button" onClick={() => onMoveSection('up')} disabled={sectionIndex === 0} className="p-1 text-slate-300 disabled:opacity-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></button>
            <button type="button" onClick={() => onMoveSection('down')} disabled={sectionIndex === totalSections - 1} className="p-1 text-slate-300 disabled:opacity-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></button>
          </div>
          {customTitleKey ? (
            <input 
              type="text" 
              value={String(formRecipe[customTitleKey] || '')} 
              onChange={(e) => setFormRecipe(prev => ({ ...prev, [customTitleKey]: e.target.value }))} 
              placeholder={title} 
              className="text-sm font-black text-white placeholder:text-white/60 uppercase tracking-widest bg-[#E67E22] px-4 py-2 rounded-2xl border-none outline-none w-full min-w-0 shadow-sm focus:ring-2 focus:ring-orange-200 transition-all" 
            />
          ) : (
            <div className="px-4 py-2 bg-[#E67E22] rounded-2xl shadow-sm">
              <label className="text-sm font-black text-white uppercase tracking-widest whitespace-nowrap">{title}</label>
            </div>
          )}
        </div>
        <button 
          type="button" 
          onClick={() => setFormRecipe(prev => ({ ...prev, [fieldKey]: [...(prev[fieldKey] as Ingredient[] || []), { name: '', amount: '', unit: 'g', isFlour: false }] }))} 
          className="shrink-0 text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all whitespace-nowrap"
        >
          + 新增材料
        </button>
      </div>

      {/* 基準提示文字 */}
      {formRecipe.isBakingRecipe && (
        <div className="ml-10 mb-5 flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">基準:</span>
          <span className="text-xs font-bold text-slate-500 lowercase italic">
            (以 {localBaseInfo.name} 為 100%)
          </span>
        </div>
      )}
      <div className="space-y-4 sm:space-y-2">
        {items.map((ing, idx) => {
          const numericAmt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
          const isWeight = isWeightUnit(ing.unit || 'g');
          const percentage = (localBase > 0 && isWeight) ? (numericAmt / localBase * 100).toFixed(1).replace(/\.0$/, '') : '';

          return (
            <div key={`${fieldKey}-${idx}`} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center bg-slate-50/30 sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border border-slate-100 sm:border-none">
              {/* 第一排：粉/水切換 + 材料名稱 */}
              <div className="flex gap-2 items-center w-full sm:flex-[55] sm:basis-0 min-w-0">
                {formRecipe.isBakingRecipe && (
                  <button 
                    type="button" 
                    onClick={() => handleUpdateIngredient(fieldKey, idx, 'isFlour', !ing.isFlour)} 
                    disabled={!isWeight}
                    className={`shrink-0 w-12 h-12 sm:w-8 sm:h-10 rounded-xl text-xs font-black transition-all ${!isWeight ? 'bg-slate-50 text-slate-200' : ing.isFlour ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}
                  >
                    粉
                  </button>
                )}
                <input 
                  type="text" 
                  value={ing.name ?? ''} 
                  onChange={(e) => handleUpdateIngredient(fieldKey, idx, 'name', e.target.value)} 
                  className="flex-1 w-0 h-12 sm:h-10 px-4 sm:px-3 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs outline-none focus:ring-1 focus:ring-orange-200 transition-all" 
                  placeholder="材料名稱" 
                />
              </div>

              {/* 第二排：百分比 + 重量 + 單位 + 移除 (手機版併排) */}
              <div className="flex gap-2 items-center w-full sm:flex-[45] sm:basis-0 min-w-0">
                {formRecipe.isBakingRecipe && (
                  <div className="flex-[3] sm:flex-1 relative min-w-0 sm:min-w-[70px]">
                    <input 
                      type="text" 
                      value={percentage} 
                      disabled={!isWeight}
                      onChange={(e) => {
                        if (!isWeight) return;
                        const pct = parseFloat(e.target.value) || 0;
                        const newAmt = (pct * localBase / 100).toFixed(1).replace(/\.0$/, '');
                        handleUpdateIngredient(fieldKey, idx, 'amount', newAmt);
                      }}
                      className={`w-full h-12 sm:h-10 px-4 sm:px-1 rounded-xl border outline-none transition-all text-center text-base sm:text-xs font-bold ${!isWeight ? 'bg-slate-100 border-slate-100 text-slate-300' : 'border-slate-100 bg-white sm:bg-slate-50/50 text-orange-600 focus:ring-1 focus:ring-orange-200'}`} 
                      placeholder="%" 
                    />
                    {isWeight && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-orange-300 font-bold pointer-events-none">%</span>}
                  </div>
                )}
                <div className="flex-[4] sm:flex-1 relative min-w-0 sm:min-w-[70px]">
                  <input 
                    type="text" 
                    value={ing.amount ?? ''} 
                    onChange={(e) => handleUpdateIngredient(fieldKey, idx, 'amount', e.target.value)} 
                    className="w-full h-12 sm:h-10 px-4 sm:px-1 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs text-center outline-none focus:ring-1 focus:ring-orange-200 transition-all" 
                    placeholder={isWeight ? "克數" : "數量"} 
                  />
                </div>
                <div className="flex-[3] sm:flex-1 relative min-w-0 sm:min-w-[70px] shrink-0">
                  <select 
                    value={ing.unit ?? 'g'} 
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      handleUpdateIngredient(fieldKey, idx, 'unit', newUnit);
                      // If changing to non-weight unit, turn off isFlour
                      if (!isWeightUnit(newUnit) && ing.isFlour) {
                        handleUpdateIngredient(fieldKey, idx, 'isFlour', false);
                      }
                    }} 
                    className="w-full h-12 sm:h-10 px-1 rounded-xl border border-slate-100 bg-orange-50/30 sm:bg-orange-50/50 text-base sm:text-xs outline-none focus:ring-1 focus:ring-orange-200 transition-all text-center appearance-none cursor-pointer font-bold text-slate-700"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="顆">顆</option>
                    <option value="個">個</option>
                    <option value="小匙">小匙</option>
                    <option value="大匙">大匙</option>
                    <option value="適量">適量</option>
                  </select>
                </div>
                <button 
                  type="button" 
                  onClick={() => triggerConfirm(() => setFormRecipe(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] as Ingredient[]).filter((_, i) => i !== idx) })))} 
                  className="flex-[1] sm:flex-none sm:w-10 h-12 sm:h-10 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-orange-50/50 flex justify-between items-center px-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">區塊總重 (僅計重量單位):</span>
          <span className="text-sm font-black text-slate-600 tabular-nums">
            {localBaseInfo.sectionTotal.toFixed(1).replace(/\.0$/, '')}
            <span className="text-[10px] ml-0.5 text-slate-400">g</span>
          </span>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  const [categories, setCategories] = useState<Category[]>(() => JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) || JSON.stringify(DEFAULT_CATEGORIES)));
  const [knowledge, setKnowledge] = useState<Knowledge[]>(() => JSON.parse(localStorage.getItem(KNOWLEDGE_STORAGE_KEY) || JSON.stringify(DEFAULT_KNOWLEDGE)));
  const [resources, setResources] = useState<Resource[]>(() => JSON.parse(localStorage.getItem(RESOURCE_STORAGE_KEY) || '[]'));
  
  const [storageUsage, setStorageUsage] = useState(0);

  const [view, setView] = useState<AppView>(AppView.LIST);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  
  // Scaling states
  const [scalingRecipeId, setScalingRecipeId] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number>(1);
  const [isMoldPanelOpen, setIsMoldPanelOpen] = useState(false);
  
  // Mold scaling states - split into two independent objects
  const [sourceMold, setSourceMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });
  const [targetMold, setTargetMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });

  // Execution Log states
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLog, setNewLog] = useState<Partial<ExecutionLog>>({ date: getTodayString(), rating: 5, feedback: '', photoUrl: '' });
  const logPhotoInputRef = useRef<HTMLInputElement>(null);

  const [newNote, setNewNote] = useState({ title: '', content: '', master: '' });

  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>(() => {
    const saved = localStorage.getItem('completedSteps');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('completedSteps', JSON.stringify(completedSteps));
  }, [completedSteps]);

  const toggleStepCompleted = (recipeId: string, stepIdx: number) => {
    setCompletedSteps(prev => {
      const current = prev[recipeId] || [];
      const next = current.includes(stepIdx)
        ? current.filter(i => i !== stepIdx)
        : [...current, stepIdx];
      return { ...prev, [recipeId]: next };
    });
  };

  const resetProgress = (recipeId: string) => {
    setCompletedSteps(prev => {
      const next = { ...prev };
      delete next[recipeId];
      return next;
    });
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const triggerConfirm = (onConfirm: () => void, title = "確認刪除？", message = "妳確定要移除這個項目嗎？此操作無法復原。", confirmLabel = "確定刪除") => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, confirmLabel });
  };

  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const showToast = (message: string) => {
    setToast({ show: true, message });
  };

  const backupInputRef = useRef<HTMLInputElement>(null);
  const recipeImageInputRef = useRef<HTMLInputElement>(null);

  const [formRecipe, setFormRecipe] = useState<Partial<Recipe>>({
    title: '', master: '', sourceName: '', sourceUrl: '', sourceLinks: [], onlineCourse: '', sourcePage: '', sourceNote: '', moldName: '', doughWeight: '', crustWeight: '', oilPasteWeight: '', fillingWeight: '', quantity: 1, shelfLife: '', totalDuration: '',
    sourceDate: '', recordDate: getTodayString(),
    fermentationStages: [], bakingStages: [], description: '',
    ingredients: [{ name: '', amount: '', unit: 'g', isFlour: true }],
    mainSectionName: '主麵團', liquidStarterName: '液種 / 老麵', liquidStarterIngredients: [], fillingSectionName: '內餡', fillingIngredients: [], decorationSectionName: '裝飾', decorationIngredients: [], customSectionName: '其他區塊', customSectionIngredients: [], sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
    instructions: [''], category: '麵包', imageUrl: '', isBakingRecipe: true, isTried: true, tags: [], notes: '', executionLogs: []
  });

  const [newCatName, setNewCatName] = useState('');
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      let shouldShow = false;
      if (view === AppView.LIST) {
        shouldShow = scrollY > 300;
      } else if (view === AppView.DETAIL) {
        shouldShow = scrollY > 600;
      } else if (view === AppView.CREATE || view === AppView.EDIT) {
        shouldShow = scrollY > 400;
      } else if (view === AppView.MANAGE_CATEGORIES) {
        shouldShow = scrollY > 200 || (documentHeight > windowHeight + 200);
      }
      
      setShowJumpBtn(shouldShow);
      // Determine if we are near the bottom (within 150px or 10% of the page)
      const threshold = Math.min(200, documentHeight * 0.1);
      setIsAtBottom(scrollY + windowHeight >= documentHeight - threshold);
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [view, recipes.length, categories.length, knowledge.length, resources.length]);

  useEffect(() => {
    // 全局資料遷移：標準化時間格式與單位
    const migrateData = () => {
      let hasChanged = false;
      const migrated = recipes.map(r => {
        let recipeChanged = false;
        
        const newFermentationStages = r.fermentationStages?.map(s => {
          const rawTime = String(s.time || '');
          const cleanedTime = rawTime
            .replace(/mins?\.?/gi, '分鐘')
            .replace(/hrs?\.?/gi, '小時');
          
          if (cleanedTime !== s.time || !s.timeUnit) {
            recipeChanged = true;
            return { ...s, time: cleanedTime, timeUnit: s.timeUnit || '分鐘' };
          }
          return s;
        });

        const newBakingStages = r.bakingStages?.map(s => {
          const rawTime = String(s.time || '');
          const cleanedTime = rawTime
            .replace(/mins?\.?/gi, '分鐘')
            .replace(/hrs?\.?/gi, '小時');
          
          if (cleanedTime !== s.time || !s.timeUnit) {
            recipeChanged = true;
            return { ...s, time: cleanedTime, timeUnit: s.timeUnit || '分鐘' };
          }
          return s;
        });

        if (recipeChanged) {
          hasChanged = true;
          return { 
            ...r, 
            fermentationStages: newFermentationStages, 
            bakingStages: newBakingStages 
          };
        }
        return r;
      });

      if (hasChanged) {
        setRecipes(migrated);
      }
    };

    migrateData();
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes)); }, [recipes]);
  useEffect(() => { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(knowledge)); }, [knowledge]);
  useEffect(() => { localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources)); }, [resources]);

  useEffect(() => {
    const calculateSize = () => {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) total += (localStorage.getItem(key) || '').length;
      }
      setStorageUsage(total);
    };
    calculateSize();
  }, [recipes, categories, knowledge, resources]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.master && r.master.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = 
        activeCategory === '全部' ? true :
        activeCategory === '⏳ 待嘗試' ? r.isTried :
        r.category === activeCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [recipes, searchQuery, activeCategory]);

  const scalingRecipe = useMemo(() => recipes.find(r => r.id === scalingRecipeId), [recipes, scalingRecipeId]);
  
  // Volume calculation helper
  const getVolume = (mold: { type: 'circular' | 'rectangular', diameter: number, height: number, length: number, width: number }) => {
    if (mold.type === 'circular') {
      const r = mold.diameter / 2;
      return Math.PI * Math.pow(r, 2) * (mold.height || 1);
    }
    return mold.length * mold.width * (mold.height || 1);
  };

  // Mold volume calculation
  const calculatedMoldFactor = useMemo(() => {
    const vSource = getVolume(sourceMold);
    const vTarget = getVolume(targetMold);
    if (vSource <= 0 || vTarget <= 0) return 1;
    return vTarget / vSource;
  }, [sourceMold, targetMold]);

  const scalingFactor = useMemo(() => {
    if (!scalingRecipe || !scalingRecipe.quantity) return 1;
    const qtyRatio = targetQuantity / scalingRecipe.quantity;
    return qtyRatio * calculatedMoldFactor;
  }, [scalingRecipe, targetQuantity, calculatedMoldFactor]);

  const handleApplyMoldPreset = (mold: 'source' | 'target', presetName: string) => {
    const preset = MOLD_PRESETS.find(p => p.name === presetName);
    if (!preset || preset.type === 'none') return;

    const updateFn = mold === 'source' ? setSourceMold : setTargetMold;
    if (preset.type === 'circular') {
      updateFn({ type: 'circular', diameter: preset.diameter || 0, height: preset.height || 0, length: 0, width: 0 });
    } else if (preset.type === 'rectangular') {
      updateFn({ type: 'rectangular', diameter: 0, height: preset.height || 0, length: preset.length || 0, width: preset.width || 0 });
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 800;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not found'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setFormRecipe(prev => ({ ...prev, imageUrl: compressed }));
    } catch (err) {
      console.error('Image compression failed', err);
    }
  };

  const handleLogPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setNewLog(prev => ({ ...prev, photoUrl: compressed }));
    } catch (err) {
      console.error('Log photo compression failed', err);
    }
  };

  const handleTagsInput = (val: string) => {
    const tagArray = val.split(/[，,]/).map(t => t.trim()).filter(t => t !== '');
    setFormRecipe(prev => ({ ...prev, tags: tagArray }));
  };

  const currentOrder = formRecipe.sectionsOrder || DEFAULT_SECTIONS_ORDER;

  const handleUpdateIngredient = (fieldKey: keyof Recipe, index: number, field: keyof Ingredient, val: any) => {
    setFormRecipe(prev => {
      const list = [...(prev[fieldKey] as Ingredient[] || [])];
      list[index] = { ...list[index], [field]: val };
      return { ...prev, [fieldKey]: list };
    });
  };

  const handleUpdateFermentationStage = (index: number, field: keyof FermentationStage, val: any) => {
    setFormRecipe(prev => {
      const stages = [...(prev.fermentationStages || [])];
      stages[index] = { ...stages[index], [field]: val };
      return { ...prev, fermentationStages: stages };
    });
  };

  const handleUpdateBakingStage = (index: number, field: keyof BakingStage, val: any) => {
    setFormRecipe(prev => {
      const stages = [...(prev.bakingStages || [])];
      stages[index] = { ...stages[index], [field]: val };
      return { ...prev, bakingStages: stages };
    });
  };

  const moveIngredient = (fieldKey: keyof Recipe, index: number, direction: 'up' | 'down') => {
    setFormRecipe(prev => {
      const list = [...(prev[fieldKey] as Ingredient[] || [])];
      if (direction === 'up' && index > 0) [list[index], list[index-1]] = [list[index-1], list[index]];
      else if (direction === 'down' && index < list.length - 1) [list[index], list[index+1]] = [list[index+1], list[index]];
      return { ...prev, [fieldKey]: list };
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setFormRecipe(prev => {
      const order = [...(prev.sectionsOrder || DEFAULT_SECTIONS_ORDER)];
      if (direction === 'up' && index > 0) [order[index], order[index-1]] = [order[index-1], order[index]];
      else if (direction === 'down' && index < order.length - 1) [order[index], order[index+1]] = [order[index+1], order[index]];
      return { ...prev, sectionsOrder: order };
    });
  };

  const handleCreateNew = () => {
    setFormRecipe({
      title: '', master: '', sourceName: '', sourceUrl: '', onlineCourse: '', moldName: '', doughWeight: '', crustWeight: '', oilPasteWeight: '', fillingWeight: '', quantity: 1, shelfLife: '', totalDuration: '',
      sourceDate: '', recordDate: getTodayString(),
      fermentationStages: [{ name: '基本發酵', time: '', timeUnit: '分鐘', temperature: '', humidity: '' }], bakingStages: [{ name: 'STAGE 1', topHeat: '', bottomHeat: '', time: '', timeUnit: '分鐘', note: '' }], description: '',
      ingredients: [{ name: '', amount: '', unit: 'g', isFlour: true }],
      mainSectionName: '主麵團', liquidStarterName: '液種 / 老麵', liquidStarterIngredients: [], fillingSectionName: '內餡', fillingIngredients: [], decorationSectionName: '裝飾', decorationIngredients: [], customSectionName: '其他區塊', customSectionIngredients: [], sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
      instructions: [''], category: categories[0]?.name || '麵包', imageUrl: '', isBakingRecipe: true, isTried: true, tags: [], notes: '', executionLogs: []
    });
    setView(AppView.CREATE);
  };

  const handleExport = () => {
    const data = { recipes, categories, knowledge, resources, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `烘焙靈感箱備份_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.recipes) {
          const processed = data.recipes.map((r: any) => ({
            ...r,
            id: String(r.id || 'rec-' + Math.random().toString(36).substr(2, 9)),
            createdAt: r.createdAt || Date.now(),
            moldName: r.moldName || '',
            doughWeight: r.doughWeight || '',
            crustWeight: r.crustWeight || '',
            oilPasteWeight: r.oilPasteWeight || '',
            fillingWeight: r.fillingWeight || '',
            quantity: r.quantity || 1,
            shelfLife: r.shelfLife || '',
            totalDuration: r.totalDuration || '',
            sourceDate: r.sourceDate || '',
            recordDate: r.recordDate || '',
            fermentationStages: Array.isArray(r.fermentationStages) 
              ? r.fermentationStages.map((s: any) => ({
                  ...s,
                  time: String(s.time || '').replace(/mins?\.?/gi, '分鐘').replace(/hrs?\.?/gi, '小時'),
                  timeUnit: s.timeUnit || '分鐘'
                }))
              : [],
            bakingStages: Array.isArray(r.bakingStages)
              ? r.bakingStages.map((s: any) => ({
                  ...s,
                  time: String(s.time || '').replace(/mins?\.?/gi, '分鐘').replace(/hrs?\.?/gi, '小時'),
                  timeUnit: s.timeUnit || '分鐘'
                }))
              : [],
            ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
            instructions: Array.isArray(r.instructions) ? r.instructions : [],
            sectionsOrder: Array.isArray(r.sectionsOrder) ? r.sectionsOrder : [...DEFAULT_SECTIONS_ORDER],
            tags: Array.isArray(r.tags) ? r.tags : [],
            notes: r.notes || '',
            executionLogs: Array.isArray(r.executionLogs) ? r.executionLogs : []
          }));
          setRecipes(processed);
        }
        if (data.categories) setCategories(data.categories);
        if (data.knowledge) setKnowledge(data.knowledge);
        if (data.resources) setResources(data.resources);
        alert('匯入成功！');
      } catch (err) { alert('匯入失敗'); }
    };
    reader.readAsText(file);
  };

  const handleAddLog = () => {
    if (!selectedRecipe || !newLog.feedback) return;
    const log: ExecutionLog = {
      id: 'log-' + Date.now(),
      date: newLog.date || getTodayString(),
      rating: newLog.rating || 5,
      feedback: newLog.feedback || '',
      photoUrl: newLog.photoUrl
    };
    const updatedRecipe = {
      ...selectedRecipe,
      executionLogs: [log, ...(selectedRecipe.executionLogs || [])]
    };
    setRecipes(prev => prev.map(r => r.id === selectedRecipe.id ? updatedRecipe : r));
    setSelectedRecipe(updatedRecipe);
    setNewLog({ date: getTodayString(), rating: 5, feedback: '', photoUrl: '' });
    setIsAddingLog(false);
    showToast("紀錄儲存成功！");
  };

  const handleAddNote = () => {
    if (!newNote.title || !newNote.content) return;
    setKnowledge(prev => [{ ...newNote, id: 'kn-' + Date.now(), createdAt: Date.now() }, ...prev]);
    setNewNote({ title: '', content: '', master: '' });
    showToast("筆記儲存成功！");
  };

  const handleDeleteRecipe = () => {
    if (!selectedRecipe) return;
    const recipeIdToDelete = String(selectedRecipe.id);
    const updatedRecipes = recipes.filter(r => String(r.id) !== recipeIdToDelete);
    setRecipes(updatedRecipes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecipes));
    setSelectedRecipe(null);
    setSearchQuery('');
    setActiveCategory('全部');
    setView(AppView.LIST);
  };

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-slate-900 pb-28 print:bg-white print:pb-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:max-w-none print:px-0 print:py-0">
        
        {/* LIST View Header */}
        {view === AppView.LIST && (
          <header className="flex flex-col gap-6 mb-8 animate-in fade-in slide-in-from-top-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[#E67E22] flex items-center gap-2">
                  <span className="bg-orange-100 p-2 rounded-2xl text-2xl shadow-sm">🥖</span>
                  烘焙靈感箱
                </h1>
                <p className="text-orange-300 text-xs mt-1 font-medium">記錄師傅的筆記與經典配方</p>
                
                {/* 儲存空間進度條 */}
                <div className="mt-4 max-w-[200px] no-print">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">儲存空間</span>
                    <span className={`text-[11px] font-black ${(storageUsage / (5 * 1024 * 1024)) > 0.8 ? 'text-red-500' : 'text-orange-400'}`}>
                      {Math.min(100, (storageUsage / (5 * 1024 * 1024)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                    <div 
                      className={`h-full transition-all duration-500 ${(storageUsage / (5 * 1024 * 1024)) > 0.8 ? 'bg-red-500' : 'bg-orange-400'}`}
                      style={{ width: `${Math.min(100, (storageUsage / (5 * 1024 * 1024)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-xl shadow-sm text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all active:scale-95">
                    <span className="text-base">📤</span>
                    <span>匯出備份</span>
                 </button>
                 <button onClick={() => backupInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-xl shadow-sm text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all active:scale-95">
                    <span className="text-base">📥</span>
                    <span>匯入備份</span>
                 </button>
                 <input type="file" ref={backupInputRef} onChange={handleImport} className="hidden" accept=".json" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative group">
                <input type="text" placeholder="搜尋食譜或師傅..." value={searchQuery || ''} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-orange-100 rounded-2xl focus:ring-2 focus:ring-orange-400 outline-none shadow-sm text-sm transition-all" />
                <span className="absolute left-4 top-3.5 text-orange-300 transition-colors group-focus-within:text-orange-500">🔍</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['⏳ 待嘗試', '全部', ...categories.map(c => c.name)].map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-[#E67E22] text-white shadow-md' : 'bg-white text-orange-400 border border-orange-100 hover:border-orange-300'}`}>{cat}</button>
                ))}
              </div>
            </div>
          </header>
        )}

        <main>
          {view === AppView.LIST && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in no-print">
              {filteredRecipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} onClick={(r) => { setSelectedRecipe(r); setView(AppView.DETAIL); }} />
              ))}
              {filteredRecipes.length === 0 && <div className="col-span-full py-20 text-center text-orange-200 font-bold bg-white rounded-[32px] border border-dashed border-orange-100">目前沒有任何食譜，點擊下方「建立」來新增吧！</div>}
            </div>
          )}

          {view === AppView.SCALING && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl font-black text-[#E67E22] flex items-center gap-2 print:hidden">分量換算</h2>
              <div className="bg-white px-4 py-8 sm:p-8 rounded-[40px] border border-orange-50 shadow-md space-y-10 print:hidden">
                <div>
                  <label className="block text-lg font-black text-slate-700 mb-3">1. 選擇食譜</label>
                  <select 
                    value={scalingRecipeId || ''} 
                    onChange={(e) => {
                      setScalingRecipeId(e.target.value);
                      const r = recipes.find(rec => rec.id === e.target.value);
                      if (r) setTargetQuantity(r.quantity || 1);
                    }}
                    className="w-full px-5 py-4 bg-orange-50/30 border-2 border-orange-100 rounded-2xl text-lg font-bold outline-none focus:border-orange-300 transition-all"
                  >
                    <option value="">-- 請選擇食譜 --</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>

                {scalingRecipe && (
                  <div className="space-y-12 animate-in fade-in">
                    <div className="space-y-6">
                      <label className="block text-lg font-black text-slate-700">2. 產量換算</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-sm sm:text-base font-black text-green-600 uppercase tracking-wider">食譜基準</label>
                          <div className="bg-slate-50 p-5 rounded-2xl text-center text-3xl font-black text-slate-400 border border-slate-100">{scalingRecipe.quantity || 1} 份</div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-sm sm:text-base font-black text-[#E67E22] uppercase tracking-wider">目標產出</label>
                          <div className="relative">
                            <input type="number" step="0.1" value={targetQuantity} onChange={(e) => setTargetQuantity(Math.max(0.1, parseFloat(e.target.value) || 1))} className="w-full p-5 bg-orange-50 border-2 border-orange-200 rounded-2xl text-3xl font-black text-orange-600 text-center outline-none focus:border-orange-400 transition-all pr-12" />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-400 pointer-events-none">份</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`bg-orange-50/20 rounded-[40px] border border-orange-100 overflow-hidden transition-all duration-500 ease-in-out ${(['餡料', '果醬', '抹醬/其他'].includes(scalingRecipe?.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2000px] opacity-100'}`}>
                      <button 
                        type="button"
                        onClick={() => setIsMoldPanelOpen(!isMoldPanelOpen)}
                        className="w-full px-6 py-5 flex items-center justify-between bg-orange-100/30 hover:bg-orange-100/50 transition-colors text-left"
                      >
                        <span className="text-lg font-black text-orange-700">3. 模具體積換算 (跨形狀互換工具)</span>
                        <span className={`text-orange-400 transition-transform duration-300 ${isMoldPanelOpen ? 'rotate-180' : ''}`}>▼</span>
                      </button>


                      <div className={`transition-all duration-500 ease-in-out ${isMoldPanelOpen ? 'max-h-[2000px] opacity-100 py-8 px-4 sm:p-8' : 'max-h-0 opacity-0 py-0 px-4 overflow-hidden'}`}>
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-5">
                              <div className="flex flex-col gap-3 px-1">
                                 <span className="text-sm sm:text-base font-black text-slate-500 uppercase tracking-widest">原本食譜模具</span>
                                 <select onChange={(e) => handleApplyMoldPreset('source', e.target.value)} className="w-full px-4 py-3 bg-white border border-orange-100 rounded-xl text-sm font-bold outline-none">
                                    {MOLD_PRESETS.map(p => <option key={`src-preset-${p.name}`} value={p.name}>{p.name}</option>)}
                                 </select>
                                 <div className="flex bg-white rounded-xl p-1.5 border border-orange-100 shadow-sm mt-1">
                                    <button type="button" onClick={() => setSourceMold(p => ({...p, type: 'circular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                    <button type="button" onClick={() => setSourceMold(p => ({...p, type: 'rectangular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
                                 </div>
                              </div>
                              <div className="bg-white p-6 rounded-3xl border border-orange-50 space-y-4 shadow-sm">
                                {sourceMold.type === 'circular' ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-slate-400 w-12">直徑</span>
                                    <div className="relative flex-1">
                                      <input type="number" value={sourceMold.diameter || ''} onChange={e => setSourceMold(p => ({...p, diameter: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">長度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={sourceMold.length || ''} onChange={e => setSourceMold(p => ({...p, length: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">寬度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={sourceMold.width || ''} onChange={e => setSourceMold(p => ({...p, width: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                                  <span className="text-base font-bold text-slate-400 w-12">高度</span>
                                  <div className="relative flex-1">
                                    <input type="number" value={sourceMold.height || ''} onChange={e => setSourceMold(p => ({...p, height: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-5">
                              <div className="flex flex-col gap-3 px-1">
                                 <span className="text-sm sm:text-base font-black text-[#E67E22] uppercase tracking-widest">我要用的模具</span>
                                 <select onChange={(e) => handleApplyMoldPreset('target', e.target.value)} className="w-full px-4 py-3 bg-white border border-orange-100 rounded-xl text-sm font-bold outline-none">
                                    {MOLD_PRESETS.map(p => <option key={`tgt-preset-${p.name}`} value={p.name}>{p.name}</option>)}
                                 </select>
                                 <div className="flex bg-white rounded-xl p-1.5 border border-orange-100 shadow-sm mt-1">
                                    <button type="button" onClick={() => setTargetMold(p => ({...p, type: 'circular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                    <button type="button" onClick={() => setTargetMold(p => ({...p, type: 'rectangular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
                                 </div>
                              </div>
                              <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-md">
                                {targetMold.type === 'circular' ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-slate-400 w-12">直徑</span>
                                    <div className="relative flex-1">
                                      <input type="number" value={targetMold.diameter || ''} onChange={e => setTargetMold(p => ({...p, diameter: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">長度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={targetMold.length || ''} onChange={e => setTargetMold(p => ({...p, length: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">寬度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={targetMold.width || ''} onChange={e => setTargetMold(p => ({...p, width: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-3 border-t border-orange-50 pt-3">
                                  <span className="text-base font-bold text-slate-400 w-12">高度</span>
                                  <div className="relative flex-1">
                                    <input type="number" value={targetMold.height || ''} onChange={e => setTargetMold(p => ({...p, height: parseFloat(e.target.value) || 0}))} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-8 pt-6 border-t border-orange-100/50">
                            <div className="flex-1 text-center sm:text-left">
                              <span className="text-base sm:text-lg font-black text-slate-500 uppercase tracking-widest">總換算倍率</span>
                              <div className="text-5xl sm:text-6xl font-black text-orange-600 tabular-nums mt-1">
                                {scalingFactor.toFixed(2)}
                                <span className="text-xl ml-1">x</span>
                              </div>
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-orange-500 italic bg-orange-50 px-5 py-3 rounded-2xl border border-orange-100 shadow-sm">
                              💡 倍率已自動即時套用至下方清單
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {scalingRecipe && (
                <div className="pt-6 border-t border-orange-50">
                  {/* 列印專用標題 */}
                  <div className="hidden print:block mb-8 border-b-2 border-orange-200 pb-4">
                    <h1 className="text-3xl font-black text-slate-800">{scalingRecipe.title} (換算後)</h1>
                    <p className="text-orange-600 font-bold mt-2">換算倍率: {scalingFactor.toFixed(2)}x</p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 mb-8 print:hidden">
                    <h3 className="text-xl font-black text-slate-800">換算結果清單</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
                      <span className="text-sm sm:text-sm font-black text-orange-500 bg-orange-50 px-6 py-2.5 rounded-full border border-orange-100 shadow-sm">目前總倍率: {scalingFactor.toFixed(2)}x</span>
                      <button 
                        onClick={() => window.print()} 
                        className="w-auto px-6 py-3 bg-orange-500 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-orange-600 transition-all flex items-center gap-2 active:scale-95"
                      >
                        <span className="text-xl">🖨️</span>
                        <span>列印 / 存為 PDF</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-orange-50/20 px-4 py-8 sm:p-8 rounded-[40px] border border-orange-50 print:bg-white print:border-none print:p-0 max-w-3xl mx-auto">
                    {scalingRecipe.sectionsOrder?.map(secKey => {
                       if (secKey === 'ingredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.ingredients} title={scalingRecipe.mainSectionName || "主麵團"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'liquidStarterIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.liquidStarterIngredients || []} title={scalingRecipe.liquidStarterName || "發酵種"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'fillingIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.fillingIngredients || []} title={scalingRecipe.fillingSectionName || "內餡"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'decorationIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.decorationIngredients || []} title={scalingRecipe.decorationSectionName || "裝飾 / 表面"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'customSectionIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.customSectionIngredients || []} title={scalingRecipe.customSectionName || "其他區塊"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       return null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === AppView.COLLECTION && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 no-print">
              <h2 className="text-2xl font-black text-[#E67E22] flex items-center gap-2">烘焙知識庫</h2>
              <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-700">✍️ 新增心得或技巧</h3>
                  <input type="text" placeholder="標題 (例如：鹽可頌滾圓)" value={newNote.title || ''} onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-2 bg-orange-50/30 rounded-xl text-sm outline-none border border-orange-50 focus:border-orange-200 transition-all" />
                  <input type="text" placeholder="師傅/老師名稱" value={newNote.master || ''} onChange={e => setNewNote(p => ({ ...p, master: e.target.value }))} className="w-full px-4 py-2 bg-orange-50/30 rounded-xl text-sm outline-none border border-orange-50 focus:border-orange-200 transition-all" />
                  <textarea placeholder="重點內容或連結..." value={newNote.content || ''} onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))} className="w-full px-4 py-3 bg-orange-50/30 rounded-xl text-sm outline-none border border-orange-50 h-24 transition-all focus:border-orange-200" />
                  <button onClick={handleAddNote} className="w-full py-3 bg-[#E67E22] text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all hover:bg-orange-600">新增筆記</button>
                </div>
                <div className="pt-6 space-y-4 border-t border-orange-50">
                  {knowledge.map(kn => (
                    <div key={kn.id} className="p-5 bg-orange-50/20 rounded-2xl border border-orange-50 relative group transition-all hover:shadow-sm">
                      <button onClick={() => triggerConfirm(() => setKnowledge(knowledge.filter(k => k.id !== kn.id)))} className="absolute top-4 right-4 text-xs text-red-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500">移除</button>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-800 text-base">{kn.title}</h4>
                        <span className="text-[10px] text-orange-400 font-bold bg-white px-2 py-0.5 rounded shadow-sm">{kn.master}</span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{kn.content}</p>
                      <div className="mt-3 text-[10px] text-orange-200">{new Date(kn.createdAt).toLocaleDateString('zh-TW')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(view === AppView.CREATE || view === AppView.EDIT) && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 no-print">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-[#E67E22]">{view === AppView.CREATE ? '建立新配方' : '編輯配方'}</h2>
                <button onClick={() => setView(AppView.MANAGE_CATEGORIES)} className="p-2.5 bg-white border border-orange-100 rounded-xl shadow-sm text-sm font-bold text-orange-600 flex items-center gap-2 hover:bg-orange-50 transition-all active:scale-95">⚙️ 分類管理</button>
              </div>
              <div className="space-y-6 px-4 sm:px-0">
                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-6">
                  {/* 第一排：配方名稱、師傅 */}
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={formRecipe.title || ''} onChange={e => setFormRecipe(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-50 outline-none text-sm focus:border-orange-200" placeholder="配方名稱" />
                    <input type="text" value={formRecipe.master || ''} onChange={e => setFormRecipe(p => ({ ...p, master: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-50 outline-none text-sm focus:border-orange-200" placeholder="師傅" />
                  </div>

            {/* 第二排：分類下拉選單 與 保存期限 與 總時長 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="w-full">
                <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">📂 分類</label>
                <select value={formRecipe.category || ''} onChange={e => setFormRecipe(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="w-full">
                <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🕒 保存期限</label>
                <input type="text" value={formRecipe.shelfLife || ''} onChange={e => setFormRecipe(p => ({ ...p, shelfLife: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" placeholder="例如：常溫 2 天" />
              </div>
              <div className="w-full">
                <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">⏲️ 總時長</label>
                <input type="text" value={formRecipe.totalDuration || ''} onChange={e => setFormRecipe(p => ({ ...p, totalDuration: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" placeholder="例如：45 分鐘、3 小時" />
              </div>
            </div>

                  {/* 第三排：⚖️ 麵團/糊 (g)、🌰 內餡 (g)、🔢 製作份數 */}
                  <div className="space-y-6">
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${(['餡料', '果醬', '抹醬/其他'].includes(formRecipe.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[500px] opacity-100'}`}>
                      {formRecipe.category === '中式點心' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="relative">
                            <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">⚖️ 皮重(g)</label>
                            <input type="text" value={formRecipe.crustWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, crustWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">🧈 油酥重(g)</label>
                            <input type="text" value={formRecipe.oilPasteWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, oilPasteWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">🌰 餡重(g)</label>
                            <input type="text" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">⚖️ 麵團/糊 (g)</label>
                            <input type="text" value={formRecipe.doughWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, doughWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🌰 內餡 (g)</label>
                            <input type="text" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🔢 製作份數</label>
                      <input type="number" value={formRecipe.quantity ?? ''} onChange={e => setFormRecipe(p => ({ ...p, quantity: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                  </div>


                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">老師分享日 📅</label>
                      <input type="date" value={formRecipe.sourceDate || ''} onChange={e => setFormRecipe(p => ({ ...p, sourceDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                    <div className="relative">
                      <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">記錄日期 📝</label>
                      <input type="date" value={formRecipe.recordDate || ''} onChange={e => setFormRecipe(p => ({ ...p, recordDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                  </div>

                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${(['餡料', '果醬', '抹醬/其他'].includes(formRecipe.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[200px] opacity-100'}`}>
                    <div className="w-full">
                      <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🍞 模具規格/烤盤</label>
                      <input type="text" value={formRecipe.moldName || ''} onChange={e => setFormRecipe(p => ({ ...p, moldName: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" placeholder="模具規格" />
                    </div>
                  </div>

                </div>

                {/* 職人新增：食譜來源與紀錄區塊 */}
                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">食譜來源與紀錄</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-500 ml-1">📖 書名</label>
                      <input 
                        type="text" 
                        value={formRecipe.sourceName || ''} 
                        onChange={e => setFormRecipe(p => ({ ...p, sourceName: e.target.value }))} 
                        className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                        placeholder="書名" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-500 ml-1">💻 線上課</label>
                      <input 
                        type="text" 
                        value={formRecipe.onlineCourse || ''} 
                        onChange={e => setFormRecipe(p => ({ ...p, onlineCourse: e.target.value }))} 
                        className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                        placeholder="線上課程" 
                      />
                    </div>
                    {/* 動態連結清單 */}
                    <div className="space-y-3">
                      {(formRecipe.sourceLinks || []).map((link, idx) => (
                        <div key={idx} className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100 space-y-3 relative group animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            type="button" 
                            onClick={() => triggerConfirm(() => setFormRecipe(p => ({ ...p, sourceLinks: (p.sourceLinks || []).filter((_, i) => i !== idx) })))}
                            className="absolute top-2 right-2 p-2 text-red-300 hover:text-red-500 transition-colors"
                          >
                            🗑️
                          </button>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-500 ml-1">🏷️ 網址名稱</label>
                            <input 
                              type="text" 
                              value={link.name} 
                              onChange={e => {
                                const newLinks = [...(formRecipe.sourceLinks || [])];
                                newLinks[idx] = { ...newLinks[idx], name: e.target.value };
                                setFormRecipe(p => ({ ...p, sourceLinks: newLinks }));
                              }}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-orange-100 outline-none text-sm focus:border-orange-200" 
                              placeholder="例如：FB影片、課程連結" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-500 ml-1">🌐 網址連結</label>
                            <input 
                              type="text" 
                              value={link.url} 
                              onChange={e => {
                                const newLinks = [...(formRecipe.sourceLinks || [])];
                                newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                                setFormRecipe(p => ({ ...p, sourceLinks: newLinks }));
                              }}
                              className="w-full px-4 py-3 rounded-xl bg-white border border-orange-100 outline-none text-sm focus:border-orange-200" 
                              placeholder="https://..." 
                            />
                          </div>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={() => setFormRecipe(p => ({ ...p, sourceLinks: [...(p.sourceLinks || []), { name: '', url: '' }] }))}
                        className="w-full py-3 rounded-2xl border-2 border-dashed border-orange-100 text-orange-400 text-xs font-black hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <span>＋ 新增其他連結</span>
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-500 ml-1">📖 頁碼</label>
                        <input 
                          type="text" 
                          value={formRecipe.sourcePage || ''} 
                          onChange={e => setFormRecipe(p => ({ ...p, sourcePage: e.target.value }))}
                          className="w-full h-14 px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                          placeholder="書本或講義頁碼" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black text-slate-500 ml-1">📝 心得備註</label>
                        <input 
                          type="text" 
                          value={formRecipe.sourceNote || ''} 
                          onChange={e => setFormRecipe(p => ({ ...p, sourceNote: e.target.value }))}
                          className="w-full h-14 px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                          placeholder="製作心得或老師叮嚀" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-6">
                  <div className="w-full"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">🏷️ 心得標籤</label><input type="text" value={(formRecipe.tags || []).join(', ')} onChange={e => handleTagsInput(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm" placeholder="逗號分隔" /></div>
                  <div className="w-full flex gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                      <input type="checkbox" checked={formRecipe.isBakingRecipe} onChange={(e) => setFormRecipe(prev => ({ ...prev, isBakingRecipe: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                      <span className="text-[10px] font-black text-orange-600 uppercase">烘焙百分比模式</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                      <input type="checkbox" checked={formRecipe.isTried} onChange={(e) => setFormRecipe(prev => ({ ...prev, isTried: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                      <span className="text-[10px] font-black text-orange-600 uppercase">待嘗試</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="block text-xs font-black text-orange-600 uppercase tracking-widest">📸 圖片預覽與上傳</label>
                  <div className="aspect-video bg-orange-50/30 rounded-2xl border-2 border-dashed border-orange-100 flex items-center justify-center overflow-hidden relative group">
                    {formRecipe.imageUrl ? (
                      <>
                        <img src={formRecipe.imageUrl} className="w-full h-full object-cover" alt="預覽" />
                        <button 
                          type="button"
                          onClick={() => setFormRecipe(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute top-3 right-3 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center text-lg hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                          title="移除照片"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className="text-orange-200 text-sm font-bold">尚未上傳圖片</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <button onClick={() => recipeImageInputRef.current?.click()} className="py-5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all">
                      選擇並上傳作品照片
                    </button>
                  </div>
                  <input type="file" ref={recipeImageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>

                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${(['餡料', '果醬', '抹醬/其他'].includes(formRecipe.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[5000px] opacity-100 mt-6'}`}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-orange-600 uppercase tracking-widest">發酵時序</label>
                      <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, fermentationStages: [...(prev.fermentationStages || []), { name: '', time: '', temperature: '', humidity: '' }] }))} className="text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all">＋新增階段</button>
                    </div>
                    <div className="space-y-6">
                      {formRecipe.fermentationStages?.map((stage, idx) => (
                        <div key={`edit-ferment-${idx}`} className="bg-white p-5 rounded-[28px] border border-orange-50 space-y-4 shadow-sm">
                          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-orange-50 pb-3 gap-2">
                            <div className="flex-grow w-full space-y-2 text-left">
                              <label className="block text-xs font-black text-slate-500 uppercase ml-1">階段名稱</label>
                              <input 
                                type="text" 
                                value={stage.name || ''} 
                                onChange={(e) => handleUpdateFermentationStage(idx, 'name', e.target.value)} 
                                className="w-full px-4 py-3 bg-orange-50/30 border border-orange-100 rounded-xl text-lg font-bold outline-none focus:border-orange-200 text-left" 
                                placeholder="例如：基本發酵" 
                              />
                            </div>
                            <button 
                              onClick={() => triggerConfirm(() => setFormRecipe(p => ({ ...p, fermentationStages: p.fermentationStages?.filter((_, i) => i !== idx) })))} 
                              className="text-red-300 hover:text-red-500 text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors pb-2 px-1"
                            >
                              移除
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4 sm:gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">⏲️ 時間</label>
                              <div className="flex flex-row w-full">
                                <input 
                                  type="text" 
                                  value={stage.time || ''} 
                                  onChange={(e) => handleUpdateFermentationStage(idx, 'time', e.target.value)} 
                                  className="w-[65%] px-4 h-16 rounded-l-2xl rounded-r-none border border-r-0 border-orange-100 bg-orange-50/30 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                  placeholder="45" 
                                />
                                <select
                                  value={stage.timeUnit || '分鐘'}
                                  onChange={(e) => handleUpdateFermentationStage(idx, 'timeUnit', e.target.value as any)}
                                  className="w-[35%] h-16 rounded-r-2xl rounded-l-none border border-orange-100 bg-orange-50/30 outline-none text-lg font-bold text-slate-800 focus:border-orange-200 text-center appearance-none cursor-pointer"
                                >
                                  <option value="分鐘">分鐘</option>
                                  <option value="小時">小時</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">🌡️ 溫度</label>
                              <input 
                                type="text" 
                                value={stage.temperature || ''} 
                                onChange={(e) => handleUpdateFermentationStage(idx, 'temperature', e.target.value)} 
                                className="w-full px-4 h-16 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                placeholder="°C" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">💧 濕度</label>
                              <input 
                                type="text" 
                                value={stage.humidity || ''} 
                                onChange={(e) => handleUpdateFermentationStage(idx, 'humidity', e.target.value)} 
                                className="w-full px-4 h-16 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                placeholder="%" 
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase ml-1">階段備註</label>
                            <textarea 
                              value={stage.note || ''} 
                              onChange={(e) => handleUpdateFermentationStage(idx, 'note', e.target.value)} 
                              className="w-full px-4 py-4 bg-[#F5E6D3] border border-orange-100 rounded-2xl text-base font-bold outline-none focus:border-orange-200 min-h-[80px] leading-relaxed" 
                              placeholder="例如：發酵至兩倍大" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-orange-600 uppercase tracking-widest">烤溫設定</label>
                      <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, bakingStages: [...(prev.bakingStages || []), { name: `STAGE ${prev.bakingStages?.length ? prev.bakingStages.length + 1 : 1}`, topHeat: '', bottomHeat: '', time: '', note: '' }] }))} className="text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all">＋新增階段</button>
                    </div>
                    <div className="space-y-6">
                      {formRecipe.bakingStages?.map((stage, idx) => (
                        <div key={`edit-bake-${idx}`} className="bg-white p-5 rounded-[28px] border border-orange-50 space-y-4 shadow-sm">
                          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-orange-50 pb-3 gap-2">
                            <div className="flex-grow w-full space-y-2 text-left">
                              <label className="block text-xs font-black text-slate-500 uppercase ml-1">階段名稱</label>
                              <input 
                                type="text" 
                                value={stage.name || ''} 
                                onChange={(e) => handleUpdateBakingStage(idx, 'name', e.target.value)} 
                                className="w-full lg:w-64 text-base font-black text-slate-700 uppercase tracking-widest bg-orange-50/50 px-4 py-3 rounded-2xl outline-none focus:border-orange-200 border border-transparent text-left" 
                                placeholder="例如：STAGE 1"
                              />
                            </div>
                            <button 
                              onClick={() => triggerConfirm(() => setFormRecipe(p => ({ ...p, bakingStages: p.bakingStages?.filter((_, i) => i !== idx) })))} 
                              className="text-red-300 hover:text-red-500 text-xs font-bold transition-colors pb-2 px-1"
                            >
                              移除
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-4 sm:gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">⏲️ 時間</label>
                              <div className="flex flex-row w-full">
                                <input 
                                  type="text" 
                                  value={stage.time || ''} 
                                  onChange={(e) => handleUpdateBakingStage(idx, 'time', e.target.value)} 
                                  className="w-[65%] px-4 h-16 rounded-l-2xl rounded-r-none border border-r-0 border-orange-100 bg-orange-50/30 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                  placeholder="15" 
                                />
                                <select
                                  value={stage.timeUnit || '分鐘'}
                                  onChange={(e) => handleUpdateBakingStage(idx, 'timeUnit', e.target.value as any)}
                                  className="w-[35%] h-16 rounded-r-2xl rounded-l-none border border-orange-100 bg-orange-50/30 outline-none text-lg font-bold text-slate-800 focus:border-orange-200 text-center appearance-none cursor-pointer"
                                >
                                  <option value="分鐘">分鐘</option>
                                  <option value="小時">小時</option>
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">🔥 上火</label>
                              <input 
                                type="text" 
                                value={stage.topHeat || ''} 
                                onChange={(e) => handleUpdateBakingStage(idx, 'topHeat', e.target.value)} 
                                className="w-full px-4 h-16 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                placeholder="°C" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-black text-slate-600 ml-1">🔥 下火</label>
                              <input 
                                type="text" 
                                value={stage.bottomHeat || ''} 
                                onChange={(e) => handleUpdateBakingStage(idx, 'bottomHeat', e.target.value)} 
                                className="w-full px-4 h-16 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-xl font-bold text-slate-800 focus:border-orange-200 text-center" 
                                placeholder="°C" 
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase ml-1">階段備註</label>
                            <textarea 
                              value={stage.note || ''} 
                              onChange={(e) => handleUpdateBakingStage(idx, 'note', e.target.value)} 
                              className="w-full px-4 py-4 bg-[#F5E6D3] border border-orange-100 rounded-2xl text-base font-bold outline-none focus:border-orange-200 min-h-[80px] leading-relaxed" 
                              placeholder="例如：噴水、開氣門" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>


                <div className="space-y-6">
                   {currentOrder.map((sec, idx) => {
                      const onMove = (dir: 'up' | 'down') => moveSection(idx, dir);
                      if (sec === 'ingredients') return <IngredientList key={sec} items={formRecipe.ingredients || []} title="主麵團" fieldKey="ingredients" customTitleKey="mainSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} />;
                      if (sec === 'liquidStarterIngredients') return <IngredientList key={sec} items={formRecipe.liquidStarterIngredients || []} title="發酵種" fieldKey="liquidStarterIngredients" customTitleKey="liquidStarterName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} />;
                      if (sec === 'fillingIngredients') return <IngredientList key={sec} items={formRecipe.fillingIngredients || []} title="內餡" fieldKey="fillingIngredients" customTitleKey="fillingSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} />;
                      if (sec === 'decorationIngredients') return <IngredientList key={sec} items={formRecipe.decorationIngredients || []} title="裝飾" fieldKey="decorationIngredients" customTitleKey="decorationSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} />;
                      if (sec === 'customSectionIngredients') return <IngredientList key={sec} items={formRecipe.customSectionIngredients || []} title="其他區塊" fieldKey="customSectionIngredients" customTitleKey="customSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} />;
                      return null;
                    })}
                </div>

                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-orange-600 uppercase tracking-widest">製作步驟 (做法)</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, instructions: [...(prev.instructions || []), '[SECTION]'] }))} className="text-[10px] font-bold bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all border border-orange-100">＋加入分段</button>
                      <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, instructions: [...(prev.instructions || []), ''] }))} className="text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all">＋新增步驟</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      let stepNumber = 0;
                      return (formRecipe.instructions || []).map((inst, idx) => {
                        const isHeader = inst.startsWith('[SECTION]');
                        const content = isHeader ? inst.replace('[SECTION]', '') : inst;
                        if (isHeader) stepNumber = 0;
                        else stepNumber++;
                        
                        return (
                          <div key={`inst-${idx}`} className={`flex gap-2 items-start group ${isHeader ? 'mt-6 mb-2' : ''}`}>
                            <div className="flex flex-col items-center gap-1 mt-1.5 shrink-0">
                              {!isHeader ? (
                                <span className="w-6 h-6 bg-orange-100 text-[#E67E22] font-black rounded-lg flex items-center justify-center text-[10px]">{stepNumber}</span>
                              ) : (
                                <span className="w-6 h-6 bg-orange-500 text-white font-black rounded-lg flex items-center justify-center text-[10px]">#</span>
                              )}
                              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => {
                                  if (idx === 0) return;
                                  const newInst = [...(formRecipe.instructions || [])];
                                  [newInst[idx], newInst[idx-1]] = [newInst[idx-1], newInst[idx]];
                                  setFormRecipe(p => ({ ...p, instructions: newInst }));
                                }} className="text-slate-300 hover:text-orange-400 text-[10px] p-0.5">▲</button>
                                <button type="button" onClick={() => {
                                  if (idx === (formRecipe.instructions || []).length - 1) return;
                                  const newInst = [...(formRecipe.instructions || [])];
                                  [newInst[idx], newInst[idx+1]] = [newInst[idx+1], newInst[idx]];
                                  setFormRecipe(p => ({ ...p, instructions: newInst }));
                                }} className="text-slate-300 hover:text-orange-400 text-[10px] p-0.5">▼</button>
                              </div>
                            </div>
                            
                            {isHeader ? (
                              <input 
                                type="text"
                                value={content}
                                onChange={(e) => {
                                  const newInst = [...(formRecipe.instructions || [])];
                                  newInst[idx] = '[SECTION]' + e.target.value;
                                  setFormRecipe(p => ({ ...p, instructions: newInst }));
                                }}
                                className="flex-grow px-4 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-xs font-black text-orange-700 placeholder:text-orange-300 focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all"
                                placeholder="輸入分段名稱 (例如：焦糖、布丁液)..."
                              />
                            ) : (
                              <textarea 
                                value={content} 
                                onChange={(e) => { 
                                  const newInst = [...(formRecipe.instructions || [])]; 
                                  newInst[idx] = e.target.value; 
                                  setFormRecipe(p => ({ ...p, instructions: newInst })); 
                                }} 
                                className="flex-grow px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[60px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all" 
                                placeholder={`步驟 ${stepNumber} 說明...`} 
                              />
                            )}
                            <button type="button" onClick={() => { triggerConfirm(() => { const newInst = (formRecipe.instructions || []).filter((_, i) => i !== idx); setFormRecipe(p => ({ ...p, instructions: newInst })); }); }} className="text-red-300 hover:text-red-500 mt-2 transition-colors shrink-0">🗑️</button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest">食譜簡介 (列表顯示)</label>
                  <textarea value={formRecipe.description || ''} onChange={(e) => setFormRecipe(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs min-h-[100px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all" placeholder="簡單介紹這份配方的特色..." />
                </div>
                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest">📝 老師的小叮嚀</label>
                  <textarea value={formRecipe.notes || ''} onChange={(e) => setFormRecipe(p => ({ ...p, notes: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs min-h-[150px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all leading-relaxed" placeholder="紀錄製作時的心得、建議改進之處..." />
                </div>
                <div id="save-recipe-btn" className="pt-6"><button onClick={() => { if (!formRecipe.title) return; if (view === AppView.CREATE) { setRecipes(prev => [{ ...formRecipe as Recipe, id: 'rec-' + Date.now(), createdAt: Date.now() }, ...prev]); } else { setRecipes(prev => prev.map(r => r.id === formRecipe.id ? (formRecipe as Recipe) : r)); } showToast("食譜儲存成功！"); setView(AppView.LIST); }} className="w-full py-4 bg-[#E67E22] text-white rounded-3xl font-black text-lg shadow-lg active:scale-95">儲存配方</button></div>
              </div>
            </div>
          )}

          {showJumpBtn && (view === AppView.LIST || view === AppView.DETAIL || view === AppView.CREATE || view === AppView.EDIT || view === AppView.MANAGE_CATEGORIES) && (
            <button 
              onClick={() => {
                if (isAtBottom) {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                }
              }}
              className="fixed bottom-28 right-6 w-14 h-14 bg-[#E67E22] text-white rounded-full shadow-[0_8px_30px_rgb(230,126,34,0.4)] flex items-center justify-center z-[1001] animate-in fade-in slide-in-from-bottom-4 transition-all active:scale-90 hover:bg-orange-600 group overflow-hidden"
              title={isAtBottom ? "回到頂端" : "直達底部"}
            >
              <div className={`transition-transform duration-500 ease-in-out ${isAtBottom ? 'rotate-180' : 'rotate-0'}`}>
                <svg className="w-8 h-8 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          )}

          {view === AppView.MANAGE_CATEGORIES && (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border border-orange-50 animate-in zoom-in-95">
              <h2 className="text-xl font-black text-[#E67E22] mb-6">分類管理與排序</h2>
              <div className="flex gap-2 mb-8">
                <input type="text" value={newCatName || ''} onChange={(e) => setNewCatName(e.target.value)} className="flex-grow px-4 py-2 rounded-xl bg-orange-50/30 border border-orange-50 outline-none text-sm" placeholder="輸入新分類..." />
                <button onClick={() => { if(!newCatName.trim()) return; setCategories(prev=>[...prev,{id:'cat-'+Date.now(), name:newCatName.trim(), order:categories.length}]); setNewCatName(''); showToast("分類新增成功！"); }} className="bg-[#E67E22] text-white px-5 py-2 rounded-xl font-bold text-sm">新增</button>
              </div>
              <div className="space-y-3">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-orange-50/20 rounded-2xl border border-orange-50 shadow-sm">
                    <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { const nc = [...categories]; [nc[idx],nc[idx-1]] = [nc[idx-1],nc[idx]]; setCategories(nc.map((c,i)=>({...c,order:i}))); }} disabled={idx === 0} className="p-1.5 text-slate-300 disabled:opacity-10 hover:text-[#E67E22]">↑</button>
                      <button onClick={() => { const nc = [...categories]; [nc[idx],nc[idx+1]] = [nc[idx+1],nc[idx]]; setCategories(nc.map((c,i)=>({...c,order:i}))); }} disabled={idx === categories.length-1} className="p-1.5 text-slate-300 disabled:opacity-10 hover:text-[#E67E22]">↓</button>
                      <button onClick={() => triggerConfirm(() => setCategories(categories.filter(c=>c.id!==cat.id)))} className="p-1.5 text-red-200 hover:text-red-500 ml-2">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setView(AppView.CREATE)} className="w-full mt-10 py-3 bg-orange-50 text-orange-600 rounded-2xl font-black text-sm">返回建立頁面</button>
            </div>
          )}

          {view === AppView.DETAIL && selectedRecipe && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 print-area">
              {/* 圖片區塊：增加返回按鈕的對比度 */}
              <div className="relative aspect-video rounded-[32px] sm:rounded-[48px] overflow-hidden shadow-xl border-4 border-white print:rounded-2xl print:shadow-none print:border-none">
                <img src={selectedRecipe.imageUrl || 'https://picsum.photos/800/450?random=' + selectedRecipe.id} className="w-full h-full object-cover" alt={selectedRecipe.title} />
                <button 
                  onClick={() => setView(AppView.LIST)} 
                  className="absolute top-4 left-4 w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white text-lg transition-all hover:bg-black/50 no-print shadow-lg"
                >
                  ←
                </button>
              </div>

              {/* 標題資訊區塊：從圖片分離，改為白底黑字 */}
              <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-orange-50 shadow-sm -mt-10 sm:-mt-14 relative z-10 print:mt-0 print:shadow-none print:border-none print:p-0">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-black uppercase tracking-widest border border-orange-100 print:bg-white print:text-slate-500 print:border-slate-200">
                      {selectedRecipe.category}
                    </span>
                    {selectedRecipe.isTried && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-xs font-black rounded-full uppercase tracking-widest border border-orange-200">
                        待嘗試
                      </span>
                    )}
                    {selectedRecipe.shelfLife && (
                      <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-black border border-orange-100 flex items-center gap-1.5 shadow-sm print:bg-white print:text-slate-500 print:border-slate-200">
                        <span className="shrink-0">🕒</span>
                        <span className="break-words">{selectedRecipe.shelfLife}</span>
                      </span>
                    )}
                    {selectedRecipe.totalDuration && (
                      <span className="px-3 py-1 bg-orange-50 text-[#E67E22] rounded-full text-xs font-black border border-orange-100 flex items-center gap-1.5 shadow-sm print:bg-white print:text-slate-500 print:border-slate-200">
                        <span className="shrink-0">⏱️</span>
                        <span className="break-words">{formatTimeWithUnit(selectedRecipe.totalDuration)}</span>
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-800 leading-tight print:text-3xl">
                    {selectedRecipe.title}
                  </h2>

                  {selectedRecipe.tags && selectedRecipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedRecipe.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold border border-slate-200 print:bg-slate-50 print:text-slate-500 print:border-slate-200">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-50 space-y-2 print:text-slate-600">
                    <p className="text-base font-bold text-slate-600 flex items-center gap-1.5 print:text-sm">
                      師傅：{selectedRecipe.master} ｜ 分類：{selectedRecipe.category}
                    </p>
                    {(selectedRecipe.sourceDate || selectedRecipe.recordDate) && (
                      <div className="text-xs font-bold text-slate-400 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 print:text-xs print:text-slate-400">
                        {selectedRecipe.sourceDate && <span>分享日：{selectedRecipe.sourceDate}</span>}
                        {selectedRecipe.sourceDate && selectedRecipe.recordDate && <span className="mx-2 opacity-50 hidden sm:inline">｜</span>}
                        {selectedRecipe.recordDate && <span>紀錄日：{selectedRecipe.recordDate}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* 食譜出處區塊 */}
                {(selectedRecipe.sourceName || selectedRecipe.onlineCourse || selectedRecipe.sourceUrl || (selectedRecipe.sourceLinks && selectedRecipe.sourceLinks.length > 0) || selectedRecipe.sourceNote) && (
                  <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4 print:rounded-2xl print:border-slate-200">
                    <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest ml-1">食譜出處</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedRecipe.sourceName && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50">
                          <span className="text-lg">📖</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">書名</span>
                            <span className="text-sm font-bold text-slate-700">{selectedRecipe.sourceName}</span>
                          </div>
                        </div>
                      )}
                      {selectedRecipe.onlineCourse && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50">
                          <span className="text-lg">💻</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">線上課</span>
                            <span className="text-sm font-bold text-slate-700">{selectedRecipe.onlineCourse}</span>
                          </div>
                        </div>
                      )}
                      {/* 舊有單一連結相容 */}
                      {selectedRecipe.sourceUrl && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50 sm:col-span-2">
                          <span className="text-lg">🌐</span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">出處網址</span>
                            <div className="overflow-x-auto scrollbar-hide">
                              {selectedRecipe.sourceUrl.startsWith('http') ? (
                                <a href={selectedRecipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:underline whitespace-nowrap">
                                  {selectedRecipe.sourceUrl}
                                </a>
                              ) : (
                                <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{selectedRecipe.sourceUrl}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* 動態連結清單 */}
                      {(selectedRecipe.sourceLinks || []).map((link, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50 sm:col-span-2">
                          <span className="text-lg">🔗</span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">參考連結</span>
                            <div className="overflow-x-auto scrollbar-hide">
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:underline whitespace-nowrap">
                                {link.name || '點擊前往'}
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                      {selectedRecipe.sourcePage && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50">
                          <span className="text-lg">📖</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">頁碼</span>
                            <span className="text-sm font-bold text-slate-700">{selectedRecipe.sourcePage}</span>
                          </div>
                        </div>
                      )}
                      {selectedRecipe.sourceNote && (
                        <div className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50">
                          <span className="text-lg">📝</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase">心得備註</span>
                            <span className="text-sm font-bold text-slate-700">{selectedRecipe.sourceNote}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm flex flex-wrap gap-y-6 items-center justify-around text-center print:rounded-2xl print:border-slate-200">
                  {selectedRecipe.category === '中式點心' ? (
                    <>
                      <div className="flex-1 min-w-[80px] space-y-1.5"><div className="text-xs font-black text-slate-400 uppercase">⚖️ 皮重</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{selectedRecipe.crustWeight || 0}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div></div>
                      <div className="w-px h-10 bg-orange-50 hidden sm:block print:bg-slate-100" />
                      <div className="flex-1 min-w-[80px] space-y-1.5"><div className="text-xs font-black text-slate-400 uppercase">🧈 油酥</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{selectedRecipe.oilPasteWeight || 0}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div></div>
                      <div className="w-px h-10 bg-orange-50 hidden sm:block print:bg-slate-100" />
                      <div className="flex-1 min-w-[80px] space-y-1.5"><div className="text-xs font-black text-slate-400 uppercase">🍯 餡重</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{selectedRecipe.fillingWeight || 0}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div></div>
                      <div className="w-px h-10 bg-orange-50 hidden sm:block print:bg-slate-100" />
                      <div className="flex-1 min-w-[80px] space-y-1.5"><div className="text-xs font-black text-slate-400 uppercase">🔢 份數</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{selectedRecipe.quantity || 1}<span className="text-sm font-bold text-slate-400 ml-0.5">顆</span></div></div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-[100px] space-y-1.5">
                        <div className="text-xs font-black text-slate-400 uppercase">⚖️ 麵團/糊重量</div>
                        <div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">
                          {selectedRecipe.doughWeight || 0}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                        </div>
                      </div>

                      {/* 關鍵修正：確保這裡只有在「有內餡」時才顯示，否則不留任何 0 或欄位 */}
                      {selectedRecipe.fillingWeight && selectedRecipe.fillingWeight > 0 ? (
                        <>
                          <div className="w-px h-10 bg-orange-50 hidden sm:block print:bg-slate-100" />
                          <div className="flex-1 min-w-[100px] space-y-1.5">
                            <div className="text-xs font-black text-slate-400 uppercase">🍯 內餡重量</div>
                            <div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">
                              {selectedRecipe.fillingWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* 如果沒有內餡，就只放一個裝飾用的分隔線 */
                        <div className="w-px h-10 bg-orange-50 hidden sm:block print:bg-slate-100" />
                      )}

                      <div className="flex-1 min-w-[100px] space-y-1.5">
                        <div className="text-xs font-black text-slate-400 uppercase">🔢 製作份數</div>
                        <div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">
                          {selectedRecipe.quantity || 1}<span className="text-sm font-bold text-slate-400 ml-0.5">份</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {selectedRecipe.moldName && (<div className="bg-white px-6 py-4 rounded-[32px] border border-orange-50 shadow-sm flex items-center justify-center gap-3 print:rounded-2xl print:border-slate-200 print:py-2"><span className="text-xl">🍞</span><span className="text-xs font-black text-slate-400 uppercase">模具規格</span><div className="text-base font-black text-slate-700 print:text-sm">{selectedRecipe.moldName}</div></div>)}
              </div>
              
              <div className="flex flex-col gap-12 print:gap-6">
                <div className="print:p-0">
                  <div className="flex items-center justify-between mb-8 px-2 print:mb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 print:text-base">
                      <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                      食材配方
                    </h3>
                  </div>
                  <div className="space-y-6 max-w-3xl mx-auto">
                    {selectedRecipe.sectionsOrder?.map(secKey => {
                        const commonProps = {
                          isBaking: selectedRecipe.isBakingRecipe,
                          showPercentage: true
                        };
                        if (secKey === 'ingredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.ingredients} title={selectedRecipe.mainSectionName || "主麵團"} {...commonProps} />;
                        if (secKey === 'liquidStarterIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.liquidStarterIngredients || []} title={selectedRecipe.liquidStarterName || "發酵種"} {...commonProps} />;
                        if (secKey === 'fillingIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.fillingIngredients || []} title={selectedRecipe.fillingSectionName || "內餡"} {...commonProps} />;
                        if (secKey === 'decorationIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.decorationIngredients || []} title={selectedRecipe.decorationSectionName || "裝飾 / 表面"} {...commonProps} />;
                        if (secKey === 'customSectionIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.customSectionIngredients || []} title={selectedRecipe.customSectionName || "其他區塊"} {...commonProps} />;
                        return null;
                    })}
                  </div>
                </div>

                {(() => {
                  const hasFermentation = selectedRecipe.fermentationStages?.some(s => s.name || s.time || s.temperature || s.humidity);
                  const hasBaking = selectedRecipe.bakingStages?.some(s => s.name || s.time || s.topHeat || s.bottomHeat || s.note);

                  if (!hasFermentation && !hasBaking) return null;

                  return (
                    <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-6 max-w-3xl mx-auto w-full">
                      <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 px-2 print:text-base print:mb-4">
                        <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                        發酵與烤焙
                      </h3>
                      {hasFermentation && (
                        <div className="mb-10">
                          <h4 className="text-base font-black text-orange-500 uppercase tracking-widest mb-4 ml-1 print:text-black">發酵時序</h4>
                          <div className="space-y-4">
                            {selectedRecipe.fermentationStages?.map((stage, idx) => (
                              <div key={idx} className="flex flex-col p-6 bg-orange-50/20 rounded-3xl border border-orange-50 gap-y-2 print:bg-white print:border-slate-200">
                                <div className="text-xl font-black text-slate-800 print:text-lg text-left mb-2 lg:mb-0">{stage.name || `階段 ${idx+1}`}</div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 text-lg lg:text-xl font-black text-[#E67E22] tabular-nums border-t border-orange-100/50 pt-5 print:text-black print:border-slate-100">
                                  <div className="flex flex-col items-center gap-2"><span className="text-xs lg:text-sm text-slate-400 font-bold uppercase">時間</span><div className="flex items-center gap-1.5 whitespace-nowrap tracking-tighter">⏲️ {formatTimeWithUnit(stage.time, stage.timeUnit)}</div></div>
                                  <div className="flex flex-col items-center gap-2 border-y lg:border-y-0 lg:border-x border-orange-100/50 py-4 lg:py-0 print:border-slate-100"><span className="text-xs lg:text-sm text-slate-400 font-bold uppercase">溫度</span><div className="flex items-center gap-1.5">🌡️ {stage.temperature ? `${stage.temperature}°` : '--'}</div></div>
                                  <div className="flex flex-col items-center gap-2"><span className="text-xs lg:text-sm text-slate-400 font-bold uppercase">濕度</span><div className="flex items-center gap-1.5">💧 {stage.humidity ? `${stage.humidity}%` : '--'}</div></div>
                                </div>
                                {stage.note && (
                                  <div className="mt-4 p-4 bg-[#F5E6D3] rounded-2xl text-base font-bold text-slate-700 whitespace-pre-wrap leading-relaxed border border-orange-100/50">
                                    {stage.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {hasBaking && (
                        <div className="mb-8">
                          <h4 className="text-base font-black text-orange-500 uppercase tracking-widest mb-4 ml-1 print:text-black">烤焙參數</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                            {selectedRecipe.bakingStages?.map((stage, idx) => (
                              <div key={idx} className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm relative overflow-hidden print:rounded-xl print:border-slate-200">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-4 mb-8">
                                  <span className="text-lg font-black text-slate-800 uppercase tracking-wide text-left w-full lg:w-auto">{stage.name || `STAGE ${idx+1}`}</span>
                                  <span className="text-lg lg:text-xl font-black text-[#E67E22] bg-orange-50 px-5 py-2 rounded-2xl print:bg-slate-50 print:text-black flex items-center justify-center gap-2 shrink-0 w-full lg:w-auto">
                                    <span>⏲️</span>
                                    <span className="whitespace-nowrap tracking-tighter">{formatTimeWithUnit(stage.time, stage.timeUnit)}</span>
                                  </span>
                                </div>
                                <div className="flex flex-col lg:flex-row justify-around text-center items-center py-2 gap-8 lg:gap-0">
                                  <div className="flex-1 w-full"><div className="text-sm text-slate-400 font-bold uppercase mb-3">上火</div><div className="text-4xl font-black text-slate-800 tabular-nums print:text-2xl">{stage.topHeat}<span className="text-lg opacity-60 ml-1">°C</span></div></div>
                                  <div className="w-full h-px lg:w-px lg:h-16 bg-orange-100 print:bg-slate-100" />
                                  <div className="flex-1 w-full"><div className="text-sm text-slate-400 font-bold uppercase mb-3">下火</div><div className="text-4xl font-black text-slate-800 tabular-nums print:text-2xl">{stage.bottomHeat}<span className="text-lg opacity-60 ml-1">°C</span></div></div>
                                </div>
                                {stage.note && (
                                  <div className="mt-8 p-5 bg-[#F5E6D3] rounded-2xl text-base font-bold text-slate-700 whitespace-pre-wrap leading-relaxed border border-orange-100/50">
                                    {stage.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-6">
                  <div className="flex justify-between items-center mb-8 print:mb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 px-2 print:text-base">
                      <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                      製作步驟
                    </h3>
                    {selectedRecipe && (completedSteps[selectedRecipe.id] || []).length > 0 && (
                      <button 
                        onClick={() => triggerConfirm(() => resetProgress(selectedRecipe.id), "確認重置進度？", "這將會取消所有已勾選的製作步驟。", "確定重置")}
                        className="text-sm font-black text-orange-600 bg-orange-50 px-5 py-2.5 rounded-2xl border border-orange-100 shadow-sm hover:bg-orange-100 hover:text-orange-700 transition-all active:scale-95 flex items-center gap-2 print:hidden"
                      >
                        <span>🔄</span>
                        <span>重置進度</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-8 print:space-y-4">
                    {(() => {
                      let stepNumber = 0;
                      const currentCompleted = selectedRecipe ? (completedSteps[selectedRecipe.id] || []) : [];
                      
                      return (selectedRecipe.instructions || []).map((inst, idx) => {
                        const isHeader = inst.startsWith('[SECTION]');
                        const content = isHeader ? inst.replace('[SECTION]', '') : inst;
                        const isCompleted = currentCompleted.includes(idx);
                        
                        if (isHeader) {
                          stepNumber = 0;
                          return (
                            <div key={idx} className="pt-8 pb-2 border-b-2 border-orange-100 mb-6 print:pt-4 print:pb-1">
                              <h4 className="text-lg font-black text-orange-600 flex items-center gap-2 print:text-base">
                                <span className="w-1.5 h-6 bg-orange-400 rounded-full"></span>
                                {content || '未命名分段'}
                              </h4>
                            </div>
                          );
                        }

                        stepNumber++;
                        return (
                          <div key={idx} className="flex gap-4 sm:gap-6 items-start group print:gap-3">
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <button 
                                onClick={() => selectedRecipe && toggleStepCompleted(selectedRecipe.id, idx)}
                                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 print:hidden ${
                                  isCompleted 
                                    ? 'bg-orange-500 border-orange-500 text-white' 
                                    : 'bg-white border-orange-200 text-transparent hover:border-orange-400'
                                }`}
                              >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <span className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 font-black rounded-2xl flex items-center justify-center text-sm sm:text-base shadow-sm border transition-all print:w-6 print:h-6 print:text-xs print:rounded-lg ${
                                isCompleted 
                                  ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                  : 'bg-orange-50 text-[#E67E22] border-orange-100 group-hover:bg-orange-500 group-hover:text-white'
                              }`}>
                                {stepNumber}
                              </span>
                            </div>
                            <div className="flex-grow pt-1.5 sm:pt-2">
                              <p className={`text-base leading-relaxed font-bold tracking-wide transition-all print:text-sm ${
                                isCompleted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'
                              }`}>
                                {content}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                
                {selectedRecipe.notes && (
                  <div className="bg-yellow-50/50 p-8 rounded-[40px] border-2 border-yellow-100 shadow-sm relative overflow-hidden print:rounded-2xl print:border-slate-200 print:p-6 print:bg-white">
                    <h3 className="text-xl font-black text-yellow-700 mb-6 flex items-center gap-3 px-2 print:text-base print:text-black">
                      <span className="w-2 h-8 bg-yellow-500 rounded-full"></span>
                      📝 老師的小叮嚀
                    </h3>
                    <p className="text-base text-slate-700 leading-relaxed font-bold tracking-wide whitespace-pre-wrap px-2 print:text-sm">{selectedRecipe.notes}</p>
                  </div>
                )}

                <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm space-y-8 print:rounded-2xl print:border-slate-200 print:p-6">
                    <div className="flex justify-between items-center px-2">
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 print:text-base">
                        <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                        🕒 實作紀錄日記
                      </h3>
                      <button onClick={() => setIsAddingLog(!isAddingLog)} className="px-5 py-2 bg-orange-50 text-orange-600 rounded-full text-xs font-black border border-orange-100 no-print hover:bg-orange-100 transition-all">{isAddingLog ? '取消新增' : '+ 新增紀錄'}</button>
                    </div>
                    {isAddingLog && (
                      <div className="p-8 bg-orange-50/30 rounded-[32px] border border-orange-100 space-y-5 animate-in fade-in zoom-in-95 no-print">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><label className="text-[10px] font-black text-orange-400 uppercase">製作日期</label><input type="date" value={newLog.date || ''} onChange={e => setNewLog(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 bg-white rounded-xl border border-orange-100 outline-none text-sm" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black text-orange-400 uppercase">評分</label><select value={newLog.rating || 5} onChange={e => setNewLog(p => ({...p, rating: parseInt(e.target.value)}))} className="w-full px-3 py-2 bg-white rounded-xl border border-orange-100 outline-none text-sm font-bold"><option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option></select></div>
                        </div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-orange-400 uppercase">實作心得</label><textarea value={newLog.feedback || ''} onChange={e => setNewLog(p => ({...p, feedback: e.target.value}))} className="w-full px-3 py-2 bg-white rounded-xl border border-orange-100 outline-none text-sm min-h-[80px]" placeholder="今日口感如何？" /></div>
                        
                        {/* 實作紀錄照片上傳 */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-orange-400 uppercase">上傳成品照 (可選)</label>
                          <div className="space-y-3">
                            <button 
                              type="button"
                              onClick={() => logPhotoInputRef.current?.click()} 
                              className="w-full py-3 bg-white border border-orange-100 rounded-xl text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              {newLog.photoUrl ? '🔄 更換照片' : '📷 選擇照片'}
                            </button>
                            
                            {newLog.photoUrl && (
                              <div className="aspect-video w-full bg-orange-50/30 rounded-2xl border border-orange-100 flex items-center justify-center overflow-hidden relative group shadow-sm">
                                <img src={newLog.photoUrl} className="w-full h-full object-cover" alt="預覽" />
                                <button 
                                  type="button"
                                  onClick={() => setNewLog(p => ({ ...p, photoUrl: '' }))}
                                  className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center text-sm hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                                  title="移除照片"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                          <input type="file" ref={logPhotoInputRef} onChange={handleLogPhotoUpload} className="hidden" accept="image/*" />
                        </div>

                        <button onClick={handleAddLog} className="w-full py-3 bg-[#E67E22] text-white rounded-2xl font-black text-sm shadow-md hover:bg-orange-600 transition-all">儲存這筆紀錄</button>
                      </div>
                    )}
                    <div className="space-y-4">
                      {selectedRecipe.executionLogs && selectedRecipe.executionLogs.length > 0 ? (
                        selectedRecipe.executionLogs.slice(0, 50).map((log, idx) => (
                          <div key={log.id} className={`p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex gap-4 transition-all hover:bg-white print:bg-white print:border-slate-100 print:p-3 ${idx >= 3 ? 'print:hidden' : ''}`}>
                            <div className="flex-shrink-0 flex flex-col items-center gap-1"><div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-xl print:w-8 print:h-8 print:text-sm">👨‍🍳</div><span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{log.date}</span></div>
                            <div className="flex-grow space-y-1"><div className="flex justify-between items-start"><div className="text-orange-400 text-xs">{'⭐'.repeat(log.rating)}</div>{log.photoUrl && (<a href={log.photoUrl} target="_blank" rel="noreferrer" className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-orange-100 block print:hidden"><img src={log.photoUrl} className="w-full h-full object-cover" alt="作品" /></a>)}</div><p className="text-sm text-slate-600 font-bold leading-relaxed print:text-xs">{log.feedback}</p></div>
                          </div>
                        ))
                      ) : (<div className="py-10 text-center text-slate-300 font-bold border-2 border-dashed border-slate-50 rounded-3xl print:hidden">尚未有實作紀錄。</div>)}
                      {selectedRecipe.executionLogs && selectedRecipe.executionLogs.length > 3 && (<p className="hidden print:block text-[10px] text-slate-400 italic text-center">僅顯示最近三筆紀錄...</p>)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 relative z-[100] no-print">
                    <button onClick={() => { setFormRecipe(selectedRecipe); setView(AppView.EDIT); }} className="flex-grow py-5 bg-white border border-orange-100 rounded-[32px] font-black text-orange-600 shadow-sm active:scale-95 transition-all hover:bg-orange-50 text-base">編輯配方</button>
                    <button onClick={() => window.print()} className="flex-grow py-5 bg-orange-500 text-white rounded-[32px] font-black shadow-lg active:scale-95 transition-all hover:bg-orange-600 text-base flex items-center justify-center gap-2"><span>🖨️</span><span>列印 / 存為 PDF</span></button>
                    <button onClick={() => triggerConfirm(handleDeleteRecipe, "確認刪除食譜？", "妳確定要移除這份食譜嗎？此操作將會永久刪除所有相關資料。")} className="flex-grow py-5 bg-red-50 text-red-500 rounded-[32px] font-black shadow-sm active:scale-95 transition-all hover:bg-red-100 text-base">刪除配方</button>
                  </div>
                </div>
              </div>
            )}
          </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-orange-50 shadow-[0_-10px_30px_rgb(230,126,34,0.06)] px-4 sm:px-8 py-4 flex justify-around items-center z-[1000] rounded-t-[40px] animate-in slide-in-from-bottom-10 duration-500 print:hidden">
        <button onClick={() => setView(AppView.LIST)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.LIST ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">🏠</span><span className="text-[10px] font-black">首頁</span></button>
        <button onClick={handleCreateNew} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.CREATE || view === AppView.EDIT || view === AppView.MANAGE_CATEGORIES ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">📝</span><span className="text-[10px] font-black">食譜</span></button>
        <button onClick={() => setView(AppView.SCALING)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.SCALING ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">⚖️</span><span className="text-[10px] font-black">換算</span></button>
        <button onClick={() => setView(AppView.COLLECTION)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.COLLECTION ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">📥</span><span className="text-[10px] font-black">收集</span></button>
      </nav>

      <ConfirmDialog 
        isOpen={confirmConfig?.isOpen || false}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        confirmLabel={confirmConfig?.confirmLabel}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />
      <Toast 
        isOpen={toast.show} 
        message={toast.message} 
        onClose={() => setToast(p => ({ ...p, show: false }))} 
      />
    </div>
  );
};

export default App;
