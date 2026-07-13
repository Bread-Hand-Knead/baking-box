import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

// 藍新金流方案價格設定 (新台幣)
const PLAN_PRICES = {
  monthly: 120,
  yearly: 990,
  permanent: 2500,
};

// 藍新金流商品描述設定
const PLAN_DESCS = {
  monthly: "烘焙靈感箱 Premium - 月費訂閱 (30天)",
  yearly: "烘焙靈感箱 Premium - 年費訂閱 (365天)",
  permanent: "烘焙靈感箱 Premium - 終身買斷版 (永久 VIP)",
};

/**
 * 藍新金流 AES 加密 (AES-256-CBC, PKCS7 Padding)
 */
function encryptAES(parameterString: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), Buffer.from(iv));
  let encrypted = cipher.update(parameterString, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

/**
 * 藍新金流 AES 解密
 */
function decryptAES(encryptedHex: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), Buffer.from(iv));
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * 藍新金流 交易簽章 TradeSha 生成
 */
function sha256Hash(tradeInfoHex: string, key: string, iv: string): string {
  const sha = crypto.createHash("sha256");
  const plainText = `HashKey=${key}&${tradeInfoHex}&HashIV=${iv}`;
  return sha.update(plainText).digest("hex").toUpperCase();
}

/**
 * 建立付款交易參數 (Callable Function)
 * 前端傳入方案與信箱，後端計算加密參數並於 Firestore 建立 Pending 訂單
 */
