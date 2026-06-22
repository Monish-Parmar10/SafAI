const fs = require('fs');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

// Configure dns and dotenv
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const imagePath = path.join(__dirname, 'uploads', 'demo1.jpg');
    const base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
    const mimeType = 'image/jpeg';

    const prompt = `Analyze this image and determine if it contains garbage, 
waste, litter, trash, or any form of improper waste disposal. 
Respond ONLY with a JSON object in this exact format:
{
  "detected": true or false,
  "confidence": number between 0 and 100,
  "severity": "low" or "medium" or "high",
  "reason": "one short sentence explaining what you see"
}
Base severity on: high if large pile or hazardous, medium if moderate 
amount, low if minor littering.`;

    console.log("Analyzing with gemini-3.5-flash...");
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      }
    ]);

    const responseText = result.response.text();
    console.log("Raw ResponseText:", responseText);
    const aiResult = JSON.parse(responseText.trim());
    console.log("Parsed JSON:", aiResult);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

main();
