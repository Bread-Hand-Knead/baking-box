import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

/**
 * AI 解析 (Callable Function)
 *
 * Gemini 金鑰只放在後端（Secret Manager），使用者不用、也看不到金鑰。
 * 次數限制也在後端檢查，前端無法繞過。
 *
 * 設定金鑰：firebase functions:secrets:set GEMINI_API_KEY
 */
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// 使用的模型（之後要換模型只改這裡）
const GEMINI_MODEL = "gemini-3-flash-preview";

// 次數上限
const FREE_MONTHLY_PARSE_LIMIT = 10;
const PREMIUM_MONTHLY_PARSE_LIMIT = 1000;
const FREE_DAILY_QA_LIMIT = 3;

// 單次輸入長度上限（避免被拿來塞超大內容）
const MAX_PASTE_CHARS = 50000;
const MAX_QA_QUESTION_CHARS = 2000;
const MAX_QA_CONTEXT_CHARS = 400000;

// 與前端 firebase-applet-config.json 的 firestoreDatabaseId 相同
export const FIRESTORE_DATABASE_ID = "ai-studio-94083e6a-9c2f-4dd1-8189-a5b2087ed826";

const ADMIN_EMAILS = ["linda6623@gmail.com", "linda6623@gamil.com"];

/* ---------- 回傳格式定義 (JSON Schema) ---------- */

const INGREDIENT_OBJECT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    amount: { type: "string" },
    unit: { type: "string" },
    isFlour: { type: "boolean" },
  },
  required: ["name", "amount", "unit"],
};

const FERMENTATION_STAGE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    time: { type: "string" },
    timeUnit: { type: "string", enum: ["分鐘", "小時"] },
    temperature: { type: "string" },
    humidity: { type: "string" },
    note: { type: "string" },
  },
  required: ["name", "time"],
};

const HEAT_DESCRIPTION = (side: string) =>
  `${side}溫度數值。僅能輸出乾淨數值（若無區分上下火則填入相同溫度數字，例如: "170"），嚴禁包含任何思考推理、思考過程說明文字（如 160_C_without_degree_symbol 類似樣板字串）、度數單位或說明文字。`;

const BAKING_STAGE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    topHeat: { type: "string", description: HEAT_DESCRIPTION("上火") },
    bottomHeat: { type: "string", description: HEAT_DESCRIPTION("下火") },
    time: { type: "string" },
    timeUnit: { type: "string", enum: ["分鐘", "小時"] },
    note: { type: "string" },
  },
  required: ["name", "time"],
};

const AI_RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    master: { type: "string" },
    category: { type: "string" },
    subcategory: { type: "string" },
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
    notes: { type: "string" },
  },
  required: ["title", "ingredients", "instructions"],
};

const AI_MULTI_RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: { type: "array", items: AI_RECIPE_SCHEMA },
  },
  required: ["recipes"],
};

const AI_NOTE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    master: { type: "string" },
    content: { type: "string" },
  },
  required: ["title", "master", "content"],
};

/* ---------- 提示詞 ---------- */

