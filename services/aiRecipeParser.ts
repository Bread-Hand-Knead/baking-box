import { GoogleGenAI } from "@google/genai";
import { Recipe, Ingredient, FermentationStage, BakingStage } from "../App";

// 假設全域變數有 api key 設定，或讓使用者輸入
const getApiKey = async (): Promise<string> => {
  // 對於展示或開發目的，這裡可由使用者輸入或從 localStorage 讀取
  const key = localStorage.getItem("gemini_api_key");
  if (!key) {
    const userInput = window.prompt("請輸入你的 Gemini API Key 以使用智能解析功能：");
    if (userInput) {
      localStorage.setItem("gemini_api_key", userInput);
      return userInput;
    }
    throw new Error("API Key 未提供");
  }
  return key;
};

export const parseRecipeFromText = async (text: string): Promise<Partial<Recipe>> => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
你是一個專業的烘焙助手。請幫我將以下原始食譜文字解析為嚴格的 JSON 格式。
請注意以下規則：
1. 分析這是一個「麵包」或是「蛋糕」或是「其他」，並填入 category 欄位。
2. 強制區分「主麵團(ingredients)」與「餡料(fillingIngredients)」。如果是麵包/蛋糕主體的材料放 ingredients，如果是內餡、添加物則放 fillingIngredients。
3. ingredients 中的成分，請判斷是否為「粉類(例如高筋麵粉、低筋麵粉、法式麵粉等)」，若是則將 \`isFlour\` 設為 true，否則為 false。預設需讓主麵團的麵粉總量=100%（供使用者後續計算烘焙百分比）。
4. 所有的重量一律轉換為數字(amount欄位)，單位(unit欄位)通常為 "g"。
5. 若食譜包含步驟文字，請盡量抽取出詳細步驟放進 instructions。
6. 如果步驟中包含像是「發酵 60 分鐘」、「烘烤 20 分鐘」的字眼，請額外幫我解析成 fermentationStages 與 bakingStages 物件。

JSON 的最終介面必須符合或部份符合下列：
{
  "title": "食譜名稱",
  "category": "麵包" 或 "蛋糕",
  "description": "簡短描述文字（可由你總結）",
  "ingredients": [{ "name": "高筋麵粉", "amount": 500, "unit": "g", "isFlour": true }],
  "fillingIngredients": [{ "name": "核桃", "amount": 50, "unit": "g", "isFlour": false }],
  "fermentationStages": [{ "name": "基本發酵", "time": "60", "temperature": "", "humidity": "" }],
  "bakingStages": [{ "name": "烘烤", "topHeat": "200", "bottomHeat": "200", "time": "20", "note": "" }],
  "instructions": ["步驟一...", "步驟二..."]
}

絕對只能回傳 JSON 字串，不要包含任何 \`\`\`json 標記或其他的敘述。

原始食譜文字：
${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }] },
      config: {
          responseMimeType: "application/json",
      }
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("無效的回傳結果");
    }

    const parsedJson = JSON.parse(responseText);
    
    // 預先處理可能的資料型態
    return {
      title: parsedJson.title || "AI 解析食譜",
      category: parsedJson.category || "麵包",
      description: parsedJson.description || "",
      ingredients: parsedJson.ingredients || [],
      fillingIngredients: parsedJson.fillingIngredients || [],
      fermentationStages: parsedJson.fermentationStages || [],
      bakingStages: parsedJson.bakingStages || [],
      instructions: parsedJson.instructions || []
    };
  } catch (error) {
    console.error("AI Parsing Error:", error);
    throw error;
  }
};
