
import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- 1. 類型定義 (原 types.ts 內容) ---
export enum AppView { LIST, CREATE, EDIT, DETAIL, SCALING, COLLECTION, MANAGE_CATEGORIES }

export interface Ingredient { name: string; amount: string | number; unit: string; isFlour: boolean; }
export interface FermentationStage { name: string; time: string; temperature: string; humidity: string; }
export interface BakingStage { name: string; topHeat: string; bottomHeat: string; time: string; note: string; }
export interface ExecutionLog { id: string; date: string; rating: number; feedback: string; photoUrl?: string; }
export interface Knowledge { id: string; title: string; content: string; master: string; createdAt: number; }
export interface Resource { id: string; title: string; url: string; category: string; }

export interface Recipe {
  id: string; title: string; master: string; sourceName?: string; sourceUrl?: string; sourceDate?: string; recordDate: string;
  category: string; description: string; imageUrl: string; ingredients: Ingredient[]; instructions: string[];
  mainSectionName?: string; liquidStarterName?: string; liquidStarterIngredients?: Ingredient[];
  fillingIngredients?: Ingredient[]; decorationIngredients?: Ingredient[];
  customSectionName?: string; customSectionIngredients?: Ingredient[];
  sectionsOrder?: string[]; isBakingRecipe: boolean; isTried: boolean;
  fermentationStages?: FermentationStage[]; bakingStages?: BakingStage[];
  notes?: string; tags?: string[]; moldName?: string;
  doughWeight?: number; crustWeight?: number; oilPasteWeight?: number; fillingWeight?: number;
  quantity?: number; createdAt: number; executionLogs?: ExecutionLog[];
}

interface Category { id: string; name: string; order: number; }

// --- 2. 內部小組件 (原 components 內容) ---
const RecipeCard: React.FC<{ recipe: Recipe; onClick: (r: Recipe) => void }> = ({ recipe, onClick }) => (
  <div onClick={() => onClick(recipe)} className="bg-white rounded-[32px] overflow-hidden border border-orange-50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
    <div className="aspect-[16/10] relative overflow-hidden">
      <img src={recipe.imageUrl || 'https://picsum.photos/400/250?random=' + recipe.id} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={recipe.title} />
      {recipe.isTried && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-orange-100/90 backdrop-blur-sm text-orange-600 text-[10px] font-black rounded-full border border-orange-200/50">⏳ 待嘗試</div>
      )}
    </div>
    <div className="p-5">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-black text-slate-800 line-clamp-1">{recipe.title}</h3>
        <span className="text-[10px] font-bold text-orange-400 bg-orange-50 px-2 py-0.5 rounded-md">{recipe.category}</span>
      </div>
      <p className="text-xs text-slate-400 font-bold mb-3">師傅：{recipe.master}</p>
      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed h-8">{recipe.description || '點擊查看詳細配方...'}</p>
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
  { id: 'cat-6', name: '中式點心', order: 5 }
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