const buildRecipePrompt = (smartPasteText: string) => `你是一個專業且極具適應力的烘焙食譜解析助手。
        請從下方的【筆記內容】中識別並提取烘焙食譜資訊。
        
        【核心目標】：
        1. 專注提取核心結構：『食譜名稱』、『材料』、『步驟』與『大師/師傅名稱』。
           - ⚠️ 重要！單位標準化規則：
             請將所有的重量與體積單位標準化。如果是「公克」、「克」、「G」，請一律將材料的 unit 填寫為小寫「g」。如果是「毫升」、「ML」、「C.C.」、「cc」，請一律填寫為小寫「ml」。如果是「公斤」、「KG」，請一律填寫為小寫「kg」。如果是「公升」、「L」，請一律填寫為大寫「L」。其餘非重量與體積單位（如：條、根、個、份、少許、適量）則原樣保留。
        2. 烤溫與發酵資訊智慧識別與自動對應：
           - 仔細過濾筆記文字中的「烤溫/烘烤參數」（例如：上火 210°C / 下火 190°C、180度、烤 12 分鐘、烘焙時間等）與「發酵資訊」（例如：基本發酵 60 分鐘、最後發酵 50 分、冷藏發酵 12~16 小時等）。
           - 將這些數據精確填入 "bakingStages" 與 "fermentationStages" 中：
             - bakingStages 每個元素應為包含: "name" (例如: 烘烤, 預熱等), "topHeat" (僅數字、文字，不要包含°C字眼), "bottomHeat" (僅數字、文字，不要包含°C字眼), "time" (時間數值, 如: 12, 25), "timeUnit" ("分鐘" 或 "小時"), "note" 的物件。如果是單一溫度不分上下火，或只有一組溫度，請同時填入 topHeat 與 bottomHeat 或填入 note。
             - ⚠️ 烤溫嚴格限制：topHeat 與 bottomHeat 欄位僅能輸出乾淨數值（若無區分上下火則填入相同溫度數字，例如: "170"），嚴禁包含任何思考推理、思考過程說明文字（如 160_C_without_degree_symbol 類似樣板字串）或度數單位。
             - ⚠️ 烘烤去重規範：同一原料的預處理烘烤（如：烤鹹蛋黃、預烤堅果等）僅建立一個烘烤階段，嚴禁重複生成相同內容之步驟或烘烤卡片。
             - fermentationStages 每個元素應為包含: "name" (例如: 基本發酵, 最後發酵, 中間發酵, 冷藏發酵等), "time" (時間數值, 如: 60, 50, 12), "timeUnit" ("分鐘" 或 "小時"), "temperature" (溫度，如: 28, 32-35, 4), "humidity" (濕度，如: 75%, 85%), "note" 的物件。
           - ⚠️ 重要！關於發酵與冷藏的判斷規則：
             1) 只有明確提到「發酵」二字（如：冷藏發酵、室溫發酵、最後發酵）的步驟才可填入 fermentationStages。
             2) 如果只是「冰箱冷藏定型」、「冷藏醒麵/鬆弛」或「放冷藏冷卻」（無提到發酵二字），這不是發酵，請「絕對不要」填入 fermentationStages。
           - ⚠️ 重要！步驟完整性規則：
             1) 請「絕對不要」從 instructions 步驟陣列中刪除或省略任何步驟。所有製作步驟（包括攪拌、整型、發酵、冷藏、烘烤等）都必須「完整、詳細地保留並填入 instructions 陣列中」，不得因為它們被提取為 fermentationStages 或 bakingStages 就將其從 instructions 中刪除！
             2) 如果筆記內容的步驟有分段或有大標題（例如：① 製作餅乾底、② 製作乳酪餡 等），請在 instructions 陣列中將該標題前面加上 '[SECTION]' 作為獨立元素（例如："[SECTION]① 製作餅乾底"），以完美保留步驟的分段結構。
        3. 數據清洗：請移除與食譜無關的個人心情、廣告文字、日期、無效標記或瑣碎碎念。
        4. 解析韌性 (Resilience)：
           - 若遇到格式模糊、沒有明確比例的配方，請優先以【總麵粉/粉類重量 = 100%】的烘焙百分比邏輯進行逆推計算。
           - 任何包含「數字 + 單位（g, ml, %, 份）」的組合皆視為有效材料。
        5. 區塊辨識：烘焙常包含中種、主麵糰、內餡、抹面等區塊，請分別提取。
        6. 規格重量：若提到「麵糰/皮/主體」的單顆克數，存入 doughWeight；若提到「內餡/餡」的單顆克數，存入 fillingWeight。僅提取純數字。
        
        【筆記內容】：
        ${smartPasteText}
        
        【輸出要求】：
        - 必須回傳純 JSON 格式，根節點名為 "recipes" (陣列)。
        - 每個物件包含: title, description, notes, master, category, subcategory, doughWeight, fillingWeight, ingredients (name, amount, unit), instructions (字串陣列), liquidStarterIngredients, fillingIngredients, decorationIngredients, customSectionIngredients, fermentationStages, bakingStages。
        `;

