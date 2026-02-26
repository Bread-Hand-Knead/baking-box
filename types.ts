
export interface Ingredient {
  name: string;
  amount: number | string;
  unit: string;
  isFlour: boolean;
}

export interface FermentationStage {
  name: string;
  time: string;
  timeUnit?: 'min' | 'hr';
  temperature: string;
  humidity: string;
}

export interface BakingStage {
  name?: string;
  topHeat: string;
  bottomHeat: string;
  time: string;
  note?: string;
}

export interface ExecutionLog {
  id: string;
  date: string;
  rating: number;
  feedback: string;
  photoUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Knowledge {
  id: string;
  title: string;
  content: string;
  master: string;
  createdAt: number;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'pdf' | 'link';
}

export interface Recipe {
  id: string;
  title: string;
  master?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceDate?: string;
  recordDate?: string;
  moldName?: string;
  doughWeight?: number;
  crustWeight?: number;
  oilPasteWeight?: number;
  fillingWeight?: number;
  quantity?: number;
  fermentationStages?: FermentationStage[];
  bakingStages?: BakingStage[];
  description: string;
  ingredients: Ingredient[];
  mainSectionName?: string;
  liquidStarterName?: string;
  liquidStarterIngredients?: Ingredient[];
  fillingIngredients?: Ingredient[];
  decorationIngredients?: Ingredient[];
  customSectionName?: string;
  customSectionIngredients?: Ingredient[];
  sectionsOrder?: string[];
  instructions: string[];
  imageUrl: string;
  category: string;
  createdAt: number;
  isBakingRecipe: boolean;
  isTried?: boolean;
  tags?: string[];
  notes?: string;
  executionLogs?: ExecutionLog[];
}

export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export enum AppView {
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
  MANAGE_CATEGORIES = 'MANAGE_CATEGORIES',
  SCALING = 'SCALING',
  COLLECTION = 'COLLECTION'
}

export interface GeminiImageConfig {
  size?: ImageSize;
  aspectRatio?: AspectRatio;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