const DisplayIngredientSection: React.FC<{ 
  ingredients: Ingredient[], title: string, isBaking: boolean, showPercentage: boolean, scalingFactor?: number 
}> = ({ ingredients, title, isBaking, showPercentage, scalingFactor = 1 }) => {
  if (!ingredients || ingredients.length === 0) return null;

  const localBase = useMemo(() => {
    let flourTotal = 0; let maxWeight = 0; let maxName = '';
    ingredients.forEach(ing => {
      const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
      if (ing.isFlour) flourTotal += amt;
      if (amt > maxWeight) { maxWeight = amt; maxName = ing.name; }
    });
    if (flourTotal > 0) return { weight: flourTotal, name: '總粉量' };
    return { weight: maxWeight || 1, name: maxName || '主食材' };
  }, [ingredients]);

  return (
    <div className="mb-10">
      <h4 className="text-lg font-black text-orange-600 uppercase tracking-widest mb-5 border-b-2 border-orange-100 pb-2 flex flex-col sm:flex-row sm:justify-between sm:items-end space-y-1 sm:space-y-0">
        <span>{title}</span>
        {isBaking && showPercentage && (
          <span className="text-xs font-bold text-slate-400 lowercase italic sm:mb-0.5">
            (以 {localBase.name} 為 100%)
          </span>
        )}
      </h4>
      <ul className="space-y-4">
        {ingredients.map((ing, idx) => {
          const rawAmt = ing.amount;
          const numericAmt = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt) || 0;
          const scaledAmount = numericAmt > 0 ? (numericAmt * scalingFactor).toFixed(1).replace(/\.0$/, '') : ing.amount;
          const shouldHideUnit = typeof ing.amount === 'string' && (ing.amount === '適量' || ing.amount === '少許');

          return (
            <li key={`scaling-ing-${idx}`} className="flex flex-col py-4 border-b border-orange-50/50 last:border-0 gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 w-2 h-2 rounded-full ${ing.isFlour ? 'bg-orange-500' : 'bg-slate-300'}`} />
                <span className="text-slate-700 font-bold text-xl">{ing.name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pl-4">
                <div className="flex items-baseline gap-2">
                  {scalingFactor !== 1 && numericAmt > 0 ? (
                    <>
                      <span className="text-slate-400 text-sm line-through decoration-orange-200">
                        {numericAmt}{!shouldHideUnit && ing.unit}
                      </span>
                      <span className="text-orange-500 font-black text-sm">→</span>
                      <span className="text-slate-900 font-black text-2xl">
                        {scaledAmount}{!shouldHideUnit && ing.unit}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-900 font-black text-2xl">
                      {scaledAmount}{!shouldHideUnit && ing.unit}
                    </span>
                  )}
                </div>
                {isBaking && showPercentage && localBase.weight > 0 && numericAmt > 0 && (
                  <div className="flex items-center sm:border-l sm:border-orange-100 sm:pl-4">
                    <span className="text-xs sm:text-sm font-black px-2 py-0.5 sm:py-1 rounded-lg bg-orange-50 text-orange-600 shadow-sm min-w-[45px] sm:min-w-[55px] text-center">
                      {((numericAmt / localBase.weight) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

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
  moveIngredient: (fieldKey: keyof Recipe, index: number, direction: 'up' | 'down') => void
}> = ({ 
  items, title, fieldKey, customTitleKey, onMoveSection, sectionIndex, totalSections, 
  formRecipe, setFormRecipe, handleUpdateIngredient, moveIngredient 
}) => (
  <div className="mb-8 p-4 sm:p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm relative group/section overflow-hidden">
    {/* 修正後的 IngredientList 標題區塊：防止按鈕被擠出 */}
    <div className="flex justify-between items-center mb-5 gap-2">
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
            className="text-xs font-black text-orange-600 uppercase tracking-widest bg-orange-50/50 px-3 py-1.5 rounded-xl border border-orange-100 outline-none w-full min-w-0" 
          />
        ) : (
          <label className="text-xs font-black text-orange-600 uppercase tracking-widest whitespace-nowrap">{title}</label>
        )}
      </div>
      <button 
        type="button" 
        onClick={() => setFormRecipe(prev => ({ ...prev, [fieldKey]: [...(prev[fieldKey] as Ingredient[] || []), { name: '', amount: 0, unit: 'g', isFlour: false }] }))} 
        className="shrink-0 text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all whitespace-nowrap"
      >
        + 新增材料
      </button>
    </div>
    <div className="space-y-4 sm:space-y-2">
      {items.map((ing, idx) => (
        <div key={`${fieldKey}-${idx}`} className="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-center bg-slate-50/30 sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none border border-slate-100 sm:border-none">
          {/* 第一區塊：粉/水切換 + 材料名稱 */}
          <div className="flex gap-2 items-center w-full sm:flex-1 min-w-0">
            {formRecipe.isBakingRecipe && (
              <button 
                type="button" 
                onClick={() => handleUpdateIngredient(fieldKey, idx, 'isFlour', !ing.isFlour)} 
                className={`shrink-0 w-12 h-12 sm:w-8 sm:h-10 rounded-xl text-xs font-black transition-all ${ing.isFlour ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}
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

          {/* 第二區塊：重量 + 單位 + 刪除按鈕 */}
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="flex-1 sm:flex-none sm:w-24 relative min-w-0">
              <input 
                type="text" 
                value={ing.amount ?? ''} 
                onChange={(e) => handleUpdateIngredient(fieldKey, idx, 'amount', e.target.value)} 
                className="w-full h-12 sm:h-10 px-4 sm:px-3 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs text-right outline-none focus:ring-1 focus:ring-orange-200 transition-all" 
                placeholder="重量" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 sm:hidden">重量</span>
            </div>
            <div className="w-16 sm:w-16 relative shrink-0">
              <input 
                type="text" 
                value={ing.unit ?? ''} 
                onChange={(e) => handleUpdateIngredient(fieldKey, idx, 'unit', e.target.value)} 
                className="w-full h-12 sm:h-10 px-4 sm:px-3 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs outline-none focus:ring-1 focus:ring-orange-200 transition-all" 
                placeholder="單位" 
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 sm:hidden">單位</span>
            </div>
            <button 
              type="button" 
              onClick={() => setFormRecipe(prev => ({ ...prev, [fieldKey]: (prev[fieldKey] as Ingredient[]).filter((_, i) => i !== idx) }))} 
              className="shrink-0 w-12 h-12 sm:w-10 sm:h-10 flex items-center justify-center text-red-300 hover:text-red-500 transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
  
  // Mold scaling states - split into two independent objects
  const [sourceMold, setSourceMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });
  const [targetMold, setTargetMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });

  // Execution Log states
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLog, setNewLog] = useState<Partial<ExecutionLog>>({ date: getTodayString(), rating: 5, feedback: '', photoUrl: '' });
  const logPhotoInputRef = useRef<HTMLInputElement>(null);

  const [newNote, setNewNote] = useState({ title: '', content: '', master: '' });

  const backupInputRef = useRef<HTMLInputElement>(null);
  const recipeImageInputRef = useRef<HTMLInputElement>(null);

  const [formRecipe, setFormRecipe] = useState<Partial<Recipe>>({
    title: '', master: '', sourceName: '', sourceUrl: '', moldName: '', doughWeight: 0, crustWeight: 0, oilPasteWeight: 0, fillingWeight: 0, quantity: 1, 
    sourceDate: '', recordDate: getTodayString(),
    fermentationStages: [], bakingStages: [], description: '',
    ingredients: [{ name: '', amount: 0, unit: 'g', isFlour: true }],
    mainSectionName: '主麵團', liquidStarterName: '液種 / 老麵', liquidStarterIngredients: [], fillingIngredients: [], decorationIngredients: [], customSectionName: '其他區塊', customSectionIngredients: [], sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
    instructions: [''], category: '麵包', imageUrl: '', isBakingRecipe: true, isTried: true, tags: [], notes: '', executionLogs: []
  });

  const [newCatName, setNewCatName] = useState('');

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
      title: '', master: '', sourceName: '', sourceUrl: '', moldName: '', doughWeight: 0, crustWeight: 0, oilPasteWeight: 0, fillingWeight: 0, quantity: 1, 
      sourceDate: '', recordDate: getTodayString(),
      fermentationStages: [{ name: '基本發酵', time: '', temperature: '', humidity: '' }], bakingStages: [{ name: 'STAGE 1', topHeat: '', bottomHeat: '', time: '', note: '' }], description: '',
      ingredients: [{ name: '', amount: 0, unit: 'g', isFlour: true }],
      mainSectionName: '主麵團', liquidStarterName: '液種 / 老麵', liquidStarterIngredients: [], fillingIngredients: [], decorationIngredients: [], customSectionName: '其他區塊', customSectionIngredients: [], sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
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
            doughWeight: r.doughWeight || 0,
            crustWeight: r.crustWeight || 0,
            oilPasteWeight: r.oilPasteWeight || 0,
            fillingWeight: r.fillingWeight || 0,
            quantity: r.quantity || 1,
            sourceDate: r.sourceDate || '',
            recordDate: r.recordDate || '',
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
  };

  const handleAddNote = () => {
    if (!newNote.title || !newNote.content) return;
    setKnowledge(prev => [{ ...newNote, id: 'kn-' + Date.now(), createdAt: Date.now() }, ...prev]);
    setNewNote({ title: '', content: '', master: '' });
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

                    <div className="px-4 py-8 sm:p-8 bg-orange-50/20 rounded-[40px] border border-orange-100 space-y-8">
                      <label className="block text-lg font-black text-orange-700">3. 模具體積換算 (跨形狀互換工具)</label>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-5">
                          <div className="flex flex-col gap-3 px-1">
                             <span className="text-sm sm:text-base font-black text-slate-500 uppercase tracking-widest">原本食譜模具</span>
                             <select onChange={(e) => handleApplyMoldPreset('source', e.target.value)} className="w-full px-4 py-3 bg-white border border-orange-100 rounded-xl text-sm font-bold outline-none">
                                {MOLD_PRESETS.map(p => <option key={`src-preset-${p.name}`} value={p.name}>{p.name}</option>)}
                             </select>
                             <div className="flex bg-white rounded-xl p-1.5 border border-orange-100 shadow-sm mt-1">
                                <button onClick={() => setSourceMold(p => ({...p, type: 'circular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                <button onClick={() => setSourceMold(p => ({...p, type: 'rectangular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
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
                                <button onClick={() => setTargetMold(p => ({...p, type: 'circular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                <button onClick={() => setTargetMold(p => ({...p, type: 'rectangular'}))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
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
                  <div className="bg-orange-50/20 px-4 py-8 sm:p-8 rounded-[40px] border border-orange-50 print:bg-white print:border-none print:p-0">
                    {scalingRecipe.sectionsOrder?.map(secKey => {
                       if (secKey === 'ingredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.ingredients} title={scalingRecipe.mainSectionName || "主麵團"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'liquidStarterIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.liquidStarterIngredients || []} title={scalingRecipe.liquidStarterName || "發酵種"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={true} scalingFactor={scalingFactor} />;
                       if (secKey === 'fillingIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.fillingIngredients || []} title="內餡 (固定量)" isBaking={scalingRecipe.isBakingRecipe} showPercentage={false} scalingFactor={1} />;
                       if (secKey === 'decorationIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.decorationIngredients || []} title="裝飾 / 表面 (固定量)" isBaking={scalingRecipe.isBakingRecipe} showPercentage={false} scalingFactor={1} />;
                       if (secKey === 'customSectionIngredients') return <DisplayIngredientSection key={secKey} ingredients={scalingRecipe.customSectionIngredients || []} title={(scalingRecipe.customSectionName || "其他區塊") + " (固定量)"} isBaking={scalingRecipe.isBakingRecipe} showPercentage={false} scalingFactor={1} />;
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
                      <button onClick={() => setKnowledge(knowledge.filter(k => k.id !== kn.id))} className="absolute top-4 right-4 text-xs text-red-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500">移除</button>
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

                  {/* 第二排：分類下拉選單 */}
                  <div className="w-full">
                    <select value={formRecipe.category || ''} onChange={e => setFormRecipe(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* 第三排：⚖️ 麵團/糊 (g)、🌰 內餡 (g)、🔢 製作份數 */}
                  {formRecipe.category === '中式點心' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="relative">
                        {/* 標籤字體加大到 text-[13px] 並且改為更飽滿的 font-black */}
                        <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">⚖️ 皮重(g)</label>
                        <input type="number" value={formRecipe.crustWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, crustWeight: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                      <div className="relative">
                        <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">🧈 油酥重(g)</label>
                        <input type="number" value={formRecipe.oilPasteWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, oilPasteWeight: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                      <div className="relative">
                        <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">🌰 餡重(g)</label>
                        <input type="number" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                      <div className="relative">
                        <label className="block text-[13px] font-black text-slate-500 uppercase mb-1.5 ml-1">🔢 製作份數</label>
                        <input type="number" value={formRecipe.quantity ?? ''} onChange={e => setFormRecipe(p => ({ ...p, quantity: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="relative">
                        {/* 一般模式下的標籤也同步加大，讓視覺更一致 */}
                        <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">⚖️ 麵團/糊 (g)</label>
                        <input type="number" value={formRecipe.doughWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, doughWeight: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                      <div className="relative">
                        <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🌰 內餡 (g)</label>
                        <input type="number" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                      <div className="relative">
                        <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🔢 製作份數</label>
                        <input type="number" value={formRecipe.quantity ?? ''} onChange={e => setFormRecipe(p => ({ ...p, quantity: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                      </div>
                    </div>
                  )}
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

                  <div className="w-full">
                    <label className="block text-[13px] font-black text-slate-600 uppercase mb-1.5 ml-1">🍞 模具規格/烤盤</label>
                    <input type="text" value={formRecipe.moldName || ''} onChange={e => setFormRecipe(p => ({ ...p, moldName: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" placeholder="模具規格" />
                  </div>
                </div>

                {/* 職人新增：食譜來源與紀錄區塊 */}
                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">食譜來源與紀錄</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      value={formRecipe.sourceName || ''} 
                      onChange={e => setFormRecipe(p => ({ ...p, sourceName: e.target.value }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                      placeholder="書名" 
                    />
                    <input 
                      type="text" 
                      value={formRecipe.sourceUrl || ''} // 這裡可以共用來存線上課名稱
                      onChange={e => setFormRecipe(p => ({ ...p, sourceUrl: e.target.value }))} 
                      className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                      placeholder="線上課" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      value={formRecipe.tags?.join(', ') || ''} 
                      onChange={e => handleTagsInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                      placeholder="FB / 網址連結" 
                    />
                    <input 
                      type="text" 
                      value={formRecipe.notes || ''} 
                      onChange={e => setFormRecipe(p => ({ ...p, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm focus:border-orange-200" 
                      placeholder="頁碼 / 備註" 
                    />
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-orange-600 uppercase tracking-widest">發酵時序</label>
                      <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, fermentationStages: [...(prev.fermentationStages || []), { name: '', time: '', temperature: '', humidity: '' }] }))} className="text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all">＋新增階段</button>
                    </div>
                    <div className="space-y-3">
                      {formRecipe.fermentationStages?.map((stage, idx) => (
                        <div key={`edit-ferment-${idx}`} className="bg-white p-4 rounded-2xl border border-orange-50 space-y-3 shadow-sm">
                          <div className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              value={stage.name || ''} 
                              onChange={(e) => handleUpdateFermentationStage(idx, 'name', e.target.value)} 
                              className="w-0 flex-grow px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs" 
                              placeholder="階段名稱" 
                            />
                            <button 
                              onClick={() => setFormRecipe(p => ({ ...p, fermentationStages: p.fermentationStages?.filter((_, i) => i !== idx) }))} 
                              className="text-red-300 hover:text-red-500 text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors"
                            >
                              移除
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">⏲️</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">時間:</span>
                                <input type="text" value={stage.time || ''} onChange={(e) => handleUpdateFermentationStage(idx, 'time', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="分" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">🌡️</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">溫度:</span>
                                <input type="text" value={stage.temperature || ''} onChange={(e) => handleUpdateFermentationStage(idx, 'temperature', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="°C" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">💧</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">濕度:</span>
                                <input type="text" value={stage.humidity || ''} onChange={(e) => handleUpdateFermentationStage(idx, 'humidity', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="%" />
                              </div>
                            </div>
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
                    <div className="space-y-3">
                      {formRecipe.bakingStages?.map((stage, idx) => (
                        <div key={`edit-bake-${idx}`} className="bg-white p-4 rounded-2xl border border-orange-50 space-y-3 shadow-sm">
                          <div className="flex justify-between items-center border-b border-orange-50 pb-2">
                            <input type="text" value={stage.name || ''} onChange={(e) => handleUpdateBakingStage(idx, 'name', e.target.value)} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded w-24" />
                            <button 
                              onClick={() => setFormRecipe(p => ({ ...p, bakingStages: p.bakingStages?.filter((_, i) => i !== idx) }))} 
                              className="text-red-300 hover:text-red-500 text-xs font-bold transition-colors"
                            >
                              移除
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">🔥</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">上火:</span>
                                <input type="text" value={stage.topHeat || ''} onChange={(e) => handleUpdateBakingStage(idx, 'topHeat', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="°C" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">🔥</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">下火:</span>
                                <input type="text" value={stage.bottomHeat || ''} onChange={(e) => handleUpdateBakingStage(idx, 'bottomHeat', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="°C" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-1 bg-slate-50 px-4 sm:px-2 h-14 sm:h-auto sm:py-1 rounded-lg text-base sm:text-[10px]">
                              <span className="opacity-50 text-xl sm:text-xs">⏲️</span>
                              <div className="flex-grow flex items-center">
                                <span className="text-slate-400 mr-2 sm:hidden">時間:</span>
                                <input type="text" value={stage.time || ''} onChange={(e) => handleUpdateBakingStage(idx, 'time', e.target.value)} className="w-full bg-transparent text-left sm:text-center focus:outline-none" placeholder="分" />
                              </div>
                            </div>
                          </div>
                          <input type="text" value={stage.note || ''} onChange={(e) => handleUpdateBakingStage(idx, 'note', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs" placeholder="階段備註 (例如：噴水、開氣門)" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                   {currentOrder.map((sec, idx) => {
                      const onMove = (dir: 'up' | 'down') => moveSection(idx, dir);
                      if (sec === 'ingredients') return <IngredientList key={sec} items={formRecipe.ingredients || []} title="主麵團" fieldKey="ingredients" customTitleKey="mainSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} />;
                      if (sec === 'liquidStarterIngredients') return <IngredientList key={sec} items={formRecipe.liquidStarterIngredients || []} title="發酵種" fieldKey="liquidStarterIngredients" customTitleKey="liquidStarterName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} />;
                      if (sec === 'fillingIngredients') return <IngredientList key={sec} items={formRecipe.fillingIngredients || []} title="內餡" fieldKey="fillingIngredients" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} />;
                      if (sec === 'decorationIngredients') return <IngredientList key={sec} items={formRecipe.decorationIngredients || []} title="裝飾" fieldKey="decorationIngredients" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} />;
                      if (sec === 'customSectionIngredients') return <IngredientList key={sec} items={formRecipe.customSectionIngredients || []} title="其他區塊" fieldKey="customSectionIngredients" customTitleKey="customSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} />;
                      return null;
                    })}
                </div>

                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-orange-600 uppercase tracking-widest">製作步驟 (做法)</label>
                    <button type="button" onClick={() => setFormRecipe(prev => ({ ...prev, instructions: [...(prev.instructions || []), ''] }))} className="text-[10px] font-bold bg-[#E67E22] text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all">＋新增步驟</button>
                  </div>
                  <div className="space-y-3">{(formRecipe.instructions || []).map((inst, idx) => (<div key={`inst-${idx}`} className="flex gap-2 items-start"><span className="w-6 h-6 bg-orange-100 text-[#E67E22] font-black rounded-lg flex items-center justify-center text-[10px] mt-1.5">{idx + 1}</span><textarea value={inst} onChange={(e) => { const newInst = [...(formRecipe.instructions || [])]; newInst[idx] = e.target.value; setFormRecipe(p => ({ ...p, instructions: newInst })); }} className="flex-grow px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs min-h-[60px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all" placeholder={`步驟 ${idx + 1} 說明...`} /><button type="button" onClick={() => { const newInst = (formRecipe.instructions || []).filter((_, i) => i !== idx); setFormRecipe(p => ({ ...p, instructions: newInst })); }} className="text-red-300 hover:text-red-500 mt-2 transition-colors">🗑️</button></div>))}</div>
                </div>

                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest">食譜簡介 (列表顯示)</label>
                  <textarea value={formRecipe.description || ''} onChange={(e) => setFormRecipe(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs min-h-[100px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all" placeholder="簡單介紹這份配方的特色..." />
                </div>
                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest">📝 私房筆記與秘方</label>
                  <textarea value={formRecipe.notes || ''} onChange={(e) => setFormRecipe(p => ({ ...p, notes: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs min-h-[150px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all" placeholder="紀錄製作時的心得、建議改進之處..." />
                </div>
                <div className="pt-6"><button onClick={() => { if (!formRecipe.title) return; if (view === AppView.CREATE) { setRecipes(prev => [{ ...formRecipe as Recipe, id: 'rec-' + Date.now(), createdAt: Date.now() }, ...prev]); } else { setRecipes(prev => prev.map(r => r.id === formRecipe.id ? (formRecipe as Recipe) : r)); } setView(AppView.LIST); }} className="w-full py-4 bg-[#E67E22] text-white rounded-3xl font-black text-lg shadow-lg active:scale-95">儲存配方</button></div>
              </div>
            </div>
          )}

          {view === AppView.MANAGE_CATEGORIES && (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-[40px] shadow-sm border border-orange-50 animate-in zoom-in-95">
              <h2 className="text-xl font-black text-[#E67E22] mb-6">分類管理與排序</h2>
              <div className="flex gap-2 mb-8">
                <input type="text" value={newCatName || ''} onChange={(e) => setNewCatName(e.target.value)} className="flex-grow px-4 py-2 rounded-xl bg-orange-50/30 border border-orange-50 outline-none text-sm" placeholder="輸入新分類..." />
                <button onClick={() => { if(!newCatName.trim()) return; setCategories(prev=>[...prev,{id:'cat-'+Date.now(), name:newCatName.trim(), order:categories.length}]); setNewCatName(''); }} className="bg-[#E67E22] text-white px-5 py-2 rounded-xl font-bold text-sm">新增</button>
              </div>
              <div className="space-y-3">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-orange-50/20 rounded-2xl border border-orange-50 shadow-sm">
                    <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { const nc = [...categories]; [nc[idx],nc[idx-1]] = [nc[idx-1],nc[idx]]; setCategories(nc.map((c,i)=>({...c,order:i}))); }} disabled={idx === 0} className="p-1.5 text-slate-300 disabled:opacity-10 hover:text-[#E67E22]">↑</button>
                      <button onClick={() => { const nc = [...categories]; [nc[idx],nc[idx+1]] = [nc[idx+1],nc[idx]]; setCategories(nc.map((c,i)=>({...c,order:i}))); }} disabled={idx === categories.length-1} className="p-1.5 text-slate-300 disabled:opacity-10 hover:text-[#E67E22]">↓</button>
                      <button onClick={() => setCategories(categories.filter(c=>c.id!==cat.id))} className="p-1.5 text-red-200 hover:text-red-500 ml-2">🗑️</button>
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
                    <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100 print:bg-white print:text-slate-500 print:border-slate-200">
                      {selectedRecipe.category}
                    </span>
                    {selectedRecipe.isTried && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-orange-200">
                        待嘗試
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
                      <p className="text-xs font-bold text-slate-400 print:text-xs print:text-slate-400">
                        {selectedRecipe.sourceDate && <span>分享日：{selectedRecipe.sourceDate}</span>}
                        {selectedRecipe.sourceDate && selectedRecipe.recordDate && <span className="mx-2 opacity-50">｜</span>}
                        {selectedRecipe.recordDate && <span>紀錄日：{selectedRecipe.recordDate}</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 print:grid-cols-1 print:gap-6">
                <div className="md:col-span-1 space-y-8">
                  <div className="bg-white p-7 rounded-[32px] border border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-6">
                    <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-2 print:text-base print:mb-4">食材配方</h3>
                    {selectedRecipe.sectionsOrder?.map(secKey => {
                       if (secKey === 'ingredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.ingredients} title={selectedRecipe.mainSectionName || "主麵團"} isBaking={selectedRecipe.isBakingRecipe} showPercentage={true} />;
                       if (secKey === 'liquidStarterIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.liquidStarterIngredients || []} title={selectedRecipe.liquidStarterName || "發酵種"} isBaking={selectedRecipe.isBakingRecipe} showPercentage={true} />;
                       if (secKey === 'fillingIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.fillingIngredients || []} title="內餡" isBaking={selectedRecipe.isBakingRecipe} showPercentage={false} />;
                       if (secKey === 'decorationIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.decorationIngredients || []} title="裝飾 / 表面" isBaking={selectedRecipe.isBakingRecipe} showPercentage={false} />;
                       if (secKey === 'customSectionIngredients') return <DisplayIngredientSection key={secKey} ingredients={selectedRecipe.customSectionIngredients || []} title={selectedRecipe.customSectionName || "其他區塊"} isBaking={selectedRecipe.isBakingRecipe} showPercentage={false} />;
                       return null;
                    })}
                  </div>
                </div>
                <div className="md:col-span-2 space-y-8">
                  <div className="bg-white p-7 rounded-[32px] border border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-6">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 print:text-base print:mb-4">發酵與烤焙</h3>
                    {selectedRecipe.fermentationStages && selectedRecipe.fermentationStages.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-[13px] font-black text-orange-400 uppercase tracking-widest mb-4 print:text-black">發酵時序</h4>
                        <div className="space-y-4">
                          {selectedRecipe.fermentationStages.map((stage, idx) => (
                            <div key={idx} className="flex flex-col p-4 bg-orange-50/20 rounded-2xl border border-orange-50 gap-y-3 print:bg-white print:border-slate-200">
                              <div className="text-base font-black text-slate-700 print:text-sm">{stage.name || `階段 ${idx+1}`}</div>
                              <div className="grid grid-cols-3 gap-2 text-sm font-black text-orange-500 tabular-nums border-t border-orange-100/50 pt-3 print:text-black print:border-slate-100">
                                <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] text-slate-400 font-bold uppercase">時間</span><div className="flex items-center gap-1.5">⏲️ {stage.time ? `${stage.time}m` : '--'}</div></div>
                                <div className="flex flex-col items-center gap-1.5 border-x border-orange-100/50 print:border-slate-100"><span className="text-[10px] text-slate-400 font-bold uppercase">溫度</span><div className="flex items-center gap-1.5">🌡️ {stage.temperature ? `${stage.temperature}°` : '--'}</div></div>
                                <div className="flex flex-col items-center gap-1.5"><span className="text-[10px] text-slate-400 font-bold uppercase">濕度</span><div className="flex items-center gap-1.5">💧 {stage.humidity ? `${stage.humidity}%` : '--'}</div></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedRecipe.bakingStages && selectedRecipe.bakingStages.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-[13px] font-black text-orange-400 uppercase tracking-widest mb-4 print:text-black">烤焙參數</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                          {selectedRecipe.bakingStages.map((stage, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-[28px] border border-orange-50 shadow-sm relative overflow-hidden print:rounded-xl print:border-slate-200">
                              <div className="flex justify-between items-center mb-4"><span className="text-[11px] font-black text-slate-400 uppercase">{stage.name || `STAGE ${idx+1}`}</span><span className="text-sm font-black text-[#E67E22] bg-orange-50 px-2 py-0.5 rounded-lg print:bg-slate-50 print:text-black">{stage.time} min</span></div>
                              <div className="flex justify-around text-center items-center">
                                <div className="flex-1"><div className="text-[10px] text-slate-400 font-bold uppercase mb-1">上火</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{stage.topHeat}<span className="text-xs opacity-50 ml-0.5">°C</span></div></div>
                                <div className="w-px h-10 bg-orange-50 print:bg-slate-100" />
                                <div className="flex-1"><div className="text-[10px] text-slate-400 font-bold uppercase mb-1">下火</div><div className="text-2xl font-black text-slate-700 tabular-nums print:text-lg">{stage.bottomHeat}<span className="text-xs opacity-50 ml-0.5">°C</span></div></div>
                              </div>
                              {stage.note && <p className="mt-3 text-xs text-slate-400 italic print:text-slate-500">💡 {stage.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-8 rounded-[32px] border border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-6">
                    <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-2 print:text-base print:mb-4">製作步驟</h3>
                    <div className="space-y-8 print:space-y-4">
                      {(selectedRecipe.instructions || []).map((inst, idx) => (
                        <div key={idx} className="flex gap-6 items-start print:gap-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-orange-50 text-[#E67E22] font-black rounded-2xl flex items-center justify-center text-sm shadow-sm border border-orange-100 print:w-6 print:h-6 print:text-xs print:rounded-lg">{idx+1}</span>
                          <p className="text-base text-slate-700 leading-relaxed font-bold tracking-wide pt-0.5 print:text-sm">{inst}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {selectedRecipe.notes && (
                    <div className="bg-yellow-50/50 p-8 rounded-[32px] border border-yellow-100 shadow-sm relative overflow-hidden print:rounded-2xl print:border-slate-200 print:p-6 print:bg-white">
                      <h3 className="text-lg font-black text-yellow-700 mb-4 flex items-center gap-2 print:text-base print:text-black">📝 製作心得與私房筆記</h3>
                      <p className="text-base text-slate-700 leading-relaxed font-bold tracking-wide whitespace-pre-wrap italic print:text-sm print:not-italic">{selectedRecipe.notes}</p>
                    </div>
                  )}

                  <div className="bg-white p-8 rounded-[32px] border border-orange-50 shadow-sm space-y-6 print:rounded-2xl print:border-slate-200 print:p-6">
                    <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-800 flex items-center gap-2 print:text-base">🕒 實作紀錄日記</h3><button onClick={() => setIsAddingLog(!isAddingLog)} className="px-4 py-1.5 bg-orange-50 text-orange-600 rounded-full text-xs font-black border border-orange-100 no-print">{isAddingLog ? '取消新增' : '+ 新增紀錄'}</button></div>
                    {isAddingLog && (
                      <div className="p-6 bg-orange-50/30 rounded-2xl border border-orange-100 space-y-4 animate-in fade-in zoom-in-95 no-print">
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
                    <button onClick={handleDeleteRecipe} className="flex-grow py-5 bg-red-50 text-red-500 rounded-[32px] font-black shadow-sm active:scale-95 transition-all hover:bg-red-100 text-base">刪除配方</button>
                  </div>
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
    </div>
  );
};

export default App;