const buildNotePrompt = (noteSmartPasteText: string) => `你是一個極度忠於原文的烘焙筆記整理助手。
      請從下方的【筆記內容】中提取標題、師傅/老師名稱，以及【100% 忠於原文】的重點內容和連結。
      
      【100% 忠於原文與嚴格防篡改規則】：
      1. 標題 (title)：簡短精煉的重點主題，例如「發酵奶油與甜性奶油的差異與烘焙應用建議」。如果文中沒有明確標題，請提取最具代表性的短句作為標題，不要空白。
      2. 師傅/老師名稱 (master)：分享這個知識、技巧的老師或師傅名稱（例如：呂昇達）。如果沒有提到，請填入空字串。
      3. 重點內容和連結 (content)：
         - ⚠️【嚴禁添加非原文標籤】：絕對不可自行插入 "###"、"**" 粗體語法、"【核心觀念】" 或任何 AI 自創的分類小標題！
         - ⚠️【嚴禁出現文字型態的 \\n】：段落換行請使用真實的換行字元 (Enter)，絕對不可以輸出字面上的 \\n 字元。
         - ⚠️【100% 保持原作者字句與語氣】：保持原作者的說話語氣、口吻與段落，絕對不可進行任何語意改寫、摘要簡化、刪減或自行擴寫。
         - ⚠️【100% 保留原文符號】：老師原文中的 Emoji（如 💡、🧈、✅）、標點符號與原始條列符號（如 1.、2.、-）必須 100% 原樣保留。
         - ⚠️【保留連結與純淨換行】：內容中若有 URL 網址連結請完整保留。僅將原本的換行與空行保留為乾淨的標準段落換行，呈現與原始貼文完全一致的乾淨排版。
      
      【筆記內容】：
      ${noteSmartPasteText}
      `;

const buildQaPrompt = (recipesContext: string, notesContext: string, q: string) => `你是一個專業的個人烘焙助理。請依據下方提供的【使用者食譜】與【使用者筆記】來回答問題。

【核心規則與來源標註要求】：
1. 你的回答必須【僅依據】下方提供的食譜與筆記資料進行統整回答，絕對不能胡言亂語或憑空捏造。
2. 如果提供的資料中完全沒有相關資訊，請禮貌地回答：「目前您的食譜與筆記中沒有關於這方面的記錄喔。」
3. 📌【重要：句子/論點來源超連結標註 (In-text Citations)】：
   - 當你在回答中引用特定食譜或筆記的內容、論點、步驟或技巧時，必須在該句句尾（句號前或緊接著句號）附帶來源標籤。
   - 標籤格式規定：
     * 引用食譜時：[來源: 食譜標題](source:recipe:食譜ID) 或 [食譜標題](source:食譜ID)
     * 引用筆記時：[來源: 筆記標題](source:note:筆記ID) 或 [筆記標題](source:筆記ID)
     * 亦相容格式：[來源: 標題](#note-筆記ID) 或 [來源: 標題](#recipe-食譜ID)
   - 若同一句綜合了多筆來源，請連續標註在句末（例如：「...能讓麵包內部組織更柔軟保濕[來源: 湯種製作法](source:note:kn-123) [來源: 鮮奶吐司](source:recipe:rec-456)。」）。
   - 來源標籤中的名稱請寫入完整的食譜或筆記標題，前端會自動精簡為極簡行內圖示，並在滑鼠懸停時展示來源標題。
4. 【回答格式結構】：
   第一部分：針對問題的回答內容（繁體中文），並切實落實上述句尾來源標籤。
   第二部分：在回答內容最下方，請另起新行並明確列出整體的【參考資料】，格式如下（多個參考以逗號分隔）：
   References: [卡片類型|ID|名稱]
   
   例如：
   References: [食譜|rec-12345|起司蛋糕], [筆記|kn-67890|鹽可頌技巧]
   請確保 references 格式正確，包含卡片類型（食譜或筆記）、ID 與名稱。

【使用者食譜】：
${recipesContext || '（目前沒有食譜）'}

【使用者筆記】：
${notesContext || '（目前沒有筆記）'}

問題：${q}`;

