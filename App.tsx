
import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User,
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, updateDoc, deleteDoc,
  getDocFromServer, setPersistence, browserLocalPersistence
} from './firebase';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Initialize Gemini AI with fallback support for different environment variable names
const getApiKey = () => {
  // 優先順序：localStorage (除錯優先) -> Vite 環境變數
  const key = localStorage.getItem('VITE_GEMINI_API_KEY') ||
              (import.meta as any).env?.VITE_GEMINI_API_KEY || 
              (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : null) ||
              localStorage.getItem('gemini_api_key');
  
  // [Auth] API Key 診斷：僅告知狀態，不暴露私鑰
  const apiStatus = !!key ? 'Detected' : 'Missing';
  console.log('[Auth] API Key status:', apiStatus);

  if (!key) {
    console.error("Error: API Key is undefined (VITE_GEMINI_API_KEY not found)");
  }
  return key ? key.trim() : '';
};

const genAI = new GoogleGenerativeAI(getApiKey());

const INGREDIENT_OBJECT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    amount: { type: "string" },
    unit: { type: "string" },
    isFlour: { type: "boolean" }
  },
  required: ["name", "amount", "unit"]
};

const FERMENTATION_STAGE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    time: { type: "string" },
    timeUnit: { type: "string", enum: ["分鐘", "小時"] },
    temperature: { type: "string" },
    humidity: { type: "string" },
    note: { type: "string" }
  },
  required: ["name", "time"]
};

const BAKING_STAGE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    topHeat: { type: "string" },
    bottomHeat: { type: "string" },
    time: { type: "string" },
    timeUnit: { type: "string", enum: ["分鐘", "小時"] },
    note: { type: "string" }
  },
  required: ["name", "time"]
};

const AI_RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    master: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    ingredients: { type: "array", items: INGREDIENT_OBJECT_SCHEMA },
    liquidStarterIngredients: { type: "array", items: INGREDIENT_OBJECT_SCHEMA },
    fillingIngredients: { type: "array", items: INGREDIENT_OBJECT_SCHEMA },
    decorationIngredients: { type: "array", items: INGREDIENT_OBJECT_SCHEMA },
    customSectionIngredients: { type: "array", items: INGREDIENT_OBJECT_SCHEMA },
    mainSectionName: { type: "string" },
    liquidStarterName: { type: "string" },
    fillingSectionName: { type: "string" },
    decorationSectionName: { type: "string" },
    customSectionName: { type: "string" },
    fermentationStages: { type: "array", items: FERMENTATION_STAGE_SCHEMA },
    bakingStages: { type: "array", items: BAKING_STAGE_SCHEMA },
    instructions: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    notes: { type: "string" }
  },
  required: ["title", "ingredients", "instructions"]
};

const AI_MULTI_RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: { type: "array", items: AI_RECIPE_SCHEMA }
  },
  required: ["recipes"]
};
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, Book, Scale, Settings, LogOut, LogIn, User as UserIcon, 
  ChevronRight, Trash2, Edit2, Edit3, Share2, Printer, Save, X, RotateCcw,
  Clock, Thermometer, Droplets, Tag, BookOpen, ExternalLink, Calendar,
  ChevronUp, ChevronDown, Camera, Image as ImageIcon, CheckCircle2, AlertCircle,
  Cloud, CloudOff, Smartphone, Crown, Menu, Mail, CreditCard
} from 'lucide-react';

// --- 1. 類型定義 (原 types.ts 內容) ---
const COPYRIGHT_TEXT = "© 2026 Linda's Recipe Box. All rights reserved.";
export enum AppView { LIST, CREATE, EDIT, DETAIL, SCALING, COLLECTION, MANAGE_CATEGORIES }

export interface Ingredient { name: string; amount: string | number; unit: string; isFlour: boolean; percentage?: number | string; }
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
  quantity?: number; shelfLife?: string; totalDuration?: string; createdAt: number; updatedAt?: number; executionLogs?: ExecutionLog[];
  uid?: string;
  author_id?: string;
  bakingPercentage?: number | string;
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

const AIPreviewModal: React.FC<{
  isOpen: boolean;
  recipes: Partial<Recipe>[];
  onClose: () => void;
  onImport: (recipe: Partial<Recipe>) => void;
  onImportAll: () => void;
  onMerge: () => void;
}> = ({ isOpen, recipes, onClose, onImport, onImportAll, onMerge }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 border-4 border-orange-100">
            <div className="p-6 sm:p-8 border-b border-orange-50 bg-orange-50/30 flex justify-between items-start">
                <div>
                   <h3 className="text-2xl font-black text-slate-800 leading-tight">✨ AI 偵測到 {recipes.length} 組配方</h3>
                   <p className="text-xs font-bold text-orange-400 mt-1">我們已自動識別多段內容，請選擇匯入方式</p>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 transition-all border border-orange-50">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
                {recipes.map((r, idx) => (
                    <div key={idx} className="p-5 bg-orange-50/20 rounded-3xl border border-orange-100 hover:bg-orange-50 transition-all relative group">
                        <div className="flex justify-between items-start mb-2">
                           <h4 className="font-black text-slate-700 flex items-center gap-2">
                             <span className="w-5 h-5 bg-orange-200 rounded-full text-[10px] flex items-center justify-center text-orange-600">#{idx+1}</span>
                             {r.title || '未命名食譜'}
                           </h4>
                           <button onClick={() => onImport(r)} className="px-4 py-1.5 bg-white text-orange-600 border border-orange-200 rounded-xl text-xs font-black shadow-sm hover:bg-orange-500 hover:text-white transition-all">單獨匯入</button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center mb-2">
                            {(() => {
                               const sections = [
                                 { count: r.ingredients?.length || 0, label: '主材料' },
                                 { count: r.liquidStarterIngredients?.length || 0, label: '發酵種' },
                                 { count: r.fillingIngredients?.length || 0, label: '內餡' },
                                 { count: r.decorationIngredients?.length || 0, label: '裝飾' },
                                 { count: r.fermentationStages?.length || 0, label: '發酵' },
                                 { count: r.bakingStages?.length || 0, label: '烘烤' }
                               ].filter(s => s.count > 0);
                               
                               if (sections.length > 0) {
                                 return (
                                   <div className="flex flex-wrap gap-1">
                                      {sections.map(s => (
                                        <span key={s.label} className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md font-black border border-orange-100">
                                          {s.label}x{s.count}
                                        </span>
                                      ))}
                                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold tracking-tight">✨ 偵測到全方資訊</span>
                                   </div>
                                 );
                               }
                               return null;
                            })()}
                            <span className="text-[10px] text-slate-400 font-bold italic line-clamp-1">
                               🥗 {([...(r.ingredients || []), ...(r.liquidStarterIngredients || []), ...(r.fillingIngredients || [])].slice(0, 3).map(i => i.name).join('、'))}...
                            </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold line-clamp-1 italic">📝 步驟預覽: {r.instructions?.[0] || '無內容'}...</div>
                    </div>
                ))}
            </div>
            <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                <button onClick={onImportAll} className="w-full py-5 bg-orange-500 text-white rounded-[32px] font-black text-base shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2">
                    <span>✨</span>
                    <span>一鍵全方位歸位 (合併為一個食譜)</span>
                </button>
                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all">取消</button>
                  <button onClick={onMerge} className="flex-1 py-4 bg-orange-50 text-orange-600 border border-orange-100 rounded-2xl font-black text-sm hover:bg-orange-100 transition-all">僅合併預覽</button>
                </div>
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

const renderHighlightedText = (text: string, isTitle: boolean = false) => {
  if (!text) return null;
  const parts = text.split(/(#[\w\u4e00-\u9fa5]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <span key={i} className="text-[#8B5E3C] font-black tracking-tighter">
          {part}
        </span>
      );
    }
    return part;
  });
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
        <h3 className="text-lg font-black text-slate-800 break-words leading-tight">
          {renderHighlightedText(recipe.title, true)}
        </h3>
        <span className="text-xs font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-xl border border-orange-100/50 shrink-0">{recipe.category}</span>
      </div>
      <p className="text-xs text-slate-400 font-bold mb-2">師傅：{recipe.master}</p>
      <div className="space-y-3">
        {recipe.totalDuration && (
          <div className="flex items-center gap-1 text-[11px] font-black text-[#E67E22] bg-orange-50/50 px-2 py-0.5 rounded-lg border border-orange-100/30 w-fit">
            <span>⏱️</span>
            <span>{formatTimeWithUnit(recipe.totalDuration)}</span>
          </div>
        )}
        <p className="text-[14px] text-slate-700 font-medium leading-relaxed mt-1">
          {renderHighlightedText(recipe.description || '點擊查看詳細配方...')}
          {!recipe.description && recipe.notes && renderHighlightedText(recipe.notes.slice(0, 80) + '...')}
        </p>
      </div>
    </div>
  </div>
);

