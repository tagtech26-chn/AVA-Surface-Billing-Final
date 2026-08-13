import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily / safely
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health Check API
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Financial & Sales Business Insights API
app.post("/api/ai-insights", async (req, res) => {
  const { metrics, inventoryAlerts, salesSummary, requestType } = req.body;

  const defaultFallbackInsight = {
    insight: "Current sales trends show steady momentum. Inventory stock health is stable with high turnover on ceramic wall tiles and PGVT slabs.",
    recommendations: [
      "Maintain at least a 15% safety stock buffer on top-selling 600x1200 PGVT tile boxes.",
      "Run a targeted 10% promotional deal on slower-moving outdoor pavers to accelerate inventory turnover.",
      "Follow up on outstanding unpaid ledger accounts over 14 days old to optimize liquid working capital."
    ],
    promoIdea: {
      code: "BUILD10",
      discount: "10%",
      description: "10% off on bulk tile orders over $500 for registered contractor ledgers."
    }
  };

  const defaultFallbackPromo = {
    promoCode: "TILESPECIAL15",
    title: "Premium Tile & Mosaic Special",
    discountText: "15% OFF",
    targetCategory: "PGVT & Ceramic Wall Tiles",
    marketingCopy: "Upgrade your living space! Get 15% off premium ceramic and PGVT floor tiles on orders over $200 this week.",
    recommendedMinSpend: 200
  };

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(200).json(
        requestType === "promo_generator" ? defaultFallbackPromo : defaultFallbackInsight
      );
    }

    let prompt = "";
    if (requestType === "promo_generator") {
      prompt = `You are an expert small business marketing consultant. Given the business inventory & target audience:
Inventory Context: ${JSON.stringify(inventoryAlerts || [])}
Business Metrics: ${JSON.stringify(metrics || {})}

Generate a creative promotion campaign with:
1. Catchy Promo Name & Code (e.g. SUMMER15)
2. Discount Type & Value (e.g. 15% off, $10 off over $50)
3. Target Products/Categories
4. Marketing copy for SMS/Email receipt banner.

Respond in structured JSON with keys: promoCode, title, discountText, targetCategory, marketingCopy, recommendedMinSpend.`;
    } else {
      prompt = `You are a Chief Financial Officer & Small Business Growth Advisor for a retail/service business.
Analyze the following store metrics and provide sharp, actionable advice:
Key Financial Metrics: ${JSON.stringify(metrics)}
Low Stock Alerts: ${JSON.stringify(inventoryAlerts)}
Sales Trends: ${JSON.stringify(salesSummary)}

Provide an executive response with:
1. Executive Summary (2 concise sentences)
2. 3 High-impact Strategic Recommendations for increasing profit margin or clearing inventory.
3. A suggested promotional campaign idea.

Respond in JSON format with keys: insight, recommendations (array of 3 strings), promoIdea ({ code, discount, description }).`;
    }

    // Call Gemini API with automatic retry on 503 / high demand spikes
    let responseText = "";
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        responseText = response.text || "";
        break;
      } catch (geminiError: any) {
        console.warn(`Gemini API attempt ${attempts} failed:`, geminiError?.message || geminiError);
        if (attempts < maxAttempts) {
          // Wait 1 second before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          throw geminiError;
        }
      }
    }

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const data = JSON.parse(responseText);
    return res.json(data);
  } catch (error: any) {
    console.error("AI Insights API Error (serving graceful fallback):", error?.message || error);
    // Graceful fallback response when Gemini model is experiencing high demand (503) or unavailable
    return res.status(200).json(
      requestType === "promo_generator" ? defaultFallbackPromo : defaultFallbackInsight
    );
  }
});

async function startServer() {
  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BizFlow Server running on http://localhost:${PORT}`);
  });
}

startServer();