/* ---------- 工具 ---------- */

// 與前端相同的日期格式 (UTC)
const getTodayString = () => new Date().toISOString().split("T")[0];
const getThisMonthString = () => new Date().toISOString().substring(0, 7);

// 判斷是否為進階用戶（與前端 App.tsx 的判斷方式一致）
function isPremium(data: admin.firestore.DocumentData | undefined, email: string): boolean {
  if (ADMIN_EMAILS.includes(email.toLowerCase().trim())) return true;
  if (!data) return false;
  const now = Date.now();
  const isTrialActive = typeof data.trial_until === "number" && data.trial_until > now;
  return data.subscriptionStatus === "active" || data.is_vip === true || isTrialActive || data.is_permanent_vip === true;
}

function requireText(value: unknown, field: string, maxChars: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `缺少內容：${field}`);
  }
  if (value.length > maxChars) {
    throw new HttpsError("invalid-argument", "內容太長了，請分段貼上。");
  }
  return value;
}

function optionalText(value: unknown, maxChars: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new HttpsError("invalid-argument", "資料格式錯誤。");
  if (value.length > maxChars) throw new HttpsError("invalid-argument", "食譜與筆記資料太多，無法一次問答。");
  return value;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// 呼叫 Gemini（遇到忙碌或連線問題時自動重試，最多 3 次）
async function callGemini(prompt: string, responseSchema?: object): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };
  if (responseSchema) {
    body.generationConfig = { responseMimeType: "application/json", responseSchema };
  }

  const maxRetries = 3;
  let lastError = "UNKNOWN";
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY.value(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      });

      if (res.ok) {
        const json: any = await res.json();
        const text = (json?.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p?.text || "")
          .join("");
        if (!text) throw new HttpsError("internal", "EMPTY_API_RESPONSE");
        return text;
      }

      const errText = await res.text();
      console.error(`[AI] Gemini error ${res.status} (attempt ${attempt}):`, errText.slice(0, 500));
      lastError = `HTTP_${res.status}`;
      // 429 (忙碌/額度) 與 5xx (伺服器問題) 才重試
      if (res.status !== 429 && res.status < 500) break;
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      console.error(`[AI] Gemini request failed (attempt ${attempt}):`, err?.message || err);
      lastError = err?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK";
    }
    if (attempt < maxRetries) await sleep(2000 * attempt);
  }

  if (lastError === "HTTP_429") {
    throw new HttpsError("unavailable", "AI 目前使用量較高，請稍候再試。");
  }
  if (lastError === "TIMEOUT") {
    throw new HttpsError("deadline-exceeded", "AI 回應太慢，請稍後再試。");
  }
  throw new HttpsError("internal", `AI 解析失敗 (${lastError})，請稍後再試。`);
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    console.error("[AI] JSON parse failed. Raw:", text.slice(0, 1000));
    throw new HttpsError("internal", "AI 回傳格式有誤，請再試一次。");
  }
}

/* ---------- 主功能 ---------- */