// --- Helper: Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  // We throw a user-friendly message locally but log the full detail for the AI/developer
  throw new Error(`Firestore ${operationType} failed at ${path}. Please check rules.`);
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const s = (this as any).state;
    if (s.hasError) {
      return (
        <div className="min-h-screen bg-[#F5E6D3] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[40px] shadow-xl max-w-md text-center border-2 border-orange-100">
            <span className="text-4xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-black text-slate-800 mb-4">糟糕，出錯了</h2>
            <p className="text-slate-600 font-bold mb-6 leading-relaxed">
              系統遇到一些問題，請嘗試重新整理。
            </p>
            <div className="bg-red-50 p-4 rounded-2xl mb-6 overflow-hidden">
              <p className="text-xs text-red-500 font-mono break-all">{s.errorMessage}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#E67E22] text-white rounded-full font-black shadow-lg hover:bg-orange-600 transition-all"
            >
              重新整理
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- 3. 妳原本的主程式 App ---
const STORAGE_KEY = 'ai_recipe_box_data_v4';
const CATEGORIES_KEY = 'ai_recipe_box_categories_v4';
const KNOWLEDGE_KEY = 'ai_recipe_box_knowledge_v4';
const RESOURCE_STORAGE_KEY = 'ai_recipe_box_resources_v4';
const COMPLETED_STEPS_KEY = 'ai_recipe_box_completed_steps_v4';

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
const getThisMonthString = () => new Date().toISOString().substring(0, 7);

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
  showPercentage: boolean,
  scalingFactor?: number,
  onReverseScale?: (index: number, newAmount: number) => void,
  baseIngredientIndex?: number | null
}> = ({ ingredients, title, isBaking, showPercentage, scalingFactor = 1, onReverseScale, baseIngredientIndex }) => {
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
    <div className="mb-10 bg-white rounded-[40px] border-2 border-orange-50 p-8 shadow-sm overflow-hidden print:rounded-2xl print:border-slate-200 print:p-2 print:mb-0 print:w-[calc(50%-0.5rem)] max-w-3xl mx-auto">
      <div className="mb-8 flex flex-col gap-3 print:mb-2">
        <div className="flex items-center">
          <span className="px-6 py-2 bg-[#E67E22] text-white text-base font-black rounded-2xl shadow-sm uppercase tracking-widest print:px-3 print:py-1 print:text-sm">
            {title}
          </span>
        </div>
        {isBaking && showPercentage && (
          <div className="ml-1 flex items-center gap-2 print:hidden">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">基準:</span>
            <span className="text-sm font-bold text-slate-600 lowercase italic">
              (以 {localBaseInfo.name} 為 100%)
            </span>
          </div>
        )}
      </div>
      <div className="space-y-0 print:grid-1">
        {/* 表頭 (僅桌面版，PDF中隱藏以省空間) */}
        <div className="hidden sm:flex items-center px-6 py-4 border-b border-orange-100/50 text-xs font-black text-slate-500 uppercase tracking-widest bg-orange-50/30 rounded-t-2xl print:hidden">
          <div className="flex-1 min-w-0">材料名稱</div>
          <div className="flex shrink-0 items-center justify-end">
            {/* 重量欄位：w-44 (176px)，pr-10 (40px)，實際居中範圍 136px */}
            <div className="w-44 text-center pr-10">重量 (G)</div>
            {isBaking && showPercentage && <div className="w-32 text-center pr-4">百分比 (%)</div>}
          </div>
        </div>

        {ingredients.map((ing, idx) => {
          const rawAmt = ing.amount;
          const numericAmt = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt) || 0;
          const scaledAmt = numericAmt * scalingFactor;
          const isAdjustableAmt = ing.unit === '適量' || ing.unit === '少許';
          const isWeight = isWeightUnit(ing.unit || 'g');
          const percentage = (localBaseInfo.weight > 0 && isWeight) ? (numericAmt / localBaseInfo.weight * 100).toFixed(1).replace(/\.0$/, '') : '';
          const isBase = baseIngredientIndex === idx;

          return (
            <div key={`scaling-ing-${idx}`} className={`flex flex-col md:flex-row md:items-center py-4 md:py-3 border-b border-orange-50/50 last:border-0 px-2 md:px-6 hover:bg-orange-50/20 transition-colors rounded-2xl gap-3 md:gap-0 mb-3 md:mb-0 print:mb-0 print:py-0.5 print:border-slate-100 print:rounded-none print:hover:bg-transparent print:flex-row print:items-center ${isBase ? 'bg-orange-50/50 border-orange-200 print:bg-transparent print:border-slate-100' : ''}`}>
              {/* 第一行：材料名稱 */}
              <div className="flex items-start gap-4 flex-1 min-w-0 w-full px-1 md:px-0 pt-1 print:gap-1 print:flex-1 print:pt-0">
                <span className={`shrink-0 w-3 h-3 rounded-full mt-2 print:w-1.5 print:h-1.5 print:mt-1 ${ing.isFlour ? 'bg-orange-500 shadow-[0_0_8px_rgba(230,126,34,0.4)] print:bg-slate-400' : 'bg-slate-200'}`} />
                <span className="text-slate-800 font-black text-lg md:text-[1.1rem] leading-snug whitespace-pre-wrap break-words print:text-[12px] print:font-bold">
                  {ing.name}
                  {isBase && <span className="inline-flex items-center ml-2 text-orange-500 text-sm print:hidden" title="基準材料">⚖️</span>}
                </span>
              </div>

              {/* 第二行 (手機版) / 數據列 (電腦版) */}
              <div className="flex shrink-0 items-center justify-between md:justify-end w-full md:w-auto pl-7 md:pl-0 px-2 md:px-0 print-data-group gap-3 md:gap-0">
                {/* 重量欄位：寬度與標題嚴格對齊 */}
                <div className="flex-1 md:flex-none md:w-44 flex justify-start md:justify-center items-center shrink-0 md:pr-10 print:pr-0 print-weight-cell">
                  <div className="flex items-baseline justify-start md:justify-center w-full">
                    <div className="flex items-baseline gap-1 min-w-[120px] md:min-w-0 justify-end md:justify-center">
                      {onReverseScale && isWeight ? (
                        <div className="relative flex items-center print:hidden">
                          {/* 輸入框固定寬度 w-24 (96px)，數值居中 */}
                          <div className="relative flex items-center">
                            <input 
                              type="number" 
                              step="0.1"
                              value={scaledAmt.toFixed(1).replace(/\.0$/, '')} 
                              onChange={(e) => onReverseScale(idx, parseFloat(e.target.value) || 0)}
                              className={`w-24 px-2 py-1.5 bg-white border-2 rounded-lg text-center font-black text-xl md:text-lg outline-none transition-all tabular-nums ${isBase ? 'border-orange-400 text-orange-600' : 'border-orange-100 focus:border-orange-300 text-slate-900'}`}
                            />
                            <span className="ml-2 text-sm font-bold text-slate-400 w-5 inline-block text-left">{ing.unit}</span>
                          </div>
                        </div>
                      ) : null}
                      
                      {/* 列印時或非反向換算時顯示文本 */}
                      <div className={`flex items-baseline justify-end md:justify-center relative ${onReverseScale && isWeight ? 'hidden md:flex print:flex' : 'flex'}`}>
                        <div className="flex items-baseline md:justify-center min-w-[80px] md:min-w-0">
                          <span className="text-slate-900 font-black text-2xl md:text-lg leading-none print:text-base print:font-bold tabular-nums">
                            {isAdjustableAmt ? (ing.unit) : (numericAmt * scalingFactor).toFixed(1).replace(/\.0$/, '')}
                          </span>
                          {!isAdjustableAmt && (
                            <span className="text-sm font-bold text-slate-400 ml-2 w-5 inline-block text-left print:text-[10px] print:font-normal print:ml-1">{ing.unit}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 百分比欄位 */}
                {isBaking && showPercentage && (
                  <div className="flex-1 md:flex-none md:w-32 flex justify-end md:justify-center items-center shrink-0 print:pr-0 print-percent-cell">
                    {percentage ? (
                      <span className="text-sm md:text-base font-black px-4 py-2 rounded-xl bg-orange-50 text-orange-600 shadow-sm inline-block min-w-[80px] md:min-w-[90px] text-right md:text-center border border-orange-100/50 tabular-nums print:bg-transparent print:border-none print:px-0 print:py-0 print:text-[11px] print:text-slate-400 print:font-normal">
                        ({percentage}%)
                      </span>
                    ) : (
                      <div className="w-[80px] md:w-[90px] print:hidden" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-orange-100/50 flex justify-between items-center px-2 sm:px-6 print:px-0">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest print:text-[10px]">區塊總重:</span>
        <span className="text-xl font-black tabular-nums text-slate-700 print:text-sm">
          {(ingredients.reduce((acc, ing) => {
            if (!isWeightUnit(ing.unit || 'g')) return acc;
            const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
            return acc + amt;
          }, 0) * scalingFactor).toFixed(1).replace(/\.0$/, '')}
          <span className="text-sm font-bold text-slate-400 ml-1 print:text-[10px]">g</span>
        </span>
      </div>
    </div>
  );
};

const isWeightUnit = (unit: string) => ['g', 'kg', 'ml', 'L'].includes(unit);

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
  triggerConfirm: (onConfirm: () => void) => void,
  lastUsedUnit: string,
  setLastUsedUnit: (unit: string) => void
}> = ({ 
  items, title, fieldKey, customTitleKey, onMoveSection, sectionIndex, totalSections, 
  formRecipe, setFormRecipe, handleUpdateIngredient, moveIngredient, triggerConfirm,
  lastUsedUnit, setLastUsedUnit
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
          const isAdjustable = ing.unit === '適量' || ing.unit === '少許';
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
                <textarea 
                  value={ing.name ?? ''} 
                  rows={1}
                  onChange={(e) => {
                    handleUpdateIngredient(fieldKey, idx, 'name', e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }} 
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="flex-1 w-0 min-h-[48px] sm:min-h-[40px] py-3 sm:py-2.5 px-4 sm:px-3 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs outline-none focus:ring-1 focus:ring-orange-200 transition-all whitespace-pre-wrap resize-none overflow-hidden" 
                  placeholder="材料名稱 (可換行)" 
                />
              </div>

              {/* 第二排：百分比 + 重量 + 單位 + 移除 (手機版併排) */}
              <div className="flex gap-2 items-center w-full sm:flex-[45] sm:basis-0 min-w-0">
                {formRecipe.isBakingRecipe && (
                  <div className={`flex-[3] sm:flex-1 relative min-w-0 sm:min-w-[70px] ${isAdjustable ? 'opacity-0 pointer-events-none' : ''}`}>
                    <input 
                      type="text" 
                      value={percentage} 
                      disabled={!isWeight || isAdjustable}
                      onChange={(e) => {
                        if (!isWeight || isAdjustable) return;
                        const pct = parseFloat(e.target.value) || 0;
                        const newAmt = (pct * localBase / 100).toFixed(1).replace(/\.0$/, '');
                        handleUpdateIngredient(fieldKey, idx, 'amount', newAmt);
                      }}
                      className={`w-full h-12 sm:h-10 px-4 sm:px-1 rounded-xl border outline-none transition-all text-center text-base sm:text-xs font-bold ${!isWeight ? 'bg-slate-100 border-slate-100 text-slate-300' : 'border-slate-100 bg-white sm:bg-slate-50/50 text-orange-600 focus:ring-1 focus:ring-orange-200'}`} 
                      placeholder="%" 
                    />
                    {isWeight && !isAdjustable && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-orange-300 font-bold pointer-events-none">%</span>}
                  </div>
                )}
                <div className={`flex-[4] sm:flex-1 relative min-w-0 sm:min-w-[70px] ${isAdjustable ? 'opacity-0 pointer-events-none' : ''}`}>
                  <input 
                    type="text" 
                    value={isAdjustable ? '' : (ing.amount ?? '')} 
                    disabled={isAdjustable}
                    onChange={(e) => handleUpdateIngredient(fieldKey, idx, 'amount', e.target.value)} 
                    className="w-full h-12 sm:h-10 px-4 sm:px-1 rounded-xl border border-slate-100 bg-white sm:bg-slate-50/50 text-base sm:text-xs text-center outline-none focus:ring-1 focus:ring-orange-200 transition-all font-bold" 
                    placeholder={isWeight ? "克數" : "數量"} 
                  />
                </div>
                <div className="flex-[3] sm:flex-1 relative min-w-0 sm:min-w-[70px] shrink-0">
                  <select 
                    value={ing.unit ?? 'g'} 
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setLastUsedUnit(newUnit);
                      handleUpdateIngredient(fieldKey, idx, 'unit', newUnit);
                      // If changing to non-weight unit or adjustable, set relevant logic
                      if ((!isWeightUnit(newUnit) || newUnit === '適量' || newUnit === '少許') && ing.isFlour) {
                        handleUpdateIngredient(fieldKey, idx, 'isFlour', false);
                      }
                      if (newUnit === '適量' || newUnit === '少許') {
                         handleUpdateIngredient(fieldKey, idx, 'amount', '');
                      }
                    }} 
                    className="w-full h-12 sm:h-10 px-1 rounded-xl border border-slate-100 bg-orange-50/50 text-base sm:text-xs outline-none focus:ring-1 focus:ring-orange-200 transition-all text-center appearance-none cursor-pointer font-black text-[#8B5E3C]"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="顆">顆</option>
                    <option value="個">個</option>
                    <option value="條">條</option>
                    <option value="小匙">小匙</option>
                    <option value="大匙">大匙</option>
                    <option value="適量">適量</option>
                    <option value="少許">少許</option>
                    <option value="份">份</option>
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

// --- 2. 輔助元件 (UI Components) ---

const SubscriptionModal: React.FC<{ isOpen: boolean; onClose: () => void; message?: string }> = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-[8px] animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        style={{ width: 'max(400px, 50%)', maxHeight: '85vh' }}
        className="bg-[#FDF8F3] rounded-[32px] shadow-[0_40px_100px_rgba(139,94,61,0.3)] border border-[#E8DCCB] flex flex-col relative overflow-y-auto modern-scrollbar"
      >
        {/* 背景裝飾 */}
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-orange-100/50 to-transparent pointer-events-none" />
        
        {/* 關閉按鈕 */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/80 text-[#8B5E3C] hover:bg-white hover:rotate-90 transition-all active:scale-90 shadow-md border border-orange-100"
        >
          <X size={20} />
        </button>

        <div className="p-6 sm:p-8 flex flex-col items-center">
          {/* Logo / Header */}
          <div className="pt-2 mb-6 flex flex-col items-center">
            <h2 className="text-[#8B5A2B] font-black text-2xl tracking-tighter">烘焙靈感箱</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100">Premium Plans</span>
            </div>
          </div>

          {message && (
            <div className="w-full max-w-[450px] mb-6 p-4 bg-orange-50/80 rounded-2xl border border-orange-100 text-center">
              <p className="text-[#8B5E3C] text-xs font-black leading-relaxed">{message}</p>
            </div>
          )}

          {/* 方案對照 */}
          <div className="w-full px-2 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-[650px] mx-auto py-2">
              {/* Free Plan */}
              <div className="bg-white/60 rounded-3xl p-6 border border-slate-100 flex flex-col h-full min-h-[180px]">
                <div className="mb-4">
                  <h3 className="text-slate-500 font-black text-xl mb-1 leading-tight">Standard <br /> <span className="whitespace-nowrap">免費版</span></h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-800 font-black text-3xl">$0</span>
                    <span className="text-slate-400 text-sm font-bold">/ 月</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2.5 text-sm font-bold text-slate-500">
                    <span className="text-orange-400">✓</span> 限制 10 份食譜
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-bold text-slate-500">
                    <span className="text-orange-400">✓</span> 每月 10 次 AI 解析
                  </li>
                </ul>
              </div>

              {/* Premium Plan */}
              <div className="bg-orange-500 rounded-3xl p-6 shadow-xl shadow-orange-200 border-2 border-orange-400 flex flex-col transform hover:scale-[1.01] transition-transform h-full min-h-[180px]">
                <div className="mb-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-white font-black text-xl mb-1 leading-tight">Premium</h3>
                    <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-lg font-black italic">PRO</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-black text-3xl">$99</span>
                    <span className="text-orange-100 text-sm font-bold">/ 月</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2.5 text-sm font-black text-white">
                    <span>✨</span> 無限食譜儲存 (∞)
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-black text-white">
                    <span>✨</span> 無限 AI 智能力解析
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-black text-white">
                    <span>✨</span> 專業雙欄 PDF 導出
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-black text-white">
                    <span>✨</span> 規格自動識別功能
                  </li>
                  <li className="flex items-center gap-2.5 text-sm font-black text-white">
                    <span>✨</span> QR Code 數位導航
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 按鈕區域 */}
          <div className="w-full max-w-[360px] flex flex-col items-center space-y-2 pb-4">
            <button 
              onClick={() => {
                window.open('https://ais-dev-2v2log3rzdrogmvvnzxg3i-102707397029.asia-east1.run.app', '_blank');
              }}
              className="w-full py-3 bg-[#8B5E3C] text-white rounded-[18px] font-black text-base shadow-[0_10px_30px_rgba(139,94,61,0.2)] hover:bg-[#724D31] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <span>立即升級 Premium</span>
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">🚀</div>
            </button>
            
            <button 
              onClick={() => {
                window.location.href = `mailto:linda6623@gmail.com?subject=烘焙靈感箱支付開通確認&body=我的帳號是：${auth.currentUser?.email}%0D%0A我已完成支付，請協助開通 Premium 權限。`;
              }}
              className="w-full py-2 bg-white text-[#8B5E3C] rounded-[18px] font-black text-[11px] hover:bg-orange-50 transition-all active:scale-95 border-2 border-orange-100/50 flex items-center justify-center gap-2"
            >
              <span>我已付款，通知作者開通</span>
              <div className="w-3.5 h-3.5 bg-orange-100 rounded-full flex items-center justify-center text-[9px]">📩</div>
            </button>

            <button 
              onClick={onClose}
              className="w-full pt-2 text-slate-400 font-bold text-[11px] hover:text-slate-600 transition-all text-center"
            >
              暫時不需要，繼續使用免費版
            </button>
          </div>
        </div>

        <div className="py-3 bg-[#F2E8DB]/40 border-t border-[#E8DCCB]/30 text-center">
          <p className="text-[9px] text-[#A67C52]/60 font-black tracking-[0.2em] uppercase">
            Designed for professional bakers
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const InstructionsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#FFFBF7] w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl border border-orange-100 p-8 text-center"
      >
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">✨</div>
        <h3 className="text-lg font-black text-[#8B5E3C] mb-4">使用小撇步</h3>
        <p className="text-sm font-bold text-[#A67C52] leading-relaxed mb-8">
          在筆記中包含<span className="text-[#8B5E3C]">「材料重量」</span>與<span className="text-[#8B5E3C]">「發酵/烘烤溫度」</span>，AI 解析出來的配方會更有條理喔！<br /><br />
          若有任何問題，歡迎點擊「聯絡作者」至 烘焙靈感箱 粉絲專頁與我聯繫！
        </p>
        <button 
          onClick={onClose}
          className="w-full py-3 bg-[#8B5E3C] text-white rounded-xl font-black text-sm shadow-sm hover:bg-[#724D31] transition-all active:scale-95"
        >
          我知道了！
        </button>
      </motion.div>
    </div>
  );
};

const Sidebar: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  user: User | null; 
  onLogin: () => void; 
  onLogout: () => void;
  subscriptionStatus: string;
  isAdmin: boolean;
  recipeCount: number;
  weeklyCount: number;
  onUpgrade: () => void;
  onShowInstructions: () => void;
  isVip: boolean;
  aiUsage: { count: number };
}> = ({ isOpen, onClose, user, onLogin, onLogout, subscriptionStatus, isAdmin, isVip, recipeCount, onUpgrade, onShowInstructions, aiUsage }) => {
  const isPremiumUser = isVip || isAdmin || subscriptionStatus === 'active';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2000]"
          />
          {/* Drawer Content */}
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[350px] max-w-[90vw] bg-[#FDF8F3] shadow-2xl z-[2001] flex flex-col font-sans overflow-y-auto overflow-x-hidden pb-10"
          >
            {/* Header / Logo Branding */}
            <div className="p-8 pb-4 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🍞</span>
                <h1 className="text-[#8B5E3C] font-black text-2xl tracking-tighter">Linda's</h1>
              </div>
              <h2 className="text-[#A67C52] font-black text-xs tracking-[0.3em] uppercase opacity-70">Recipe Box</h2>
            </div>

            {/* Combined Info Block */}
            <div className="mx-6 p-6 bg-[#F2E8DB]/40 rounded-2xl border border-[#E8DCCB]/60 shadow-sm">
              <div className="space-y-5 text-left">
                {/* 第一行：方案狀態 */}
                <div className="flex items-center gap-3">
                  {isPremiumUser && <span className="text-xl">👑</span>}
                  <span className="text-lg font-black text-[#8B5A2B] tracking-[0.08em] leading-tight flex flex-wrap items-center">
                    <span>方案：</span>
                    {isPremiumUser ? 
                      <span>Premium 進階版</span> : 
                      <span className="flex items-center">Standard <span className="whitespace-nowrap ml-1">免費版</span></span>
                    }
                  </span>
                </div>

                {/* 第二行：功能按鈕或狀態 */}
                <div 
                  onClick={!isPremiumUser ? onUpgrade : undefined}
                  className={`py-2 px-12 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                  isPremiumUser 
                    ? 'bg-emerald-100/50 border-emerald-400/30 shadow-[0_6px_16px_rgba(52,211,153,0.25)]' 
                    : 'bg-orange-100/40 border-orange-400/30 shadow-sm cursor-pointer hover:bg-orange-100'
                }`}>
                  <span className={`transform scale-75 ${isPremiumUser ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {isPremiumUser ? '✨' : '🔥'}
                  </span>
                  <span className={`${isPremiumUser ? 'text-emerald-700' : 'text-orange-700'} text-[11px] sm:text-[12px] font-black italic tracking-wider whitespace-nowrap`}>
                    {isPremiumUser ? '無限功能已全數開放' : '升級解鎖無限靈感'}
                  </span>
                </div>

                {/* 方案詳情與進度 */}
                <div className="space-y-3 pt-5 border-t border-[#E8DCCB]/50">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-[#8B5A2B] text-xs font-bold opacity-70">食譜儲存量</p>
                    <div className="text-[#8B5A2B] text-sm font-black flex items-center gap-1">
                      <span>{recipeCount}</span>
                      <span className="opacity-40 font-normal">/</span>
                      {isPremiumUser ? (
                        <span className="font-extrabold text-[#8B5A2B] text-lg leading-none print-symbol-small">∞</span>
                      ) : (
                        <span className="opacity-40 font-normal">10</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-[#E8DCCB]/20 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((recipeCount / (isPremiumUser ? 1000 : 10)) * 100, 100)}%` }}
                      className={`h-full ${isPremiumUser ? 'bg-emerald-400' : (recipeCount >= 10 ? 'bg-red-400' : 'bg-orange-400')}`}
                    />
                  </div>

                  {/* AI Usage Tracker */}
                  <div className="pt-2">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="text-[#8B5A2B] text-xs font-bold opacity-70">AI 解析使用量 (本月)</p>
                      <div className="text-[#8B5A2B] text-sm font-black flex items-center gap-1">
                        <span>{aiUsage.count}</span>
                        <span className="opacity-40 font-normal">/</span>
                        {isPremiumUser ? (
                          <span className="font-extrabold text-[#8B5A2B] text-lg leading-none print-symbol-small">∞</span>
                        ) : (
                          <span className="opacity-40 font-normal">10</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden border border-[#E8DCCB]/20 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((aiUsage.count / (isPremiumUser ? 1000 : 10)) * 100, 100)}%` }}
                        className={`h-full ${isPremiumUser ? 'bg-emerald-400' : (aiUsage.count >= 10 ? 'bg-red-400' : 'bg-orange-400')}`}
                      />
                    </div>
                  </div>
                  
                  {!isPremiumUser && (
                    <div className="space-y-4">
                      <button 
                        onClick={onUpgrade}
                        className="w-full mt-2 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black shadow-md hover:bg-orange-600 transition-all active:scale-95"
                      >
                        🚀 立即升級 Premium
                      </button>
                      <div className="flex flex-col items-center gap-1.5 py-1">
                        <div className="flex items-center gap-2 text-slate-400 opacity-60">
                          <CreditCard size={14} />
                          <div className="w-10 h-6 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                            <span className="text-[8px] font-black tracking-tighter">LinePay</span>
                          </div>
                          <div className="w-10 h-6 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                            <span className="text-[8px] font-black tracking-tighter">VISA</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 opacity-50 font-medium">支援多種安全支付方式</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Menu Items */}
            <div className="p-6 space-y-4">
              {/* Account Section */}
              {user && (
                <div className="bg-orange-50/50 p-4 rounded-[24px] border border-orange-100/50 shadow-sm mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-wider mb-0.5">當前帳戶</p>
                      <p className="text-xs font-black text-slate-700 truncate">{user.displayName || '烘焙愛好者'}</p>
                      <p className="text-[15px] font-bold text-slate-500 truncate mt-0.5">{user.email}</p>
                    </div>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-300 border border-orange-50 shrink-0">
                        <UserIcon size={24} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nav Links */}
              <div className="space-y-1">
                <button 
                  onClick={() => {
                    onShowInstructions();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#8B5E3C] font-black text-sm hover:bg-orange-50/50 rounded-xl transition-all group"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-base">📖</div>
                  <span>使用說明</span>
                </button>

                <button 
                  onClick={() => {
                    onUpgrade();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-orange-600 font-black text-sm hover:bg-orange-50/50 rounded-xl transition-all group"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-base">💎</div>
                  <span>訂閱說明與方案</span>
                </button>
                
                <button 
                  onClick={() => {
                    window.open("https://www.facebook.com/BakingInspirationBox", "_blank");
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#8B5E3C] font-black text-sm hover:bg-orange-50/50 rounded-xl transition-all group"
                >
                  <div className="w-5 h-5 flex items-center justify-center text-base shrink-0">📱</div>
                  <span>聯絡作者</span>
                </button>
              </div>

              {/* Login/Logout at bottom of list */}
              <div className="pt-4 border-t border-orange-100/20">
                {!user ? (
                  <button 
                    onClick={() => { onLogin(); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[#8B5E3C] font-black text-sm hover:bg-orange-50 rounded-xl transition-all"
                  >
                    <LogIn size={18} />
                    <span>Google 快速登入</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => { onLogout(); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 font-bold text-sm hover:bg-red-50 rounded-xl transition-all"
                  >
                    <LogOut size={18} />
                    <span>登出帳號</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-orange-100/10 text-center space-y-2">
               <p className="text-[9px] text-slate-300 font-bold tracking-widest uppercase">版本 1.2.5 • 手作的溫度</p>
               <p className="text-[11px] text-slate-400 opacity-60 font-medium">{COPYRIGHT_TEXT}</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCategoriesReady, setIsCategoriesReady] = useState(false);
  const [isSettingsReady, setIsSettingsReady] = useState(false);
  const [isRecipesLoading, setIsRecipesLoading] = useState(true);
  const [hasSyncedCloud, setHasSyncedCloud] = useState(false);
  const isSyncingFromCloud = useRef(false);
  const autoSaveTimerRef = useRef<any>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [knowledge, setKnowledge] = useState<Knowledge[]>(DEFAULT_KNOWLEDGE);
  const [resources, setResources] = useState<Resource[]>([]);
  
  const [storageUsage, setStorageUsage] = useState(0);
  const [isVip, setIsVip] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'active'>('free');
  const [subTypeLabel, setSubTypeLabel] = useState('一般用戶');
  const [aiUsage, setAiUsage] = useState({ date: '', count: 0 });
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(false);
  const [view, setView] = useState<AppView>(AppView.LIST);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionModalMessage, setSubscriptionModalMessage] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUserStatus, setShowUserStatus] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [suppressUpgradeModal, setSuppressUpgradeModal] = useState(false);

  const recipeStats = useMemo(() => {
    const total = recipes.length;
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const weekly = recipes.filter(r => (now - r.createdAt) < oneWeekMs).length;
    return { total, weekly };
  }, [recipes]);

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    const email = user.email.toLowerCase().trim();
    return email === 'linda6623@gmail.com' || email === 'linda6623@gamil.com';
  }, [user]);

  // 定義統一的進階判斷
  const isPremiumUser = isVip || subscriptionStatus === 'active' || isAdmin;

  const triggerUpgradePrompt = (force = false, message?: string) => {
    // 優先檢查進階權限
    if (isPremiumUser) return;
    if (!force && suppressUpgradeModal) return;
    setSubscriptionModalMessage(message);
    setIsSubscriptionModalOpen(true);
  };

  useEffect(() => {
    if (isAdmin) {
      setIsVip(true);
      setSubscriptionStatus('active');
      setIsCloudSyncEnabled(true);
    }
  }, [isAdmin]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery.trim().length > 1) {
        setSearchHistory(prev => {
          const filtered = prev.filter(h => h !== searchQuery.trim());
          return [searchQuery.trim(), ...filtered].slice(0, 5);
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'category' | 'title'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState('');

  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>({});

  // Firebase Auth Listener
  useEffect(() => {
    console.clear();
    console.log("烘焙百寶箱已啟動，正在初始化 Firebase...");
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? `User logged in (UID: ${u.uid})` : "No user logged in");
      setUser(u);
      
      // 登入或切換帳號時，立即重置權限狀態，確保不使用舊快取
      setIsVip(false);
      setSubscriptionStatus('free');
      setIsCloudSyncEnabled(false);
      setSubTypeLabel('一般用戶');
      
      setIsAuthReady(true);
      setIsCategoriesReady(false); // Reset readiness on auth change
      setIsSettingsReady(false);
      setIsRecipesLoading(true);
      setHasSyncedCloud(false);
    });
    return unsubscribe;
  }, []);

  // Firestore Sync - Recipes
  useEffect(() => {
    // 1. Auth Guard & Sequential Check
    // We must wait for auth to be determined, and if logged in, wait for categories/settings
    if (!isAuthReady) return;
    if (user && (!isCategoriesReady || !isSettingsReady)) return; 

    setIsRecipesLoading(true);

    // 2. Forced Cache Conflict Resolution
    // If logged in, strictly use Firebase (bypass LocalStorage entirely)
    if (user) {
      console.log("雲端同步啟動，正在抓取 UID:", user.uid);
      const q = query(collection(db, 'recipes'), where('author_id', '==', user.uid));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Recipe));
        
        // Deduplicate docs by ID before setting state
        const uniqueDocs = Array.from(new Map(docs.map(item => [item.id, item])).values());

        if (uniqueDocs.length === 0) {
          console.log(`[Debug] 雲端回傳食譜數為 0，請檢查 UID: ${user.uid}`);
        }

        setRecipes(uniqueDocs);
        setIsRecipesLoading(false);
        if (!hasSyncedCloud) {
          showToast("☁️ 雲端食譜同步成功");
          setHasSyncedCloud(true);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'recipes');
        setIsRecipesLoading(false);
      });

      return () => unsubscribe();
    } else {
      // 3. Local Mode (Not Logged In)
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        const loaded: Recipe[] = JSON.parse(localData);
        // Deduplicate local storage data
        const uniqueLoaded = Array.from(new Map(loaded.map(item => [item.id, item])).values());
        setRecipes(uniqueLoaded);
      } else {
        setRecipes([]);
      }
      setIsRecipesLoading(false);
    }
  }, [user, isAuthReady, isCategoriesReady, isSettingsReady, isAdmin, isVip]);

  // Firestore Sync - Categories (Independent Collection)
  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      const localCats = localStorage.getItem(CATEGORIES_KEY);
      if (localCats) setCategories(JSON.parse(localCats));
      setIsCategoriesReady(true);
      return;
    }

    const docRef = doc(db, 'user_categories', user.uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        isSyncingFromCloud.current = true;
        if (data.categories) setCategories(data.categories);
        setTimeout(() => { isSyncingFromCloud.current = false; }, 100);
      }
      setIsCategoriesReady(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `user_categories/${user.uid}`);
      setIsCategoriesReady(true); // Fallback to allow recipes to load even on error
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Firestore Sync - Settings (Remaining settings)
  useEffect(() => {
    if (!isAuthReady || !user) {
      if (!user) {
        const localKnowledge = localStorage.getItem(KNOWLEDGE_KEY);
        if (localKnowledge) setKnowledge(JSON.parse(localKnowledge));
        const localSteps = localStorage.getItem(COMPLETED_STEPS_KEY);
        if (localSteps) setCompletedSteps(JSON.parse(localSteps));
        setIsSettingsReady(true);
      }
      return;
    }

    const docRef = doc(db, 'userSettings', user.uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        isSyncingFromCloud.current = true;
        
        let subStatus: 'free' | 'active' = 'free';
        const now = Date.now();
        const isTrialActive = data.trial_until && data.trial_until > now;
        const isPermanentVip = data.is_permanent_vip === true;

        if (isAdmin || data.subscriptionStatus === 'active' || data.is_vip || isTrialActive || isPermanentVip) {
          subStatus = 'active';
        }

        setSubscriptionStatus(subStatus);
        setIsVip(subStatus === 'active');
        
        let label = '一般用戶';
        if (isAdmin) label = '超級管理員';
        else if (isPermanentVip) label = '永久 VIP';
        else if (isTrialActive) label = '試用中';
        else if (subStatus === 'active') label = 'Premium 會員';
        setSubTypeLabel(label);
        
        if (data.knowledge) setKnowledge(data.knowledge);
        if (data.completedSteps) setCompletedSteps(data.completedSteps);
        if (data.aiUsage) setAiUsage(data.aiUsage);
        
        if (data.is_cloud_sync_enabled !== undefined) {
          setIsCloudSyncEnabled(true);
        }
        setIsSettingsReady(true);
        setTimeout(() => { isSyncingFromCloud.current = false; }, 100);
      } else {
        // Doc doesn't exist yet, but settings are "ready" (with defaults)
        setIsCloudSyncEnabled(true);
        setIsSettingsReady(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `userSettings/${user.uid}`);
      setIsSettingsReady(true); // Allow fallback even on error
    });

    return () => unsubscribe();
  }, [user, isAuthReady, isAdmin]);

  // Helper to sync categories to cloud immediately
  const syncCategoriesToCloud = async (newCategories: Category[]) => {
    if (!user) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(newCategories));
      return;
    }
    try {
      await setDoc(doc(db, 'user_categories', user.uid), { 
        categories: newCategories,
        updatedAt: Date.now() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `user_categories/${user.uid}`);
    }
  };

  // Helper to save settings to Firestore
  const saveUserSettings = async (updates: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'userSettings', user.uid), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `userSettings/${user.uid}`);
    }
  };

  // Update LocalStorage and Firestore
  useEffect(() => {
    if (!user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    }
  }, [recipes, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
    // Categories are now synced explicitly in manage actions
  }, [categories, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge));
    } else if (!isSyncingFromCloud.current) {
      saveUserSettings({ knowledge });
    }
  }, [knowledge, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(COMPLETED_STEPS_KEY, JSON.stringify(completedSteps));
    } else if (!isSyncingFromCloud.current) {
      saveUserSettings({ completedSteps });
    }
  }, [completedSteps, user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("登入成功！");
    } catch (error) {
      console.error("Login Error:", error);
      showToast("登入失敗");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("已登出");
      setIsVip(false);
      setRecipes([]);
      setCategories(DEFAULT_CATEGORIES);
      setKnowledge([]);
      setCompletedSteps({});
      setHasSyncedCloud(false);
      
      // Clear local storage for privacy
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CATEGORIES_KEY);
      localStorage.removeItem(KNOWLEDGE_KEY);
      localStorage.removeItem(RESOURCE_STORAGE_KEY);
      localStorage.removeItem(COMPLETED_STEPS_KEY);
      
      setView(AppView.LIST);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // Data Migration Logic
  useEffect(() => {
    const migrateData = async () => {
      if (!user || !isAuthReady) return;
      
      const migrationFlag = localStorage.getItem(`migrated_${user.uid}`);
      if (migrationFlag) return;

      const localRecipesRaw = localStorage.getItem(STORAGE_KEY);
      if (!localRecipesRaw) return;

      try {
        const localRecipes = JSON.parse(localRecipesRaw) as Recipe[];
        if (localRecipes.length === 0) return;

        showToast("正在遷移本地食譜至雲端...");
        
        for (const recipe of localRecipes) {
          let newRecipe = { 
            ...recipe, 
            uid: user.uid, 
            author_id: user.uid, 
            createdAt: recipe.createdAt || Date.now() 
          };
          try {
            await setDoc(doc(db, 'recipes', recipe.id), newRecipe);
          } catch (error: any) {
            const errorMsg = error?.message || String(error);
            if (error.code === 'permission-denied' || errorMsg.includes('permissions')) {
              // Collision with someone else's ID - generate new unique ID
              const newId = 'rec-' + Date.now() + Math.random().toString(36).substring(2, 7);
              newRecipe = { ...newRecipe, id: newId };
              try {
                await setDoc(doc(db, 'recipes', newId), newRecipe);
              } catch (e2) {
                console.error("Cloud migration backup storage failed", e2);
              }
            } else {
              console.error("Cloud migration failed for recipe", recipe.id, error);
            }
          }
        }

        // Migrate categories, knowledge, completedSteps
        const localCatsRaw = localStorage.getItem(CATEGORIES_KEY);
        if (localCatsRaw) {
          const localCats = JSON.parse(localCatsRaw);
          await saveUserSettings({ categories: localCats });
        }

        const localKnowledgeRaw = localStorage.getItem(KNOWLEDGE_KEY);
        if (localKnowledgeRaw) {
          const localKnowledge = JSON.parse(localKnowledgeRaw);
          await saveUserSettings({ knowledge: localKnowledge });
        }

        const localStepsRaw = localStorage.getItem(COMPLETED_STEPS_KEY);
        if (localStepsRaw) {
          const localSteps = JSON.parse(localStepsRaw);
          await saveUserSettings({ completedSteps: localSteps });
        }

        localStorage.setItem(`migrated_${user.uid}`, 'true');
        
        // Clear old local storage after migration
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
        localStorage.removeItem(KNOWLEDGE_KEY);
        localStorage.removeItem(RESOURCE_STORAGE_KEY);
        localStorage.removeItem(COMPLETED_STEPS_KEY);
        
        showToast("遷移完成！");
      } catch (error) {
        console.error("Migration Error:", error);
        showToast("遷移失敗，請稍後再試");
      }
    };

    migrateData();
  }, [user, isAuthReady]);
  
  // Scaling states
  const [scalingRecipeId, setScalingRecipeId] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number>(1);
  const [reverseScalingBase, setReverseScalingBase] = useState<{ sectionKey: string; index: number } | null>(null);
  // const [isRecipeCardModalOpen, setIsRecipeCardModalOpen] = useState(false); // 已移除
  const [isMoldPanelOpen, setIsMoldPanelOpen] = useState(false);
  
  // Mold scaling states - split into two independent objects
  const [sourceMold, setSourceMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });
  const [targetMold, setTargetMold] = useState({ type: 'circular' as 'circular' | 'rectangular', diameter: 0, height: 0, length: 0, width: 0 });

  // Execution Log states
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLog, setNewLog] = useState<Partial<ExecutionLog>>({ date: getTodayString(), rating: 5, feedback: '', photoUrl: '' });
  const logPhotoInputRef = useRef<HTMLInputElement>(null);

  const [newNote, setNewNote] = useState({ title: '', content: '', master: '' });

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
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatValue, setEditingCatValue] = useState('');
  const [lastUsedUnit, setLastUsedUnit] = useState('g');
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  // AI 預覽彈窗狀態
  const [aiPreviewData, setAiPreviewData] = useState<Partial<Recipe>[] | null>(null);

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

  useEffect(() => {
    const calculateUsage = () => {
      // 根據是否為進階用戶設定上限：免費版 10 份，Premium 1000 份
      const limit = isPremiumUser ? 1000 : 10; 
      const percentage = (recipes.length / limit) * 100;
      setStorageUsage(percentage);
    };
    calculateUsage();
  }, [recipes, isPremiumUser, user]);

  const extractHashtags = (text: string): string[] => {
    if (!text) return [];
    const hashRegex = /#([\w\u4e00-\u9fa5]+)/g;
    const matches = text.match(hashRegex);
    return matches ? matches.map(m => m.slice(1)) : [];
  };

  const allTags = useMemo(() => {
    const tagsFromFields = recipes.flatMap(r => r.tags || []);
    const tagsFromTitles = recipes.flatMap(r => extractHashtags(r.title));
    const tagsFromNotes = recipes.flatMap(r => extractHashtags(r.notes || ''));
    const tagsFromSteps = recipes.flatMap(r => (r.instructions || []).flatMap(s => extractHashtags(s)));
    return [...new Set([...tagsFromFields, ...tagsFromTitles, ...tagsFromNotes, ...tagsFromSteps])];
  }, [recipes]);

  const hotTags = useMemo(() => {
    return allTags.slice(0, 8);
  }, [allTags]);

  const filteredRecipes = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase().trim();
    const isHashtagSearch = query.startsWith('#');
    const tagToSearch = isHashtagSearch ? query.slice(1) : '';

    return recipes.filter(r => {
      // Hashtag matching logic
      if (isHashtagSearch && tagToSearch) {
        const recipeTags = [
          ...(r.tags || []),
          ...extractHashtags(r.title),
          ...extractHashtags(r.notes || ''),
          ...(r.instructions || []).flatMap(s => extractHashtags(s))
        ].map(t => t.toLowerCase());
        
        return recipeTags.includes(tagToSearch);
      }

      const matchSearch = !query || (
        r.title.toLowerCase().includes(query) || 
        (r.master && r.master.toLowerCase().includes(query)) ||
        // 全文檢索材料
        (r.ingredients || []).some(i => i.name.toLowerCase().includes(query)) ||
        (r.liquidStarterIngredients || []).some(i => i.name.toLowerCase().includes(query)) ||
        (r.fillingIngredients || []).some(i => i.name.toLowerCase().includes(query)) ||
        (r.decorationIngredients || []).some(i => i.name.toLowerCase().includes(query)) ||
        (r.customSectionIngredients || []).some(i => i.name.toLowerCase().includes(query)) ||
        // 全文檢索步驟
        (r.instructions || []).some(step => step.toLowerCase().includes(query)) ||
        // 全文檢索備註與介紹
        (r.description && r.description.toLowerCase().includes(query)) ||
        (r.notes && r.notes.toLowerCase().includes(query))
      );
      
      const matchCategory = 
        activeCategory === '全部' ? true :
        activeCategory === '⏳ 待嘗試' ? r.isTried :
        r.category === activeCategory;
      return matchSearch && matchCategory;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'createdAt') {
        comparison = (a.createdAt || 0) - (b.createdAt || 0);
      } else if (sortBy === 'updatedAt') {
        const timeA = a.updatedAt || a.createdAt || 0;
        const timeB = b.updatedAt || b.createdAt || 0;
        comparison = timeA - timeB;
      } else if (sortBy === 'category') {
        comparison = (a.category || '').localeCompare(b.category || '');
      } else if (sortBy === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [recipes, debouncedSearchQuery, activeCategory, sortBy, sortOrder]);

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

  const totalScaledWeight = useMemo(() => {
    if (!scalingRecipe) return 0;
    let total = 0;
    const allSections = [
      scalingRecipe.ingredients,
      scalingRecipe.liquidStarterIngredients,
      scalingRecipe.fillingIngredients,
      scalingRecipe.decorationIngredients,
      scalingRecipe.customSectionIngredients
    ];
    allSections.forEach(section => {
      (section || []).forEach(ing => {
        const amt = typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount as string) || 0;
        if (ing.unit === 'g' || ing.unit === '克') {
          total += amt * scalingFactor;
        }
      });
    });
    return total;
  }, [scalingRecipe, scalingFactor]);

  const handleReverseScale = (sectionKey: string, index: number, newAmount: number) => {
    if (!scalingRecipe) return;
    
    let originalIngredients: Ingredient[] = [];
    if (sectionKey === 'ingredients') originalIngredients = scalingRecipe.ingredients;
    else if (sectionKey === 'liquidStarterIngredients') originalIngredients = scalingRecipe.liquidStarterIngredients || [];
    else if (sectionKey === 'fillingIngredients') originalIngredients = scalingRecipe.fillingIngredients || [];
    else if (sectionKey === 'decorationIngredients') originalIngredients = scalingRecipe.decorationIngredients || [];
    else if (sectionKey === 'customSectionIngredients') originalIngredients = scalingRecipe.customSectionIngredients || [];

    const originalIng = originalIngredients[index];
    if (!originalIng) return;

    const originalAmt = typeof originalIng.amount === 'number' ? originalIng.amount : parseFloat(originalIng.amount as string) || 0;
    if (originalAmt <= 0) return;

    const requiredScalingFactor = newAmount / originalAmt;
    const newTargetQuantity = (requiredScalingFactor / calculatedMoldFactor) * (scalingRecipe.quantity || 1);
    
    setTargetQuantity(newTargetQuantity);
    setReverseScalingBase({ sectionKey, index });
  };

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

  const addTag = (val: string) => {
    const cleanTag = val.trim().replace(/[，,]/g, '');
    if (!cleanTag) return;
    setFormRecipe(prev => ({
      ...prev,
      tags: Array.from(new Set([...(prev.tags || []), cleanTag]))
    }));
    setTagInput('');
  };

  const handleTagsInputChange = (val: string) => {
    setTagInput(val);
    if (!isComposing && (val.endsWith(',') || val.endsWith('，'))) {
      addTag(val);
    }
  };

  const proceedWithAIParse = async () => {
    setIsAiParsing(true);
    const apiKey = getApiKey();
    console.log('[Auth] API Key status:', !!apiKey ? 'Detected' : 'Missing');

    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!apiKey || apiKey === 'YOUR_API_KEY') {
          console.error("Error: API Key is undefined or invalid. AI Parsing aborted.");
          throw new Error("MISSING_API_KEY");
        }

        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ 
          model: "models/gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        console.log('[AI] Using model path: models/gemini-2.5-flash');

        const prompt = `你是一個專業且極具適應力的烘焙食譜解析助手。
        請從下方的【筆記內容】中識別並提取烘焙食譜資訊。
        
        【重要指引】：
        1. 內容可能包含大量的表情符號、小叮嚀、閒聊或不規則的換行，請無視這些噪音，專注於提取食譜的核心結構（標題、材料、步驟）。
        2. 只要內容中偵測到「數字 + 單位（如 g, ml, 份, tsp, tbsp）」的組合，通常表示這是有效的食譜材料，請務必盡力解析。
        3. 烘焙食譜常包含多個區塊（例如：中種、主麵糰、內餡、抹面、裝飾），請務必將這些區塊資料分別提取到對應的欄位中。
        4. 請務必識別出以下特殊資訊：
           - 食譜簡介 (description)：筆記開頭通常有一段感性描述、食譜來源背景或作者的真心推薦。
           - 小叮嚀 (notes)：筆記中關於「💡 小技巧」、「注意」、「Tips」或是作者額外補充的技術細節。
           - 規格重量：若筆記中有提到「麵糰/皮/主體」的每顆克數，請放入 doughWeight；若提到「內餡/餡」的每顆克數，請放入 fillingWeight。僅提取數字部分。
        5. 請確保輸出是一個可以用 JSON.parse() 直接解析的純 JSON 對象。
        
        【筆記內容】：
        ${smartPasteText}
        
        【輸出要求】：
        1. 請務必回傳純 JSON 格式，不要包含任何 Markdown 標籤或是 code block 符號。
        2. 根節點必須是一個名為 "recipes" 的陣列。
        3. 每個食譜物件必須包含:
           - title (食譜名稱)
           - description (食譜感性簡介，若無則留空)
           - notes (小叮嚀或技術細節，若無則留空)
           - doughWeight (麵糰或皮的重量數字，若無則留空)
           - fillingWeight (內餡重量數字，若無則留空)
           - ingredients (陣列, 包含 name, amount, unit)
           - instructions (陣列, 包含步驟字串)
           - liquidStarterIngredients (如有中種區塊，請放入此陣列)
           - fillingIngredients (如有內餡區塊，請放入此陣列)
           - decorationIngredients (如有裝飾區塊，請放入此陣列)
           - customSectionIngredients (如有其他自定義區塊，請放入此陣列)
        4. 即使格式混亂，也請嘗試將內容對應到最接近的欄位。
        `;

        // 實作超時保護 (60s)
        const aiPromise = model.generateContent(prompt);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 60000));
        
        console.log(`[AI] Parsing content (Attempt ${attempt})... waiting for response.`);
        const result = await Promise.race([aiPromise, timeoutPromise]) as any;
        const response = await result.response;
        const textOutput = response.text();
        
        if (!textOutput) throw new Error("EMPTY_API_RESPONSE");
        
        let parsed;
        try {
          parsed = JSON.parse(textOutput);
        } catch (parseErr) {
          console.error('[AI] JSON Parse failed. Raw response:', textOutput);
          throw new Error("JSON_PARSE_ERROR");
        }

        const recipesFound = (parsed.recipes || []).filter((r: any) => 
          (r.ingredients?.length || 0) > 0 || 
          (r.liquidStarterIngredients?.length || 0) > 0 ||
          (r.fillingIngredients?.length || 0) > 0 ||
          (r.decorationIngredients?.length || 0) > 0 ||
          (r.customSectionIngredients?.length || 0) > 0
        );

        if (recipesFound.length === 0) {
          console.warn('[AI] No recipes identified. Results:', parsed);
          console.log('[AI] Raw Output for debugging:', textOutput);
          showToast("未能識別出有效食譜，請確認內容是否包含材料量 (如 100g)");
        } else {
          console.log('[AI] Parsing Success');
          if (recipesFound.length === 1) {
            applyParsedRecipe(recipesFound[0]);
          } else {
            setAiPreviewData(recipesFound);
          }
        }
        
        lastError = null;
        break; // Success
      } catch (err: any) {
        lastError = err;
        const code = err?.message || "UNKNOWN_ERROR";
        
        // 更積極的重試策略：包含超時、網路錯誤與 429 高負載
        if (attempt < maxRetries && (
          code === "TIMEOUT" || 
          code.includes("fetch") || 
          code.includes("429") || 
          code.includes("RESOURCE_EXHAUSTED") ||
          err?.name === "AbortError" || 
          code.includes("ECONNRESET")
        )) {
          console.warn(`[AI] Attempt ${attempt} failed (${code}), retrying...`);
          await new Promise(res => setTimeout(res, 2000));
          continue;
        }
        break;
      }
    }

    if (lastError) {
      const codeValue = lastError?.message || "UNKNOWN_ERROR";
      console.error(`[AI] Parsing Failed: ${codeValue}`, lastError);
      
      const errorMap: Record<string, string> = {
        "TIMEOUT": "遠端連線較慢，請確認網路狀態後重試",
        "MISSING_API_KEY": "未偵測到開發金鑰，請聯繫管理員",
        "EMPTY_API_RESPONSE": "AI 回傳內容為空，請重試",
        "JSON_PARSE_ERROR": "AI 回傳格式有誤，請再試一次或檢視 Console",
        "Quota": "解析頻率過高，請稍候再試 (429)",
        "AI_TIMEOUT": "遠端連線較慢，請確認網路狀態後重試",
        "NOT_FOUND": "服務連線不穩，請確認網路與金鑰狀態",
        "RESOURCE_EXHAUSTED": "模型目前負載較高，請稍候再試"
      };
      
      let displayError = errorMap[codeValue] || `解析失敗: ${codeValue}`;
      if (codeValue.includes('404') || codeValue.includes('429') || codeValue.includes('NOT_FOUND') || codeValue.includes('RESOURCE_EXHAUSTED')) {
        displayError = "模型已更新至 2.0 版，若連線不穩請稍後重試";
      }
      
      showToast(displayError);
    }

    setIsAiParsing(false);
  };

  const handleSmartPaste = async () => {
    if (!smartPasteText.trim()) return;
    
    // AI 解析次數限制判斷 (非 Premium 用戶每月上限 10 次)
    if (!isPremiumUser) {
      const thisMonth = getThisMonthString();
      if (aiUsage.date === thisMonth && aiUsage.count >= 10) {
        triggerUpgradePrompt(true, "每月 AI 解析次數已達上限 (10次)，升級 Premium 可解鎖無限次數！");
        return;
      }
    }
    
    await proceedWithAIParse();
    
    // 解析成功後，若非 Premium 則更新次數
    if (!isPremiumUser) {
      const thisMonth = getThisMonthString();
      const newUsage = aiUsage.date === thisMonth ? { ...aiUsage, count: aiUsage.count + 1 } : { date: thisMonth, count: 1 };
      setAiUsage(newUsage);
      if (user) {
        saveUserSettings({ aiUsage: newUsage });
      }
    }
  };

  const applyParsedRecipe = (parsed: Partial<Recipe>) => {
    setFormRecipe(prev => ({
      ...prev,
      ...parsed,
      description: parsed.description || prev.description,
      notes: parsed.notes || prev.notes,
      doughWeight: parsed.doughWeight || prev.doughWeight,
      fillingWeight: parsed.fillingWeight || prev.fillingWeight,
      ingredients: parsed.ingredients?.length ? parsed.ingredients : prev.ingredients,
      liquidStarterIngredients: parsed.liquidStarterIngredients || [],
      fillingIngredients: parsed.fillingIngredients || [],
      decorationIngredients: parsed.decorationIngredients || [],
      customSectionIngredients: parsed.customSectionIngredients || [],
      mainSectionName: parsed.mainSectionName || prev.mainSectionName,
      liquidStarterName: parsed.liquidStarterName || prev.liquidStarterName,
      fillingSectionName: parsed.fillingSectionName || prev.fillingSectionName,
      decorationSectionName: parsed.decorationSectionName || prev.decorationSectionName,
      customSectionName: parsed.customSectionName || prev.customSectionName,
      fermentationStages: parsed.fermentationStages || [],
      bakingStages: parsed.bakingStages || [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : (parsed.instructions ? [parsed.instructions] : prev.instructions),
      tags: [...new Set([...(prev.tags || []), ...(parsed.tags || [])])]
    }));
    setAiPreviewData(null);
    setSmartPasteText('');
    
    // 如果不在編輯或新增模式，自動切換到新增模式
    if (view !== AppView.CREATE && view !== AppView.EDIT) {
      setView(AppView.CREATE);
    }
    
    showToast("✨ 食譜全方位歸位完成！");
  };

  const handleMergeParsedRecipes = () => {
    if (!aiPreviewData) return;
    const merged: Partial<Recipe> = {
      title: aiPreviewData[0].title || '合併解析食譜',
      ingredients: aiPreviewData.flatMap(r => r.ingredients || []) as Ingredient[],
      liquidStarterIngredients: aiPreviewData.flatMap(r => r.liquidStarterIngredients || []) as Ingredient[],
      fillingIngredients: aiPreviewData.flatMap(r => r.fillingIngredients || []) as Ingredient[],
      decorationIngredients: aiPreviewData.flatMap(r => r.decorationIngredients || []) as Ingredient[],
      customSectionIngredients: aiPreviewData.flatMap(r => r.customSectionIngredients || []) as Ingredient[],
      fermentationStages: aiPreviewData.flatMap(r => r.fermentationStages || []) as FermentationStage[],
      bakingStages: aiPreviewData.flatMap(r => r.bakingStages || []) as BakingStage[],
      instructions: aiPreviewData.flatMap(r => r.instructions || []) as string[],
      tags: [...new Set(aiPreviewData.flatMap(r => r.tags || []) as string[])],
      notes: aiPreviewData.map(r => r.notes).filter(Boolean).join('\n---\n'),
      description: aiPreviewData.map(r => r.description).filter(Boolean).join('\n'),
      master: aiPreviewData.find(r => r.master)?.master || ''
    };
    applyParsedRecipe(merged);
  };

  const handleImportAllParsedRecipes = async () => {
    if (!aiPreviewData) return;
    handleMergeParsedRecipes();
    showToast(`✨ 全方位歸位完成！`);
  };

  // Auto-save draft logic
  useEffect(() => {
    if ((view === AppView.CREATE || view === AppView.EDIT) && user && formRecipe.title) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, 'drafts', user.uid), {
            ...formRecipe,
            savedAt: Date.now()
          });
          console.log("Draft auto-saved");
        } catch (e) {
          console.warn("Draft auto-save failed");
        }
      }, 5000); // 5 seconds debounce
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formRecipe, view, user]);

  const restoreDraft = async () => {
    if (!user) return;
    try {
      const draftDoc = await getDoc(doc(db, 'drafts', user.uid));
      if (draftDoc.exists()) {
        const draftData = draftDoc.data() as Recipe;
        setFormRecipe(draftData);
        showToast("✅ 已還原最新草稿");
      } else {
        showToast("尚未發現可還原的草稿");
      }
    } catch (e) {
      showToast("讀取草稿失敗");
    }
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

  const renameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingCatId(null);
      return;
    }

    // 1. 更新本機食譜狀態
    const updatedRecipes = recipes.map(r => {
      if (r.category === oldName) {
        return { ...r, category: newName };
      }
      return r;
    });
    setRecipes(updatedRecipes);

    // 2. 更新分類列表
    const updatedCats = categories.map(c => 
      c.name === oldName ? { ...c, name: newName } : c
    );
    setCategories(updatedCats);

    // 3. 更新同步邏輯
    await syncCategoriesToCloud(updatedCats);
    
    if (user && isCloudSyncEnabled) {
      // 更新雲端食譜
      const recipesToUpdate = recipes.filter(r => r.category === oldName);
      await Promise.all(recipesToUpdate.map(async (r) => {
        try {
          await updateDoc(doc(db, 'recipes', r.id), { category: newName });
        } catch (e) {
          console.error("Renaming cloud recipe failed", e);
        }
      }));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecipes));
    }

    setEditingCatId(null);
    showToast(`分類「${oldName}」已更新為「${newName}」並同步所有食譜`);
  };

  const handleCreateNew = () => {
    setTagInput('');
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
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.recipes) {
          const incomingRecipes = Array.isArray(data.recipes) ? data.recipes : [];
          
          const processed = incomingRecipes.map((r: any) => ({
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
            executionLogs: Array.isArray(r.executionLogs) ? r.executionLogs : [],
            uid: user?.uid || null,
            author_id: user?.uid || null
          }));

          let finalImportedSet: Recipe[] = [...processed];
          if (user) {
            // Write to Firestore (Add new ones, don't delete existing)
            finalImportedSet = await Promise.all(processed.map(async (recipe: Recipe) => {
              let r = { ...recipe };
              try {
                await setDoc(doc(db, 'recipes', r.id), r);
                return r;
              } catch (error: any) {
                // If permission-denied, ID might be taken by someone else - try a new one
                const errorMsg = error?.message || String(error);
                if (error.code === 'permission-denied' || errorMsg.includes('permissions')) {
                  const newId = 'rec-' + Date.now() + Math.random().toString(36).substring(2, 7);
                  r = { ...r, id: newId };
                  try {
                    await setDoc(doc(db, 'recipes', newId), r);
                    return r;
                  } catch (e2) {
                    handleFirestoreError(e2, OperationType.WRITE, `recipes/${newId}`);
                  }
                } else {
                  handleFirestoreError(error, OperationType.WRITE, `recipes/${r.id}`);
                }
                return r;
              }
            }));
          }
          
          const processedIds = new Set(finalImportedSet.map(r => r.id));
          setRecipes(prev => {
            const filteredPrev = prev.filter(r => !processedIds.has(r.id));
            return [...finalImportedSet, ...filteredPrev];
          });
        }
        if (data.categories) {
          if (user) {
            await saveUserSettings({ categories: data.categories });
            localStorage.removeItem(CATEGORIES_KEY);
          } else {
            setCategories(data.categories);
          }
        }
        if (data.knowledge) {
          if (user) {
            await saveUserSettings({ knowledge: data.knowledge });
            localStorage.removeItem(KNOWLEDGE_KEY);
          } else {
            setKnowledge(data.knowledge);
          }
        }
        if (data.resources) {
          if (user) {
            await saveUserSettings({ resources: data.resources });
            localStorage.removeItem(RESOURCE_STORAGE_KEY);
          } else {
            setResources(data.resources);
          }
        }
        showToast('匯入成功！雲端資料已同步。');
        // Reset file input
        if (backupInputRef.current) backupInputRef.current.value = '';
      } catch (err) { 
        console.error("Import Error:", err);
        showToast('匯入失敗，請檢查檔案格式'); 
      }
    };
    reader.readAsText(file);
  };

  const handleAddLog = async () => {
    if (!selectedRecipe || !newLog.feedback) return;
    const log: ExecutionLog = {
      id: 'log-' + Date.now(),
      date: newLog.date || getTodayString(),
      rating: newLog.rating || 5,
      feedback: newLog.feedback || '',
      photoUrl: newLog.photoUrl
    };
    const updatedRecipe: Recipe = {
      ...selectedRecipe,
      executionLogs: [log, ...(selectedRecipe.executionLogs || [])],
      updatedAt: Date.now()
    };

    if (user && isCloudSyncEnabled) {
      try {
        await setDoc(doc(db, 'recipes', updatedRecipe.id), updatedRecipe);
      } catch (error) {
        console.error("Error updating recipe log:", error);
        showToast("雲端同步失敗");
        return;
      }
    }

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

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    const recipeIdToDelete = String(selectedRecipe.id);
    
    if (user && isCloudSyncEnabled) {
      try {
        await deleteDoc(doc(db, 'recipes', recipeIdToDelete));
      } catch (error) {
        console.error("Error deleting recipe:", error);
        showToast("雲端刪除失敗");
        return;
      }
    }
    
    // Always update local state
    const updatedRecipes = recipes.filter(r => String(r.id) !== recipeIdToDelete);
    setRecipes(updatedRecipes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecipes));
    
    setSelectedRecipe(null);
    setSearchQuery('');
    setActiveCategory('全部');
    setView(AppView.LIST);
    showToast("食譜已刪除");
  };

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-slate-900 pb-28 print:bg-white print:pb-0 print:min-h-0">
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        subscriptionStatus={subscriptionStatus}
        isAdmin={isAdmin}
        isVip={isVip}
        recipeCount={recipes.length}
        weeklyCount={recipeStats.weekly}
        onUpgrade={() => triggerUpgradePrompt(true)}
        onShowInstructions={() => setIsInstructionsOpen(true)}
        aiUsage={aiUsage}
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:max-w-none print:px-0 print:py-0">
        
        {/* Auth Header (Sidebar Trigger) */}
        <div className="flex flex-col gap-4 mb-6 no-print">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-orange-100 text-[#8B5E3C] hover:bg-orange-50 hover:shadow-md transition-all active:scale-95"
            title="開啟功能選單"
          >
            <Menu size={24} />
          </button>
          
          {view === AppView.DETAIL && (
            <button 
              onClick={() => setView(AppView.LIST)} 
              className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-orange-100 text-orange-400 hover:bg-orange-50 hover:text-orange-600 hover:shadow-md transition-all active:scale-95"
              title="回列表頁"
            >
              <div className="text-xl font-bold">←</div>
            </button>
          )}
        </div>

        {/* LIST View Header */}
        {view === AppView.LIST && (
          <header className="flex flex-col gap-6 mb-8 animate-in fade-in slide-in-from-top-4 no-print">
            {isRecipesLoading && (
              <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex items-center justify-center gap-3 animate-pulse">
                <span className="text-xl">🔄</span>
                <span className="text-sm font-black text-orange-600">正在從雲端同步您的筆記...</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-sm">🥖</div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[#E67E22] leading-tight">
                    烘焙靈感箱
                  </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-orange-300 text-xs font-medium">記錄師傅的筆記與經典配方</p>
            {user && isCloudSyncEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-[14px] font-black text-emerald-500 bg-emerald-50 px-[10px] h-[28px] rounded-[50px] border border-emerald-100 shadow-sm transition-all transform hover:scale-105 active:scale-95 cursor-default shrink-0 mt-0.5">
                <Cloud size={14} strokeWidth={3} />
                <span className="leading-none whitespace-nowrap">已安全備份至雲端</span>
              </span>
            ) : (
              <button 
                onClick={() => triggerUpgradePrompt(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-black text-orange-500 bg-orange-50 px-[10px] h-[28px] rounded-[50px] border border-orange-100 hover:bg-orange-100 transition-all shadow-sm group shrink-0 mt-0.5"
              >
                <CloudOff size={14} className="group-hover:scale-110 transition-transform" />
                <span className="leading-none whitespace-nowrap">僅存在此裝置</span>
              </button>
            )}
                    </div>
                    
                    {/* 儲存空間進度條 */}
                    <div className="mt-4 max-w-[200px] no-print" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-full shadow-sm text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all active:scale-95">
                    <span className="text-base">📤</span>
                    <span>匯出備份</span>
                 </button>
                 <button 
                  onClick={() => {
                    backupInputRef.current?.click();
                  }} 
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-full shadow-sm text-xs font-bold text-orange-600 hover:bg-orange-50 transition-all active:scale-95"
                 >
                    <span className="text-base">📥</span>
                    <span>匯入備份</span>
                 </button>
                 <input type="file" ref={backupInputRef} onChange={handleImport} className="hidden" accept=".json" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="搜尋食譜標題、材料或輸入 #標籤..." 
                  value={searchQuery || ''} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-11 pr-12 py-3 bg-white border border-orange-100 rounded-2xl focus:ring-2 focus:ring-orange-400 outline-none shadow-sm text-sm transition-all" 
                />
                <span className="absolute left-4 top-3.5 text-orange-300 transition-colors group-focus-within:text-orange-500">🔍</span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-3 text-slate-300 hover:text-orange-500 transition-all"
                  >
                    <X size={18} />
                  </button>
                )}

                {/* Hashtag Suggestion Menu */}
                {searchQuery === '#' && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-orange-50 z-[1100] p-4 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">可用標籤</p>
                    <div className="flex flex-wrap gap-2">
                      {allTags.length > 0 ? allTags.map(tag => (
                        <button 
                          key={`suggest-${tag}`} 
                          onClick={() => setSearchQuery('#' + tag)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-xs font-black border border-orange-100 hover:bg-orange-100 transition-all"
                        >
                          #{tag}
                        </button>
                      )) : <p className="text-xs text-slate-400 italic px-1">目前還沒有任何標籤...</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* 熱門標籤區塊 */}
              {hotTags.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  <span className="text-[10px] font-black text-slate-300 uppercase self-center tracking-widest mr-1">熱門標籤</span>
                  {hotTags.map(tag => (
                    <button 
                      key={`hot-${tag}`} 
                      onClick={() => setSearchQuery('#' + tag)}
                      className="px-3 py-1 bg-[#E67E22]/10 text-[11px] font-black text-[#8B5E3C] rounded-lg hover:bg-orange-100 transition-all border border-orange-100/50"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              {searchHistory.length > 0 && searchQuery.length === 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                   <span className="text-[10px] font-black text-slate-300 uppercase self-center tracking-widest mr-1">最近搜尋</span>
                   {searchHistory.map(h => (
                     <button 
                       key={h} 
                       onClick={() => setSearchQuery(h)}
                       className="px-3 py-1 bg-slate-50 text-[11px] font-bold text-slate-400 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-all border border-slate-100"
                     >
                       {h}
                     </button>
                   ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-orange-100/30">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">分類篩選</span>
                  {['⏳ 待嘗試', '全部', ...categories.map(c => c.name)].map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-[#E67E22] text-white shadow-md' : 'bg-white text-orange-400 border border-orange-100 hover:border-orange-300'}`}>{cat}</button>
                  ))}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">排序</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-white border border-orange-100 rounded-lg px-2 py-1 text-xs font-bold text-orange-600 outline-none focus:border-orange-300"
                    >
                      <option value="createdAt">建立日期</option>
                      <option value="updatedAt">最後修改</option>
                      <option value="category">分類</option>
                      <option value="title">標題</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1 px-2 bg-white border border-orange-100 rounded-lg text-[10px] font-black text-orange-400 hover:bg-orange-50"
                  >
                    {sortOrder === 'desc' ? '遞減 ↓' : '遞增 ↑'}
                  </button>
                </div>
              </div>
            </div>
          </header>
        )}

        <main>
          {view === AppView.LIST && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in no-print">
              {!isRecipesLoading ? (
                <>
                  {filteredRecipes.map(recipe => (
                    <RecipeCard key={recipe.id} recipe={recipe} onClick={(r) => { setSelectedRecipe(r); setView(AppView.DETAIL); }} />
                  ))}
                  {filteredRecipes.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-orange-100 flex flex-col items-center gap-4">
                      <div className="text-4xl">🔍</div>
                      <div className="space-y-1">
                        <p className="text-orange-400 font-bold">找不到相關食譜，要不要換個關鍵字試試？</p>
                        <p className="text-slate-300 text-xs text-center">可以嘗試搜尋具體的材料，如「奶油」、「法國麵粉」等</p>
                      </div>
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="mt-2 text-xs font-black text-white bg-[#E67E22] px-6 py-2 rounded-xl shadow-md active:scale-95"
                        >
                          回全部食譜
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="col-span-full py-20 text-center text-orange-300 font-bold bg-white rounded-[32px] border border-dashed border-orange-100 flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                  正在從雲端同步您的筆記...
                </div>
              )}
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
                      setReverseScalingBase(null);
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
                            <input 
                              type="number" 
                              step="0.1" 
                              value={targetQuantity.toFixed(1).replace(/\.0$/, '')} 
                              onChange={(e) => {
                                setTargetQuantity(Math.max(0.1, parseFloat(e.target.value) || 1));
                                setReverseScalingBase(null);
                              }} 
                              className="w-full p-5 bg-orange-50 border-2 border-orange-200 rounded-2xl text-3xl font-black text-orange-600 text-center outline-none focus:border-orange-400 transition-all pr-12" 
                            />
                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-400 pointer-events-none">份</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`bg-orange-50/20 rounded-[40px] border border-orange-100 overflow-hidden transition-all duration-500 ease-in-out ${(['餡料', '果醬', '抹醬/其他'].includes(scalingRecipe?.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2000px] opacity-100'}`}>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!isPremiumUser) {
                            triggerUpgradePrompt(true);
                            return;
                          }
                          setIsMoldPanelOpen(!isMoldPanelOpen);
                        }}
                        className={`w-full px-6 py-5 flex items-center justify-between ${isPremiumUser ? 'bg-orange-100/30 hover:bg-orange-100/50' : 'bg-[#F5E6D3]/50'} transition-colors text-left`}
                      >
                        <span className={`text-lg font-black ${isPremiumUser ? 'text-orange-700' : 'text-[#8B5E3C]'}`}>3. 模具體積換算 (跨形狀互換工具) {!isPremiumUser && '(VIP)'}</span>
                        <span className={`text-orange-400 transition-transform duration-300 ${isMoldPanelOpen ? 'rotate-180' : ''}`}>▼</span>
                      </button>


                      <div className={`transition-all duration-500 ease-in-out ${isMoldPanelOpen ? 'max-h-[2000px] opacity-100 py-8 px-4 sm:p-8' : 'max-h-0 opacity-0 py-0 px-4 overflow-hidden'}`}>
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-5">
                              <div className="flex flex-col gap-3 px-1">
                                 <span className="text-sm sm:text-base font-black text-slate-500 uppercase tracking-widest">原本食譜模具</span>
                                 <select 
                                    onChange={(e) => {
                                      handleApplyMoldPreset('source', e.target.value);
                                      setReverseScalingBase(null);
                                    }} 
                                    className="w-full px-4 py-3 bg-white border border-orange-100 rounded-xl text-sm font-bold outline-none"
                                  >
                                    {MOLD_PRESETS.map(p => <option key={`src-preset-${p.name}`} value={p.name}>{p.name}</option>)}
                                 </select>
                                 <div className="flex bg-white rounded-xl p-1.5 border border-orange-100 shadow-sm mt-1">
                                    <button type="button" onClick={() => { setSourceMold(p => ({...p, type: 'circular'})); setReverseScalingBase(null); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                    <button type="button" onClick={() => { setSourceMold(p => ({...p, type: 'rectangular'})); setReverseScalingBase(null); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${sourceMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
                                 </div>
                              </div>
                              <div className="bg-white p-6 rounded-3xl border border-orange-50 space-y-4 shadow-sm">
                                {sourceMold.type === 'circular' ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-slate-400 w-12">直徑</span>
                                    <div className="relative flex-1">
                                      <input type="number" value={sourceMold.diameter || ''} onChange={e => { setSourceMold(p => ({...p, diameter: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">長度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={sourceMold.length || ''} onChange={e => { setSourceMold(p => ({...p, length: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">寬度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={sourceMold.width || ''} onChange={e => { setSourceMold(p => ({...p, width: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                                  <span className="text-base font-bold text-slate-400 w-12">高度</span>
                                  <div className="relative flex-1">
                                    <input type="number" value={sourceMold.height || ''} onChange={e => { setSourceMold(p => ({...p, height: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-slate-50 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 pointer-events-none">cm</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-5">
                              <div className="flex flex-col gap-3 px-1">
                                 <span className="text-sm sm:text-base font-black text-[#E67E22] uppercase tracking-widest">我要用的模具</span>
                                 <select 
                                    onChange={(e) => {
                                      handleApplyMoldPreset('target', e.target.value);
                                      setReverseScalingBase(null);
                                    }} 
                                    className="w-full px-4 py-3 bg-white border border-orange-100 rounded-xl text-sm font-bold outline-none"
                                  >
                                    {MOLD_PRESETS.map(p => <option key={`tgt-preset-${p.name}`} value={p.name}>{p.name}</option>)}
                                 </select>
                                 <div className="flex bg-white rounded-xl p-1.5 border border-orange-100 shadow-sm mt-1">
                                    <button type="button" onClick={() => { setTargetMold(p => ({...p, type: 'circular'})); setReverseScalingBase(null); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'circular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🔘 圓形</button>
                                    <button type="button" onClick={() => { setTargetMold(p => ({...p, type: 'rectangular'})); setReverseScalingBase(null); }} className={`flex-1 px-3 py-2 rounded-lg text-xs font-black transition-all ${targetMold.type === 'rectangular' ? 'bg-orange-500 text-white' : 'text-orange-400 hover:bg-orange-50'}`}>🟦 方形</button>
                                 </div>
                              </div>
                              <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-md">
                                {targetMold.type === 'circular' ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-base font-bold text-slate-400 w-12">直徑</span>
                                    <div className="relative flex-1">
                                      <input type="number" value={targetMold.diameter || ''} onChange={e => { setTargetMold(p => ({...p, diameter: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">長度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={targetMold.length || ''} onChange={e => { setTargetMold(p => ({...p, length: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-base font-bold text-slate-400 w-12">寬度</span>
                                      <div className="relative flex-1">
                                        <input type="number" value={targetMold.width || ''} onChange={e => { setTargetMold(p => ({...p, width: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-300 pointer-events-none">cm</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-3 border-t border-orange-50 pt-3">
                                  <span className="text-base font-bold text-slate-400 w-12">高度</span>
                                  <div className="relative flex-1">
                                    <input type="number" value={targetMold.height || ''} onChange={e => { setTargetMold(p => ({...p, height: parseFloat(e.target.value) || 0})); setReverseScalingBase(null); }} className="w-full text-xl font-black bg-orange-50/30 rounded-xl px-3 py-2.5 outline-none text-slate-700 text-center pr-10" placeholder="0" />
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

                  {/* 換算後摘要資訊 */}
                  <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm flex flex-wrap gap-y-6 items-center justify-around text-center mb-8">
                    {(() => {
                      const items = [];
                      if (scalingRecipe.category === '中式點心') {
                        if (scalingRecipe.crustWeight && Number(scalingRecipe.crustWeight) > 0) {
                          items.push(
                            <div key="crust_scale" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">⚖️ 分割後一個<br/>油皮重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {Number(scalingRecipe.crustWeight).toFixed(1).replace(/\.0$/, '')}
                                <span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        if (scalingRecipe.oilPasteWeight && Number(scalingRecipe.oilPasteWeight) > 0) {
                          items.push(
                            <div key="oilPaste_scale" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🧈 分割後一個<br/>油酥重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {Number(scalingRecipe.oilPasteWeight).toFixed(1).replace(/\.0$/, '')}
                                <span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        if (scalingRecipe.fillingWeight && Number(scalingRecipe.fillingWeight) > 0) {
                          items.push(
                            <div key="filling_pastry_scale" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🌰 分割後一個<br/>餡料重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {Number(scalingRecipe.fillingWeight).toFixed(1).replace(/\.0$/, '')}
                                <span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        items.push(
                          <div key="quantity_pastry_scale" className="flex-1 min-w-[80px] space-y-1.5">
                            <div className="text-xs font-black text-slate-400 uppercase">🔢 份數</div>
                            <div className="text-2xl font-black text-slate-700 tabular-nums">
                              {targetQuantity.toFixed(1).replace(/\.0$/, '')}
                              <span className="text-sm font-bold text-slate-400 ml-0.5">顆</span>
                            </div>
                          </div>
                        );
                      } else {
                        if (scalingRecipe.doughWeight && Number(scalingRecipe.doughWeight) > 0) {
                          items.push(
                            <div key="dough_scale" className="flex-1 min-w-[140px] sm:min-w-[170px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">⚖️ 分割後一個<br/>麵團/糊重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {Number(scalingRecipe.doughWeight).toFixed(1).replace(/\.0$/, '')}
                                <span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        if (scalingRecipe.fillingWeight && Number(scalingRecipe.fillingWeight) > 0) {
                          items.push(
                            <div key="filling_gen_scale" className="flex-1 min-w-[140px] sm:min-w-[170px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🌰 分割後一個<br/>內餡重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {Number(scalingRecipe.fillingWeight).toFixed(1).replace(/\.0$/, '')}
                                <span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        items.push(
                          <div key="quantity_gen_scale" className="flex-1 min-w-[100px] space-y-1.5">
                            <div className="text-xs font-black text-slate-400 uppercase">🔢 製作份數</div>
                            <div className="text-2xl font-black text-slate-700 tabular-nums">
                              {targetQuantity.toFixed(1).replace(/\.0$/, '')}
                              <span className="text-sm font-bold text-slate-400 ml-0.5">份</span>
                            </div>
                          </div>
                        );
                      }

                      return items.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {item}
                          {idx < items.length - 1 && (
                            <div className="w-px h-10 bg-orange-50 hidden sm:block" />
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 mb-8 print:hidden">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-black text-slate-800">換算結果清單</h3>
                      <span className="text-xs font-bold text-orange-400">
                        💡 提示：直接修改材料重量可進行「逆算」
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
                      <span className="text-sm sm:text-sm font-black text-orange-500 bg-orange-50 px-6 py-2.5 rounded-full border border-orange-100 shadow-sm">目前總倍率: {scalingFactor.toFixed(2)}x</span>
                      <button 
                        onClick={() => {
                          if (!isPremiumUser) {
                            triggerUpgradePrompt(true);
                            return;
                          }
                          window.print();
                        }} 
                        className="w-auto px-6 py-3 bg-orange-500 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-orange-600 transition-all flex items-center gap-2 active:scale-95"
                      >
                        <span className="text-xl">🖨️</span>
                        <span>列印 / 存為 PDF {!isPremiumUser && '(VIP)'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-orange-50/20 px-4 py-8 sm:p-8 rounded-[40px] border border-orange-50 print:bg-white print:border-none print:p-0 max-w-3xl mx-auto">
                    {scalingRecipe.sectionsOrder?.map(secKey => {
                       const sectionIngredients = 
                         secKey === 'ingredients' ? scalingRecipe.ingredients :
                         secKey === 'liquidStarterIngredients' ? scalingRecipe.liquidStarterIngredients :
                         secKey === 'fillingIngredients' ? scalingRecipe.fillingIngredients :
                         secKey === 'decorationIngredients' ? scalingRecipe.decorationIngredients :
                         secKey === 'customSectionIngredients' ? scalingRecipe.customSectionIngredients : [];
                       
                       const sectionTitle = 
                         secKey === 'ingredients' ? (scalingRecipe.mainSectionName || "主麵團") :
                         secKey === 'liquidStarterIngredients' ? (scalingRecipe.liquidStarterName || "發酵種") :
                         secKey === 'fillingIngredients' ? (scalingRecipe.fillingSectionName || "內餡") :
                         secKey === 'decorationIngredients' ? (scalingRecipe.decorationSectionName || "裝飾 / 表面") :
                         secKey === 'customSectionIngredients' ? (scalingRecipe.customSectionName || "其他區塊") : "";

                       return (
                         <DisplayIngredientSection 
                           key={secKey} 
                           ingredients={sectionIngredients || []} 
                           title={sectionTitle} 
                           isBaking={scalingRecipe.isBakingRecipe} 
                           showPercentage={true} 
                           scalingFactor={scalingFactor}
                           onReverseScale={isPremiumUser ? (idx, newAmt) => handleReverseScale(secKey, idx, newAmt) : undefined}
                           baseIngredientIndex={reverseScalingBase?.sectionKey === secKey ? reverseScalingBase.index : null}
                         />
                       );
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
                {/* 0. 圖片預留位 (優先顯示) */}
                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="block text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <ImageIcon size={16} /> 📸作品照片展示區
                  </label>
                  <div className="aspect-video bg-orange-50/20 rounded-3xl border-2 border-dashed border-orange-100 flex items-center justify-center overflow-hidden relative group transition-all hover:bg-orange-50/40">
                    {formRecipe.imageUrl ? (
                      <>
                        <img src={formRecipe.imageUrl} className="w-full h-full object-cover" alt="預覽" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <button onClick={() => recipeImageInputRef.current?.click()} className="p-3 bg-white/90 rounded-full text-orange-600 hover:bg-white transition-all transform hover:scale-110"><Camera size={24} /></button>
                          <button onClick={() => setFormRecipe(prev => ({ ...prev, imageUrl: '' }))} className="p-3 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-all transform hover:scale-110"><Trash2 size={24} /></button>
                        </div>
                      </>
                    ) : (
                      <button onClick={() => recipeImageInputRef.current?.click()} className="flex flex-col items-center gap-3 text-orange-300 hover:text-orange-500 transition-all">
                        <Camera size={48} strokeWidth={1.5} />
                        <span className="text-sm font-black">點擊上傳成品美照</span>
                      </button>
                    )}
                  </div>
                  <input type="file" ref={recipeImageInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>

                {/* 1. 快速解析貼上 (Smart Paste) & 草稿還原 */}
                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2">
                       ✨ AI 快速筆記助手
                      {subscriptionStatus !== 'active' && !isAdmin && (
                        <span className="bg-orange-100 text-[#E67E22] px-2 py-0.5 rounded-lg text-[10px] border border-orange-200">Premium</span>
                      )}
                    </label>
                    <button onClick={restoreDraft} className="text-[10px] font-black bg-orange-50 text-orange-600 px-3 py-1.5 rounded-xl border border-orange-100 hover:bg-orange-100 transition-all active:scale-95">🕒 還原最近草稿</button>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={smartPasteText}
                      onChange={(e) => setSmartPasteText(e.target.value)}
                      placeholder="貼上亂糟糟的筆記（例如 Line 訊息、網頁複製內容）..."
                      className="w-full h-32 px-4 py-4 bg-slate-50 border border-orange-100 rounded-2xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all leading-relaxed"
                    />
                    <button 
                      onClick={handleSmartPaste}
                      disabled={isAiParsing || !smartPasteText.trim()}
                      className={`absolute bottom-4 right-4 px-6 py-2.5 rounded-xl font-black text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 ${(isAiParsing || !smartPasteText.trim()) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#E67E22] text-white hover:bg-orange-600'}`}
                    >
                      {isAiParsing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>正在解析中...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀 AI 即刻解析</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold ml-1">💡 貼入內容後點擊解析，AI 將自動填充材料、重量與步驟。</p>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm space-y-6">
                  {/* 第一排：配方名稱、師傅 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">📖 配方名稱</label>
                      <textarea 
                        value={formRecipe.title || ''} 
                        onChange={(e) => {
                          setFormRecipe(p => ({ ...p, title: e.target.value }));
                          // Auto-resize
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }} 
                        onFocus={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        rows={1}
                        className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm font-bold focus:border-orange-200 transition-all resize-none overflow-hidden" 
                        placeholder="輸入食譜標題 (支援換行)" 
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">👨‍🍳 師傅 / 來源</label>
                      <input type="text" value={formRecipe.master || ''} onChange={e => setFormRecipe(p => ({ ...p, master: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm font-bold focus:border-orange-200 transition-all" placeholder="作者或出處" />
                    </div>
                  </div>

            {/* 第二排：分類下拉選單 與 保存期限 與 總時長 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="w-full">
                <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">📂 分類</label>
                <select value={formRecipe.category || ''} onChange={e => setFormRecipe(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm font-bold focus:border-orange-200 transition-all">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="w-full">
                <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🕒 保存期限</label>
                <input type="text" value={formRecipe.shelfLife || ''} onChange={e => setFormRecipe(p => ({ ...p, shelfLife: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm font-bold focus:border-orange-200 transition-all" placeholder="例如：常溫 2 天" />
              </div>
              <div className="w-full">
                <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">⏲️ 總時長</label>
                <input type="text" value={formRecipe.totalDuration || ''} onChange={e => setFormRecipe(p => ({ ...p, totalDuration: e.target.value }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-sm font-bold focus:border-orange-200 transition-all" placeholder="例如：45 分鐘、3 小時" />
              </div>
            </div>

                  {/* 第三排：⚖️ 麵團/糊 (g)、🌰 內餡 (g)、🔢 製作份數 */}
                  <div className="space-y-6">
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${(['餡料', '果醬', '抹醬/其他'].includes(formRecipe.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[500px] opacity-100'}`}>
                      {formRecipe.category === '中式點心' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="relative">
                            <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">⚖️ 分割後一個油皮重 (克)</label>
                            <input type="text" value={formRecipe.crustWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, crustWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🧈 分割後一個油酥重 (克)</label>
                            <input type="text" value={formRecipe.oilPasteWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, oilPasteWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🌰 分割後一個餡料重 (克)</label>
                            <input type="text" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="relative">
                            <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">⚖️ 分割後一個麵團/糊重 (克)</label>
                            <input type="text" value={formRecipe.doughWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, doughWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                          <div className="relative">
                            <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🌰 分割後一個內餡重 (克)</label>
                            <input type="text" value={formRecipe.fillingWeight ?? ''} onChange={e => setFormRecipe(p => ({ ...p, fillingWeight: e.target.value }))} placeholder="克數" className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold text-center" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🔢 製作份數</label>
                      <input type="number" value={formRecipe.quantity ?? ''} onChange={e => setFormRecipe(p => ({ ...p, quantity: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                  </div>


                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">老師分享日 📅</label>
                      <input type="date" value={formRecipe.sourceDate || ''} onChange={e => setFormRecipe(p => ({ ...p, sourceDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">記錄日期 📝</label>
                      <input type="date" value={formRecipe.recordDate || ''} onChange={e => setFormRecipe(p => ({ ...p, recordDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold" />
                    </div>
                  </div>

                  <div className={`transition-all duration-500 ease-in-out overflow-hidden ${(['餡料', '果醬', '抹醬/其他'].includes(formRecipe.category || '')) ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[200px] opacity-100'}`}>
                    <div className="w-full">
                      <label className="block text-sm font-black text-slate-600 uppercase mb-1.5 ml-1">🍞 模具規格/烤盤</label>
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
                  <div className="w-full">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 flex items-center gap-2">
                      <Tag size={12} /> 心得標籤 (分類標記)
                    </label>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {(formRecipe.tags || []).map((t, idx) => (
                        <span key={idx} className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 group border border-orange-100 shadow-sm animate-in zoom-in-95">
                          #{t}
                          <button onClick={() => setFormRecipe(prev => ({ ...prev, tags: prev.tags?.filter((_, i) => i !== idx) }))} className="hover:text-red-500 transition-colors bg-white/50 rounded-full w-4 h-4 flex items-center justify-center">✕</button>
                        </span>
                      ))}
                    </div>
                    <input 
                      type="text" 
                      value={tagInput}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      onChange={e => handleTagsInputChange(e.target.value)} 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !isComposing) {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      className="w-full px-4 py-4 rounded-2xl bg-orange-50/30 border border-orange-100 outline-none text-base font-bold focus:bg-white focus:border-orange-200 transition-all placeholder:text-slate-300" 
                      placeholder="輸入標籤後按 Enter 或逗號分隔..." 
                    />
                  </div>
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
                      if (sec === 'ingredients') return <IngredientList key={sec} items={formRecipe.ingredients || []} title="主麵團" fieldKey="ingredients" customTitleKey="mainSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} lastUsedUnit={lastUsedUnit} setLastUsedUnit={setLastUsedUnit} />;
                      if (sec === 'liquidStarterIngredients') return <IngredientList key={sec} items={formRecipe.liquidStarterIngredients || []} title="發酵種" fieldKey="liquidStarterIngredients" customTitleKey="liquidStarterName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} lastUsedUnit={lastUsedUnit} setLastUsedUnit={setLastUsedUnit} />;
                      if (sec === 'fillingIngredients') return <IngredientList key={sec} items={formRecipe.fillingIngredients || []} title="內餡" fieldKey="fillingIngredients" customTitleKey="fillingSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} lastUsedUnit={lastUsedUnit} setLastUsedUnit={setLastUsedUnit} />;
                      if (sec === 'decorationIngredients') return <IngredientList key={sec} items={formRecipe.decorationIngredients || []} title="裝飾" fieldKey="decorationIngredients" customTitleKey="decorationSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} lastUsedUnit={lastUsedUnit} setLastUsedUnit={setLastUsedUnit} />;
                      if (sec === 'customSectionIngredients') return <IngredientList key={sec} items={formRecipe.customSectionIngredients || []} title="其他區塊" fieldKey="customSectionIngredients" customTitleKey="customSectionName" onMoveSection={onMove} sectionIndex={idx} totalSections={currentOrder.length} formRecipe={formRecipe} setFormRecipe={setFormRecipe} handleUpdateIngredient={handleUpdateIngredient} moveIngredient={moveIngredient} triggerConfirm={triggerConfirm} lastUsedUnit={lastUsedUnit} setLastUsedUnit={setLastUsedUnit} />;
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
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest ml-1">食譜簡介 (列表顯示)</label>
                  <textarea value={formRecipe.description || ''} onChange={(e) => setFormRecipe(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold min-h-[120px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all placeholder:text-slate-300" placeholder="簡單介紹這份配方的特色..." />
                </div>
                <div className="p-6 bg-white rounded-[32px] border border-orange-50 shadow-sm space-y-4">
                  <label className="text-xs font-black text-orange-600 uppercase tracking-widest ml-1">📝 老師的小叮嚀</label>
                  <textarea value={formRecipe.notes || ''} onChange={(e) => setFormRecipe(p => ({ ...p, notes: e.target.value }))} className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold min-h-[180px] focus:bg-white focus:ring-1 focus:ring-orange-200 transition-all leading-relaxed placeholder:text-slate-300" placeholder="紀錄製作時的心得、建議改進之處..." />
                </div>
                <div id="save-recipe-btn" className="pt-6">
                  <button 
                    onClick={async () => { 
                      if (!formRecipe.title) return; 

                      const recipeData = {
                        ...formRecipe,
                        uid: user?.uid || null,
                        author_id: user?.uid || null,
                        updatedAt: Date.now()
                      };

                      if (view === AppView.CREATE) {
                        // 檢查食譜數量限制 (非 Premium 用戶上限 10 份)
                        if (!isPremiumUser && recipes.length >= 10) {
                          triggerUpgradePrompt(true, "您的食譜已達免費版上限 (10份)，升級 Premium 即可儲存更多美味配方！");
                          return;
                        }

                        const newId = 'rec-' + Date.now();
                        const newRecipe = { ...recipeData, id: newId, createdAt: Date.now(), uid: user?.uid, author_id: user?.uid } as Recipe;
                        
                        if (user && isCloudSyncEnabled) {
                          try {
                            await setDoc(doc(db, 'recipes', newId), newRecipe);
                          } catch (error) {
                            console.error("Error creating recipe:", error);
                            showToast("雲端儲存失敗");
                            return;
                          }
                        } else {
                          // 本地模式：直接更新狀態（會在 useEffect 中存入 localStorage）
                          setRecipes(prev => [newRecipe, ...prev]);
                        }
                      } else {
                        const updatedRecipe = recipeData as Recipe;
                        if (user && isCloudSyncEnabled) {
                          try {
                            await setDoc(doc(db, 'recipes', updatedRecipe.id), updatedRecipe);
                          } catch (error) {
                            console.error("Error updating recipe:", error);
                            showToast("雲端更新失敗");
                            return;
                          }
                        } else {
                          // 本地模式
                          setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
                        }
                      }
                      
                      showToast("食譜儲存成功！");
                      setView(AppView.LIST);
                    }} 
                    className="w-full py-4 bg-[#E67E22] text-white rounded-3xl font-black text-lg shadow-lg active:scale-95"
                  >
                    儲存配方
                  </button>
                </div>
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
              className="fixed bottom-28 right-6 w-14 h-14 bg-[#E67E22] text-white rounded-full shadow-[0_8px_30px_rgb(230,126,34,0.4)] flex items-center justify-center z-[1001] animate-in fade-in slide-in-from-bottom-4 transition-all active:scale-90 hover:bg-orange-600 group overflow-hidden print:hidden"
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
                <input type="text" value={newCatName || ''} onChange={(e) => setNewCatName(e.target.value)} className="flex-grow px-4 py-3 rounded-2xl bg-orange-50/30 border border-orange-50 outline-none text-sm focus:border-orange-200 transition-all" placeholder="增加新分類，例如：甜點、抹醬..." />
                <button 
                  onClick={() => { 
                    if(!newCatName.trim()) return; 
                    if(categories.find(c => c.name === newCatName.trim())) {
                      showToast("分類名稱已存在");
                      return;
                    }
                    const newId = 'cat-' + Date.now();
                    const updatedCats = [...categories, { id: newId, name: newCatName.trim(), order: categories.length }];
                    setCategories(updatedCats); 
                    syncCategoriesToCloud(updatedCats);
                    setNewCatName(''); 
                    showToast("分類新增成功！"); 
                  }} 
                  className="bg-[#E67E22] text-white px-6 py-2 rounded-2xl font-black text-sm shadow-md active:scale-95"
                >
                  新增
                </button>
              </div>
              <div className="space-y-4">
                {categories.map((cat, idx) => {
                  const recipeCount = recipes.filter(r => r.category === cat.name).length;
                  const isEditing = editingCatId === cat.id;

                  return (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-orange-50/20 rounded-2xl border border-orange-100 shadow-sm transition-all hover:bg-orange-50/40">
                      <div className="flex items-center gap-3 flex-grow pr-4">
                        <span className="text-[10px] font-black text-orange-300 w-4">#{idx + 1}</span>
                        {isEditing ? (
                          <input 
                            autoFocus
                            type="text"
                            value={editingCatValue}
                            onChange={(e) => setEditingCatValue(e.target.value)}
                            onBlur={() => renameCategory(cat.name, editingCatValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameCategory(cat.name, editingCatValue);
                              if (e.key === 'Escape') setEditingCatId(null);
                            }}
                            className="flex-grow px-2 py-1 bg-white border border-orange-300 rounded-lg text-sm font-bold outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="font-black text-slate-700 text-sm">{cat.name}</span>
                            <span className="text-[10px] font-bold text-slate-400">({recipeCount})</span>
                            <button 
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatValue(cat.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-orange-500 transition-all"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => { 
                              const nc = [...categories]; 
                              [nc[idx], nc[idx-1]] = [nc[idx-1], nc[idx]]; 
                              const updatedCats = nc.map((c,i)=>({...c,order:i}));
                              setCategories(updatedCats); 
                              syncCategoriesToCloud(updatedCats);
                            }} 
                            disabled={idx === 0} 
                            className="p-1 px-2 text-[#E67E22] disabled:opacity-10 hover:bg-white rounded-md transition-all font-black text-lg"
                            title="上移"
                          >
                            ▲
                          </button>
                          <button 
                            onClick={() => { 
                              const nc = [...categories]; 
                              [nc[idx], nc[idx+1]] = [nc[idx+1], nc[idx]]; 
                              const updatedCats = nc.map((c,i)=>({...c,order:i}));
                              setCategories(updatedCats); 
                              syncCategoriesToCloud(updatedCats);
                            }} 
                            disabled={idx === categories.length-1} 
                            className="p-1 px-2 text-[#E67E22] disabled:opacity-10 hover:bg-white rounded-md transition-all font-black text-lg"
                            title="下移"
                          >
                            ▼
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            const hasRecipes = recipes.some(r => r.category === cat.name);
                            const confirmMsg = hasRecipes ? `「${cat.name}」分類下還有 ${recipeCount} 份食譜，確定要刪除嗎？` : null;
                            triggerConfirm(() => {
                              const updatedCats = categories.filter(c => c.id !== cat.id);
                              setCategories(updatedCats);
                              syncCategoriesToCloud(updatedCats);
                              showToast(`分類「${cat.name}」已刪除`);
                            }, confirmMsg);
                          }}
                          className="p-2 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button 
                onClick={() => setView(AppView.CREATE)} 
                className="w-full mt-10 py-4 bg-orange-50 text-orange-600 rounded-3xl font-black text-sm border border-orange-100 hover:bg-orange-100 transition-all active:scale-95"
              >
                返回建立頁面
              </button>
            </div>
          )}

          {view === AppView.DETAIL && selectedRecipe && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 print-area">
              {/* 頂部併排對稱排版：左文字右圖片 */}
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-stretch no-print">
                {/* 左側：配方標題與標籤 */}
                <div className="flex-1 flex flex-col justify-center space-y-4 py-4 sm:py-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-orange-100 shadow-sm">
                      {selectedRecipe.category}
                    </span>
                    {selectedRecipe.isTried && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-600 text-[10px] font-extrabold rounded-full uppercase tracking-widest border border-orange-200 shadow-sm">
                        待嘗試
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-800 leading-tight whitespace-pre-wrap">
                    {selectedRecipe.title}
                  </h2>

                  {selectedRecipe.description && (
                    <p className="text-base text-slate-500 font-medium leading-relaxed italic border-l-4 border-orange-100 pl-4 py-1">
                      {selectedRecipe.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedRecipe.tags && selectedRecipe.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold border border-slate-100">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-400 border border-orange-100">
                        <UserIcon size={14} />
                      </div>
                      <p className="text-sm font-black text-slate-600">
                        師傅：{selectedRecipe.master}
                      </p>
                    </div>
                    {(selectedRecipe.shelfLife || selectedRecipe.totalDuration) && (
                      <div className="flex flex-wrap gap-4 pt-1">
                        {selectedRecipe.shelfLife && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <span>🕒 保鮮：{selectedRecipe.shelfLife}</span>
                          </div>
                        )}
                        {selectedRecipe.totalDuration && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <span>⏱️ 總時：{formatTimeWithUnit(selectedRecipe.totalDuration)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右側：配方圖片 */}
                <div className="flex-1 min-h-[300px] sm:min-h-0">
                  <div className="relative h-full w-full aspect-video sm:aspect-square rounded-[32px] sm:rounded-[48px] overflow-hidden shadow-2xl border-4 border-white/50 group">
                    <img src={selectedRecipe.imageUrl || 'https://picsum.photos/800/800?random=' + selectedRecipe.id} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={selectedRecipe.title} />
                  </div>
                </div>
              </div>

              {/* PDF 專用區塊 (螢幕上顯示為 no-print，但在列印時會顯示這個原本的佈局) */}
              <div className="hidden print:block space-y-4">
                <div className="relative aspect-video rounded-2xl overflow-hidden print-float-img">
                  <img src={selectedRecipe.imageUrl || 'https://picsum.photos/800/450?random=' + selectedRecipe.id} className="w-full h-full object-cover" alt={selectedRecipe.title} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 leading-tight mb-2 whitespace-pre-wrap">{selectedRecipe.title}</h2>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-base font-bold text-slate-500 print:text-[16px] print:text-slate-700 print:gap-x-12">
                    <span className="print:font-black">分類：{selectedRecipe.category}</span>
                    <span className="print:font-black">師傅：{selectedRecipe.master}</span>
                    {selectedRecipe.shelfLife && <span className="print:font-black">保鮮：{selectedRecipe.shelfLife}</span>}
                    {selectedRecipe.totalDuration && <span className="print:font-black">總時：{formatTimeWithUnit(selectedRecipe.totalDuration)}</span>}
                  </div>
                </div>
              </div>

              {/* 規格卡片區塊：在觀看模式最上方顯示 (在 PDF 中隱藏) */}
              {(selectedRecipe.doughWeight || selectedRecipe.fillingWeight || selectedRecipe.crustWeight || selectedRecipe.oilPasteWeight || selectedRecipe.moldName) && (
                <div className="space-y-4 print:hidden">
                  <div className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm flex flex-wrap gap-y-6 items-center justify-around text-center">
                    {(() => {
                      const weightItems = [];

                      if (selectedRecipe.category === '中式點心') {
                        // 中式點心模式的欄位
                        if (selectedRecipe.crustWeight && Number(selectedRecipe.crustWeight) > 0) {
                          weightItems.push(
                            <div key="crust" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">⚖️ 分割後一個<br/>油皮重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">{selectedRecipe.crustWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div>
                            </div>
                          );
                        }
                        if (selectedRecipe.oilPasteWeight && Number(selectedRecipe.oilPasteWeight) > 0) {
                          weightItems.push(
                            <div key="oilPaste" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🧈 分割後一個<br/>油酥重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">{selectedRecipe.oilPasteWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div>
                            </div>
                          );
                        }
                        if (selectedRecipe.fillingWeight && Number(selectedRecipe.fillingWeight) > 0) {
                          weightItems.push(
                            <div key="filling_pastry" className="flex-1 min-w-[140px] sm:min-w-[160px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🌰 分割後一個<br/>餡料重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">{selectedRecipe.fillingWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span></div>
                            </div>
                          );
                        }
                        // 份數 (通常會有值)
                        weightItems.push(
                          <div key="quantity_pastry" className="flex-1 min-w-[80px] space-y-1.5">
                            <div className="text-xs font-black text-slate-400 uppercase">🔢 份數</div>
                            <div className="text-2xl font-black text-slate-700 tabular-nums">{selectedRecipe.quantity || 1}<span className="text-sm font-bold text-slate-400 ml-0.5">顆</span></div>
                          </div>
                        );
                      } else {
                        // 一般模式的欄位
                        if (selectedRecipe.doughWeight && Number(selectedRecipe.doughWeight) > 0) {
                          weightItems.push(
                            <div key="dough" className="flex-1 min-w-[140px] sm:min-w-[170px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">⚖️ 分割後一個<br/>麵團/糊重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {selectedRecipe.doughWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        if (selectedRecipe.fillingWeight && Number(selectedRecipe.fillingWeight) > 0) {
                          weightItems.push(
                            <div key="filling_gen" className="flex-1 min-w-[140px] sm:min-w-[170px] space-y-2">
                              <div className="text-xs sm:text-sm font-black text-slate-400 uppercase leading-tight">🌰 分割後一個<br/>內餡重 (克)</div>
                              <div className="text-2xl sm:text-3xl font-black text-slate-700 tabular-nums">
                                {selectedRecipe.fillingWeight}<span className="text-sm font-bold text-slate-400 ml-0.5">g</span>
                              </div>
                            </div>
                          );
                        }
                        // 製作份數
                        weightItems.push(
                          <div key="quantity_gen" className="flex-1 min-w-[100px] space-y-1.5">
                            <div className="text-xs font-black text-slate-400 uppercase">🔢 製作份數</div>
                            <div className="text-2xl font-black text-slate-700 tabular-nums">
                              {selectedRecipe.quantity || 1}<span className="text-sm font-bold text-slate-400 ml-0.5">份</span>
                            </div>
                          </div>
                        );
                      }

                      // 渲染包含分隔線的結果
                      return weightItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {item}
                          {idx < weightItems.length - 1 && (
                            <div className="w-px h-10 bg-orange-50 hidden sm:block" />
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                  {selectedRecipe.moldName && (
                    <div className="bg-white px-6 py-4 rounded-[32px] border border-orange-50 shadow-sm flex items-center justify-center gap-3">
                      <span className="text-xl">🍞</span>
                      <span className="text-xs font-black text-slate-400 uppercase">模具規格</span>
                      <div className="text-base font-black text-slate-700">{selectedRecipe.moldName}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {/* PDF 專用：大型橫向規格資訊列 */}
                {(selectedRecipe.doughWeight || selectedRecipe.fillingWeight || selectedRecipe.crustWeight || selectedRecipe.oilPasteWeight || selectedRecipe.moldName) && (
                  <div className="hidden print:flex items-center justify-around bg-orange-50/20 border border-orange-100 p-4 rounded-2xl gap-4 my-4">
                    {(() => {
                      const pdfSpecs = [];
                      if (selectedRecipe.category === '中式點心') {
                        if (selectedRecipe.crustWeight && Number(selectedRecipe.crustWeight) > 0) pdfSpecs.push(<div key="cr" className="flex items-center gap-2 text-base font-black text-slate-800">⚖️ 油皮：{selectedRecipe.crustWeight}g</div>);
                        if (selectedRecipe.oilPasteWeight && Number(selectedRecipe.oilPasteWeight) > 0) pdfSpecs.push(<div key="op" className="flex items-center gap-2 text-base font-black text-slate-800">🧈 油酥：{selectedRecipe.oilPasteWeight}g</div>);
                        if (selectedRecipe.fillingWeight && Number(selectedRecipe.fillingWeight) > 0) pdfSpecs.push(<div key="fi" className="flex items-center gap-2 text-base font-black text-slate-800">🌰 內餡：{selectedRecipe.fillingWeight}g</div>);
                        pdfSpecs.push(<div key="qt" className="flex items-center gap-2 text-base font-black text-slate-800">🔢 份數：{selectedRecipe.quantity || 1}顆</div>);
                      } else {
                        if (selectedRecipe.doughWeight && Number(selectedRecipe.doughWeight) > 0) pdfSpecs.push(<div key="dw" className="flex items-center gap-2 text-base font-black text-slate-800">⚖️ 分割重量：{selectedRecipe.doughWeight}g</div>);
                        if (selectedRecipe.fillingWeight && Number(selectedRecipe.fillingWeight) > 0) pdfSpecs.push(<div key="fi" className="flex items-center gap-2 text-base font-black text-slate-800">🌰 內餡重量：{selectedRecipe.fillingWeight}g</div>);
                        pdfSpecs.push(<div key="qt" className="flex items-center gap-2 text-base font-black text-slate-800">🔢 製作份數：{selectedRecipe.quantity || 1}份</div>);
                      }
                      if (selectedRecipe.moldName) pdfSpecs.push(<div key="mn" className="flex items-center gap-2 text-base font-black text-slate-800">🍞 模具：{selectedRecipe.moldName}</div>);
                      
                      return pdfSpecs.map((spec, i) => (
                        <React.Fragment key={i}>
                          {spec}
                          {i < pdfSpecs.length - 1 && <div className="w-px h-6 bg-orange-200" />}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                )}

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
                            <span className="text-[10px] font-black text-slate-400 uppercase print:text-sm print:text-slate-500">出處網址</span>
                            <div className="overflow-x-auto scrollbar-hide print:overflow-visible print:break-all">
                              {selectedRecipe.sourceUrl.startsWith('http') ? (
                                <a href={selectedRecipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:underline whitespace-nowrap print:text-[16px] print:font-black print:whitespace-pre-wrap print:break-all print:block print:mt-1">
                                  {selectedRecipe.sourceUrl}
                                </a>
                              ) : (
                                <span className="text-sm font-bold text-slate-700 whitespace-nowrap print:text-[16px] print:font-black print:whitespace-pre-wrap print:break-all print:block print:mt-1">{selectedRecipe.sourceUrl}</span>
                              )}
                            </div>
                          </div>
                          {selectedRecipe.sourceUrl.startsWith('http') && (
                            <div className="shrink-0 ml-auto p-1 bg-white rounded-xl border border-orange-100/50 shadow-sm print:shadow-none">
                              <QRCodeCanvas 
                                value={selectedRecipe.sourceUrl} 
                                size={96} 
                                style={{ display: 'block' }} 
                                level="H"
                                includeMargin={true}
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {/* 動態連結清單 */}
                      {(selectedRecipe.sourceLinks || []).map((link, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-orange-50/30 rounded-2xl border border-orange-50 sm:col-span-2">
                          <span className="text-lg">🔗</span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase print:text-sm print:text-slate-500">參考連結</span>
                            <div className="overflow-x-auto scrollbar-hide print:overflow-visible print:break-all">
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:underline whitespace-nowrap print:text-[16px] print:font-black print:whitespace-pre-wrap print:break-all print:block print:mt-1">
                                {link.name || '點擊前往'}
                              </a>
                            </div>
                          </div>
                          {link.url && link.url.startsWith('http') && (
                            <div className="shrink-0 ml-auto p-1 bg-white rounded-xl border border-orange-100/50 shadow-sm print:shadow-none">
                              <QRCodeCanvas 
                                value={link.url} 
                                size={96} 
                                style={{ display: 'block' }} 
                                level="H"
                                includeMargin={true}
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                              />
                            </div>
                          )}
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
                            <span className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{selectedRecipe.sourceNote}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-12 print:gap-6">
                <div className="print:p-0">
                  <div className="flex items-center justify-between mb-8 px-2 print:mb-4">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 print:text-base">
                      <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                      食材配方
                    </h3>
                  </div>
                  <div className="space-y-6 max-w-3xl mx-auto print:space-y-0 print:flex print:flex-wrap print:gap-4">
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
                    <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-2 print:mb-2 max-w-3xl mx-auto w-full">
                      <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 px-2 print:text-base print:mb-4">
                        <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                        發酵與烤焙
                      </h3>
                      {hasFermentation && (
                        <div className="mb-10 print:mb-4">
                          <h4 className="text-base font-black text-orange-500 uppercase tracking-widest mb-4 ml-1 print:text-black print:mb-2 text-left">發酵時序</h4>
                          
                          {/* 列印專用表格 */}
                          <table className="hidden print:table print-table mb-4">
                            <thead>
                              <tr>
                                <th>階段名稱</th>
                                <th>時間</th>
                                <th>溫度</th>
                                <th>濕度</th>
                                <th>備註</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRecipe.fermentationStages?.map((stage, idx) => (
                                <tr key={idx}>
                                  <td>{stage.name || `階段 ${idx+1}`}</td>
                                  <td>{formatTimeWithUnit(stage.time, stage.timeUnit)}</td>
                                  <td>{stage.temperature ? `${stage.temperature}°C` : '--'}</td>
                                  <td>{stage.humidity ? `${stage.humidity}%` : '--'}</td>
                                  <td>{stage.note || '--'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* 螢幕顯示卡片 */}
                          <div className="space-y-4 print:hidden">
                            {selectedRecipe.fermentationStages?.map((stage, idx) => (
                              <div key={idx} className="flex flex-col p-6 bg-orange-50/20 rounded-3xl border border-orange-50 gap-y-2">
                                <div className="text-xl font-black text-slate-800 text-left mb-2 lg:mb-0">{stage.name || `階段 ${idx+1}`}</div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 text-lg lg:text-xl font-black text-[#E67E22] tabular-nums border-t border-orange-100/50 pt-5">
                                  <div className="flex flex-col items-center gap-2"><span className="text-xs lg:text-sm text-slate-400 font-bold uppercase">時間</span><div className="flex items-center gap-1.5 whitespace-nowrap tracking-tighter">⏲️ {formatTimeWithUnit(stage.time, stage.timeUnit)}</div></div>
                                  <div className="flex flex-col items-center gap-2 border-y lg:border-y-0 lg:border-x border-orange-100/50 py-4 lg:py-0"><span className="text-xs lg:text-sm text-slate-400 font-bold uppercase">溫度</span><div className="flex items-center gap-1.5">🌡️ {stage.temperature ? `${stage.temperature}°` : '--'}</div></div>
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
                        <div className="mb-8 print:mb-2">
                          <h4 className="text-base font-black text-orange-500 uppercase tracking-widest mb-4 ml-1 print:text-black print:mb-1 text-left">烤焙參數</h4>
                          
                          {/* 列印專用表格 */}
                          <table className="hidden print:table print-table mb-2">
                            <thead>
                              <tr>
                                <th>烤焙階段</th>
                                <th>時間</th>
                                <th>上火</th>
                                <th>下火</th>
                                <th>備註</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRecipe.bakingStages?.map((stage, idx) => (
                                <tr key={idx}>
                                  <td>{stage.name || `階段 ${idx+1}`}</td>
                                  <td>{formatTimeWithUnit(stage.time, stage.timeUnit)}</td>
                                  <td>{stage.topHeat}°C</td>
                                  <td>{stage.bottomHeat}°C</td>
                                  <td>{stage.note || '--'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* 螢幕顯示卡片 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:hidden">
                            {selectedRecipe.bakingStages?.map((stage, idx) => (
                              <div key={idx} className="bg-white p-6 rounded-[32px] border border-orange-50 shadow-sm relative overflow-hidden">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-4 mb-8">
                                  <span className="text-lg font-black text-slate-800 uppercase tracking-wide text-left w-full lg:w-auto">{stage.name || `STAGE ${idx+1}`}</span>
                                  <span className="text-lg lg:text-xl font-black text-[#E67E22] bg-orange-50 px-5 py-2 rounded-2xl flex items-center justify-center gap-2 shrink-0 w-full lg:w-auto">
                                    <span>⏲️</span>
                                    <span className="whitespace-nowrap tracking-tighter">{formatTimeWithUnit(stage.time, stage.timeUnit)}</span>
                                  </span>
                                </div>
                                <div className="flex flex-col lg:flex-row justify-around text-center items-center py-2 gap-8 lg:gap-0">
                                  <div className="flex-1 w-full"><div className="text-sm text-slate-400 font-bold uppercase mb-3">上火</div><div className="text-4xl font-black text-slate-800 tabular-nums">{stage.topHeat}<span className="text-lg opacity-60 ml-1">°C</span></div></div>
                                  <div className="w-full h-px lg:w-px lg:h-16 bg-orange-100" />
                                  <div className="flex-1 w-full"><div className="text-sm text-slate-400 font-bold uppercase mb-3">下火</div><div className="text-4xl font-black text-slate-800 tabular-nums">{stage.bottomHeat}<span className="text-lg opacity-60 ml-1">°C</span></div></div>
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

                <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm print:rounded-2xl print:border-slate-200 print:p-2 print:space-y-1">
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
                  <div className="space-y-8 print:space-y-1 print:print-steps-compact">
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
                          <div key={idx} className="flex gap-4 sm:gap-6 items-start group print:gap-2 print:mb-2">
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0 print:gap-1">
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
                                  : 'bg-orange-50 text-[#E67E22] border-orange-100 group-hover:bg-orange-500 group-hover:text-white print:bg-white print:text-black print:border-slate-200'
                              }`}>
                                {stepNumber}
                              </span>
                            </div>
                            <div className="flex-grow pt-1.5 sm:pt-2 print:pt-0">
                              <p className={`text-base leading-relaxed font-bold tracking-wide transition-all whitespace-pre-wrap print:text-sm print:font-normal print:leading-tight ${
                                isCompleted ? 'text-slate-400 line-through decoration-slate-300 print:text-slate-400 print:no-underline' : 'text-slate-700'
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
                  <div className="bg-yellow-50/50 p-8 rounded-[40px] border-2 border-yellow-100 shadow-sm relative overflow-hidden print:rounded-2xl print:border-slate-200 print:p-2 print:bg-white print:mb-2">
                    <h3 className="text-xl font-black text-yellow-700 mb-6 flex items-center gap-3 px-2 print:text-base print:text-black">
                      <span className="w-2 h-8 bg-yellow-500 rounded-full"></span>
                      📝 老師的小叮嚀
                    </h3>
                    <p className="text-base text-slate-700 leading-relaxed font-bold tracking-wide whitespace-pre-wrap px-2 print:text-sm">{selectedRecipe.notes}</p>
                  </div>
                )}

                <div className="bg-white p-8 rounded-[40px] border-2 border-orange-50 shadow-sm space-y-8 print:rounded-2xl print:border-slate-200 print:p-2 print:space-y-1 print:mb-2">
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
                    <button onClick={() => { setTagInput(''); setFormRecipe(selectedRecipe); setView(AppView.EDIT); }} className="flex-grow py-5 bg-white border border-orange-100 rounded-[32px] font-black text-orange-600 shadow-sm active:scale-95 transition-all hover:bg-orange-50 text-base">編輯配方</button>
                    <button 
                      onClick={() => {
                        if (!isPremiumUser) {
                          triggerUpgradePrompt(true);
                          return;
                        }
                        window.print();
                      }} 
                      className={`flex-grow py-5 ${isPremiumUser ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#E8D5C0] text-[#8B5E3C]'} text-white rounded-[32px] font-black shadow-lg active:scale-95 transition-all text-base flex items-center justify-center gap-2`}
                    >
                      <span>🖨️</span>
                      <span>列印 / 存為 PDF {!isPremiumUser && '(VIP)'}</span>
                    </button>
                    <button onClick={() => triggerConfirm(handleDeleteRecipe, "確認刪除食譜？", "妳確定要移除這份食譜嗎？此操作將會永久刪除所有相關資料。")} className="flex-grow py-5 bg-red-50 text-red-500 rounded-[32px] font-black shadow-sm active:scale-95 transition-all hover:bg-red-100 text-base">刪除配方</button>
                  </div>
                </div>
              </div>
            )}
          </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-orange-50 shadow-[0_-10px_30px_rgb(230,126,34,0.06)] px-4 sm:px-8 py-4 flex justify-around items-center z-[1000] rounded-t-[40px] animate-in slide-in-from-bottom-10 duration-500 print:hidden">
        <button onClick={() => setView(AppView.LIST)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.LIST ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">🏠</span><span className="text-[10px] font-black">首頁</span></button>
        <button 
          onClick={handleCreateNew} 
          className={`flex flex-col items-center gap-1 transition-all ${view === AppView.CREATE || view === AppView.EDIT || view === AppView.MANAGE_CATEGORIES ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}
        >
          <span className="text-2xl">📝</span>
          <span className="text-[10px] font-black">食譜</span>
        </button>
        <button onClick={() => setView(AppView.SCALING)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.SCALING ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">⚖️</span><span className="text-[10px] font-black">換算</span></button>
        <button onClick={() => setView(AppView.COLLECTION)} className={`flex flex-col items-center gap-1 transition-all ${view === AppView.COLLECTION ? 'text-[#E67E22] scale-110' : 'text-orange-200 hover:text-orange-400'}`}><span className="text-2xl">📥</span><span className="text-[10px] font-black">收集</span></button>
      </nav>

      {/* Modals */}
      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen} 
        message={subscriptionModalMessage}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          setSuppressUpgradeModal(true);
          setSubscriptionModalMessage(undefined);
        }} 
      />
      <AIPreviewModal 
        isOpen={!!aiPreviewData} 
        recipes={aiPreviewData || []} 
        onClose={() => setAiPreviewData(null)}
        onImport={applyParsedRecipe}
        onMerge={handleMergeParsedRecipes}
        onImportAll={handleImportAllParsedRecipes}
      />
      
      {/* 臨時配方卡 Modal 已移除 */}

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