export const createPayment = onCall(async (request) => {
  // 1. 驗證使用者登入狀態
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "使用者必須登入才能進行訂閱。");
  }

  const { planType, email } = request.data;
  if (!planType || !PLAN_PRICES[planType as keyof typeof PLAN_PRICES]) {
    throw new HttpsError("invalid-argument", "無效的訂閱方案類型。");
  }

  // 2. 讀取藍新金流環境變數
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID || "";
  const hashKey = process.env.NEWEBPAY_HASH_KEY || "";
  const hashIV = process.env.NEWEBPAY_HASH_IV || "";
  const isProduction = process.env.NEWEBPAY_PRODUCTION === "true";
  
  // 決定收銀台 URL (測試或正式環境)
  const newebpayUrl = isProduction
    ? "https://core.newebpay.com/MPG/mpg_gateway"
    : "https://ccore.newebpay.com/MPG/mpg_gateway";

  if (!merchantId || !hashKey || !hashIV) {
    throw new HttpsError("failed-precondition", "後端藍新金流環境變數未正確配置。");
  }

  const uid = request.auth.uid;
  const amt = PLAN_PRICES[planType as keyof typeof PLAN_PRICES];
  const itemDesc = PLAN_DESCS[planType as keyof typeof PLAN_DESCS];
  
  // 產生 30 字元內唯一的訂單編號 (TX_ 加上時間戳與 4 位隨機數)
  const orderId = `TX_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const returnUrl = process.env.NEWEBPAY_RETURN_URL || "https://bread-hand-knead.github.io/baking-box/?payment=success";
  const clientBackURL = process.env.NEWEBPAY_CLIENT_BACK_URL || "https://bread-hand-knead.github.io/baking-box/";
  const notifyUrl = process.env.NEWEBPAY_NOTIFY_URL;

  if (!notifyUrl) {
    throw new HttpsError("failed-precondition", "後端未配置 NEWEBPAY_NOTIFY_URL，無法接收付款通知。");
  }

  // 3. 組合藍新金流規範之 Query String 參數
  const parameterString = [
    `MerchantID=${merchantId}`,
    `RespondType=JSON`,
    `TimeStamp=${Math.floor(Date.now() / 1000)}`,
    `Version=2.0`,
    `MerchantOrderNo=${orderId}`,
    `Amt=${amt}`,
    `ItemDesc=${encodeURIComponent(itemDesc)}`,
    `Email=${encodeURIComponent(email || "")}`,
    `LoginType=0`,
    `NotifyURL=${encodeURIComponent(notifyUrl)}`,
    `ReturnURL=${encodeURIComponent(returnUrl)}`,
    `ClientBackURL=${encodeURIComponent(clientBackURL)}`,
  ].join("&");

  // 4. AES 加密與 SHA256 簽章計算
  const tradeInfo = encryptAES(parameterString, hashKey, hashIV);
  const tradeSha = sha256Hash(tradeInfo, hashKey, hashIV);

  // 5. 於 Firestore 中建立 Pending 訂單紀錄
  await db.collection("orders").doc(orderId).set({
    orderId,
    uid,
    email: email || "",
    amount: amt,
    planType,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    MerchantID: merchantId,
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
    Version: "2.0",
    newebpayUrl,
  };
});

/**
 * 接收藍新金流非同步交易通知的 Webhook (HTTPS POST Trigger)
 */
export const newebpayWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { Status, TradeInfo, TradeSha } = req.body;
    
    const hashKey = process.env.NEWEBPAY_HASH_KEY || "";
    const hashIV = process.env.NEWEBPAY_HASH_IV || "";

    if (!hashKey || !hashIV) {
      console.error("NewebPay HashKey/HashIV environment variables not configured.");
      res.status(500).send("Server configuration error.");
      return;
    }

    // 1. 驗證雜湊簽章，防止來源偽造
    const calculatedSha = sha256Hash(TradeInfo, hashKey, hashIV);
    if (calculatedSha !== TradeSha) {
      console.error("Signature verification failed for NewebPay webhook.");
      res.status(400).send("Invalid signature.");
      return;
    }

    // 2. 解密 TradeInfo 取得交易明細
    const decryptedJSONString = decryptAES(TradeInfo, hashKey, hashIV);
    const decryptedData = JSON.parse(decryptedJSONString);

    console.log("Decrypted Webhook Data:", decryptedData);

    const orderStatus = decryptedData.Status; // "SUCCESS" 或其他失敗碼
    const merchantOrderNo = decryptedData.Result.MerchantOrderNo;
    const paymentType = decryptedData.Result.PaymentType;
    const payTime = decryptedData.Result.PayTime; 

    // 3. 讀取並確認資料庫中是否存在該筆 Pending 訂單
    const orderRef = db.collection("orders").doc(merchantOrderNo);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.error(`Order ${merchantOrderNo} not found in database.`);
      res.status(404).send("Order not found.");
      return;
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      res.status(500).send("Order data corrupted.");
      return;
    }

    // 防止重送攻擊 (Replay Attack) 與重複處理
    if (orderData.status === "success") {
      console.log(`Order ${merchantOrderNo} already processed as success.`);
      res.status(200).send("SUCCESS");
      return;
    }

    // 4. 處理支付成功 / 失敗流程
    if (Status === "SUCCESS" && orderStatus === "SUCCESS") {
      const payTimeTs = payTime ? new Date(payTime).getTime() : Date.now();
      
      // 更新訂單狀態為 success
      await orderRef.update({
        status: "success",
        paymentType: paymentType || "",
        payTime: payTimeTs,
        updatedAt: Date.now(),
      });

      // 升級使用者權限與訂閱週期
      const uid = orderData.uid;
      const planType = orderData.planType; // 'monthly' | 'yearly' | 'permanent'
      const userSettingsRef = db.collection("userSettings").doc(uid);

      let subscriptionExpiresAt: number | null = null;
      const now = Date.now();
      
      if (planType === "monthly") {
        subscriptionExpiresAt = now + 30 * 24 * 60 * 60 * 1000;
      } else if (planType === "yearly") {
        subscriptionExpiresAt = now + 365 * 24 * 60 * 60 * 1000;
      }

      await userSettingsRef.set({
        is_vip: true,
        subscriptionStatus: "active",
        subscriptionType: planType,
        subscriptionExpiresAt,
        trial_until: null, // 啟用正式付費訂閱後清除試用狀態
        is_permanent_vip: planType === "permanent",
        lastOrderId: merchantOrderNo,
        updatedAt: now,
      }, { merge: true });

      console.log(`User ${uid} successfully upgraded to Premium via order ${merchantOrderNo}.`);
    } else {
      // 支付失敗，將訂單標記為失敗
      await orderRef.update({
        status: "failed",
        updatedAt: Date.now(),
      });
      console.log(`Payment failed for order ${merchantOrderNo}. Status: ${orderStatus}`);
    }

    // 回覆 SUCCESS 給藍新伺服器，中斷重複通知機制
    res.status(200).send("SUCCESS");
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send("Internal server error.");
  }
});