export const aiGenerate = onCall(
  {
    region: "asia-east1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "請先登入才能使用 AI 功能。");
    }

    const uid = request.auth.uid;
    const email = String(request.auth.token.email || "");
    const kind = request.data?.kind;

    // App 使用的是具名資料庫（不是預設資料庫），必須指定名稱
    const db = getFirestore(FIRESTORE_DATABASE_ID);
    const userSettingsRef = db.collection("userSettings").doc(uid);
    const userUsageRef = db.collection("user_usage").doc(uid);

    const [settingsSnap, usageSnap] = await Promise.all([userSettingsRef.get(), userUsageRef.get()]);
    const premium = isPremium(settingsSnap.data(), email);
    const usageData = usageSnap.data() || {};
    const now = Date.now();

    /* ----- AI 智慧問答 ----- */
    if (kind === "qa") {
      const question = requireText(request.data?.question, "問題", MAX_QA_QUESTION_CHARS);
      const recipesContext = optionalText(request.data?.recipesContext, MAX_QA_CONTEXT_CHARS);
      const notesContext = optionalText(request.data?.notesContext, MAX_QA_CONTEXT_CHARS);
      if (recipesContext.length + notesContext.length > MAX_QA_CONTEXT_CHARS) {
        throw new HttpsError("invalid-argument", "食譜與筆記資料太多，無法一次問答。");
      }

      const today = getTodayString();
      const currentQa = usageData.qa_date === today ? Number(usageData.qa_count || 0) : 0;
      if (!premium && currentQa >= FREE_DAILY_QA_LIMIT) {
        throw new HttpsError("resource-exhausted", `您的免費 AI 問問次數已達今日上限 (${FREE_DAILY_QA_LIMIT}次)，升級 Premium 可解鎖無限次數與雲端備份！`);
      }

      const answer = await callGemini(buildQaPrompt(recipesContext, notesContext, question));

      const newCount = currentQa + 1;
      await Promise.all([
        userUsageRef.set({ uid, email, qa_date: today, qa_count: newCount, updatedAt: now }, { merge: true }),
        userSettingsRef.set({ aiQaUsage: { date: today, count: newCount }, updatedAt: now }, { merge: true }),
      ]);

      return { text: answer, aiQaUsage: { date: today, count: newCount } };
    }

    /* ----- 食譜解析 / 心得筆記解析 ----- */
    if (kind === "recipe" || kind === "note") {
      const text = requireText(request.data?.text, "筆記內容", MAX_PASTE_CHARS);

      const month = getThisMonthString();
      const currentCount = usageData.month === month ? Number(usageData.ai_parse_count || 0) : 0;
      const limit = premium ? PREMIUM_MONTHLY_PARSE_LIMIT : FREE_MONTHLY_PARSE_LIMIT;
      if (currentCount >= limit) {
        throw new HttpsError(
          "resource-exhausted",
          premium
            ? `本月 AI 解析次數已達上限 (${limit}次)，下個月會自動重置。`
            : `每月 AI 解析次數已達上限 (${limit}次)，升級 Premium 可解鎖更多次數！`
        );
      }

      const output = kind === "recipe"
        ? await callGemini(buildRecipePrompt(text), AI_MULTI_RECIPE_SCHEMA)
        : await callGemini(buildNotePrompt(text), AI_NOTE_SCHEMA);
      const parsed = parseJson(output);

      // 食譜解析：沒找到任何材料就不扣次數
      const hasResult = kind === "note" || (Array.isArray(parsed?.recipes) && parsed.recipes.length > 0);

      let newCount = currentCount;
      if (hasResult) {
        newCount = currentCount + 1;
        await Promise.all([
          userUsageRef.set({
            uid,
            email,
            month,
            ai_parse_count: newCount,
            last_parse_at: now,
            updatedAt: now,
          }, { merge: true }),
          userSettingsRef.set({
            ai_parse_count: newCount,
            aiUsage: { date: month, count: newCount },
            updatedAt: now,
          }, { merge: true }),
        ]);
      }

      return { result: parsed, aiUsage: { date: month, count: newCount } };
    }

    throw new HttpsError("invalid-argument", "未知的 AI 功能。");
  }
);
