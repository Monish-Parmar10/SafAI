const express = require('express');
const router = express.Router();
const axios = require('axios');

// Analyze garbage image using OpenRouter (Gemma 3 4B)
router.post('/analyze-garbage', async (req, res) => {
  try {
    const { imageBase64, latitude, longitude } = req.body;

    // Validate input
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Call OpenRouter API with Gemma 3 4B vision
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemma-3-4b-it', // Vision-capable Gemma model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: `Analyze this image and answer ONLY in JSON format:
{
  "hasGarbage": true/false,
  "garbageType": "plastic/metal/organic/mixed/none",
  "severity": "low/medium/high",
  "description": "brief description of what you see",
  "confidence": 0-100
}

Be strict: only return true if you clearly see garbage/litter.`,
              },
            ],
          },
        ],
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Extract response
    const analysisText = response.data.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!analysisResult) {
      return res.status(400).json({ 
        error: 'Could not parse analysis result',
        rawResponse: analysisText 
      });
    }

    // If garbage detected, create task for workers
    if (analysisResult.hasGarbage) {
      // Store in your database with location
      const garbageReport = {
        imageUrl: `/uploads/${Date.now()}.jpg`, // Save image locally
        location: { latitude, longitude },
        analysis: analysisResult,
        status: 'pending', // Workers will update to 'cleaned'
        createdAt: new Date(),
      };

      // TODO: Save to MongoDB
      // await GarbageReport.create(garbageReport);
      
      // TODO: Send notification to nagar nigam workers
      // await sendWorkerNotification(garbageReport);

      return res.json({
        success: true,
        message: 'Garbage detected! Task assigned to workers.',
        garbageReport,
      });
    } else {
      return res.json({
        success: true,
        message: 'No garbage detected in image.',
        analysis: analysisResult,
      });
    }
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);

    // Fallback message for user
    return res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message,
    });
  }
});

module.exports = router;
