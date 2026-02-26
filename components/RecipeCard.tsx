
import React from 'react';
import { Recipe } from '../types';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (recipe: Recipe) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick }) => {
  // 計算所有食材區塊的總和
  const totalIngredientsCount = 
    (recipe.ingredients?.length || 0) +
    (recipe.liquidStarterIngredients?.length || 0) +
    (recipe.fillingIngredients?.length || 0) +
    (recipe.decorationIngredients?.length || 0) +
    (recipe.customSectionIngredients?.length || 0);

  return (
    <div 
      onClick={() => onClick(recipe)}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-100 flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={recipe.imageUrl || 'https://picsum.photos/400/300?random=' + recipe.id} 
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-xs font-semibold text-slate-700 rounded-full shadow-sm">
            {recipe.category}
          </span>
          {recipe.isTried && (
            <span className="px-3 py-1 bg-orange-100/90 backdrop-blur-sm text-[10px] font-black text-orange-600 rounded-full shadow-sm border border-orange-200">
              待嘗試
            </span>
          )}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">
          {recipe.title}
        </h3>
        {recipe.master && (
          <p className="text-xs font-medium text-orange-600 mt-0.5 mb-1">
            👨‍🍳 {recipe.master}
          </p>
        )}
        <p className="text-sm text-slate-500 line-clamp-2 mt-1 flex-grow">
          {recipe.description}
        </p>
        <div className="mt-4 flex items-center text-xs text-slate-400 font-medium">
          <span>{totalIngredientsCount} 種食材</span>
          <span className="mx-2">•</span>
          <span>{new Date(recipe.createdAt).toLocaleDateString('zh-TW')}</span>
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
