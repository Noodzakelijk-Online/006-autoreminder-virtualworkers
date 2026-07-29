import { getDb } from "../db";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

async function runTest() {
  if (!process.env.GROQ_API_KEY || !process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
    throw new Error("Missing keys in .env");
  }

  // Read the prompt dynamically from the file so we always test the latest version
  const fileContent = await fs.readFile(path.join(process.cwd(), "server/services/atis-understanding.ts"), "utf-8");
  const promptMatch = fileContent.match(/const systemPrompt = `([\s\S]*?)`;/);
  if (!promptMatch) throw new Error("Could not extract systemPrompt from atis-understanding.ts");
  const systemPrompt = promptMatch[1];

  console.log("Fetching 1 card directly from Trello...");
  const trelloUrl = `https://api.trello.com/1/members/me/cards?key=${process.env.TRELLO_API_KEY}&token=${process.env.TRELLO_TOKEN}&limit=1`;
  const trelloRes = await fetch(trelloUrl);
  const cards = await trelloRes.json();
  const cardData = cards[0];

  const prompt = `Card Name: ${cardData.name}\nDescription: ${cardData.desc}`;
  console.log(`Testing Groq with Card: ${cardData.name}`);

  const start = Date.now();
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  const data = await response.json();
  const resultText = data.choices[0].message.content;
  console.log(`Completed in ${Date.now() - start}ms\n`);
  
  const parsed = JSON.parse(resultText);
  console.log(JSON.stringify(parsed.aptlssChecklist, null, 2));
}

runTest().catch(console.error);
