const config = require('./config');

async function analyzeImage(imageUrl) {
  if (config.useMocks) {
    // In mock mode, return some plausible fake tags so we can test the UI
    return {
      autoTags: [
        { name: 'photo', confidence: 0.99 },
        { name: 'image', confidence: 0.95 },
        { name: 'demo', confidence: 0.80 }
      ],
      autoCaption: '[Mock] AI-generated caption will appear here in production',
      categories: ['demo']
    };
  }

  try {
    const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
    const { ApiKeyCredentials } = require('@azure/ms-rest-js');
    const credentials = new ApiKeyCredentials({
      inHeader: { 'Ocp-Apim-Subscription-Key': config.vision.key }
    });
    const client = new ComputerVisionClient(credentials, config.vision.endpoint);

    const features = ['Tags', 'Description', 'Categories'];
    const result = await client.analyzeImage(imageUrl, { visualFeatures: features });
    return {
      autoTags: (result.tags || []).slice(0, 10).map(t => ({
        name: t.name, confidence: t.confidence
      })),
      autoCaption: result.description?.captions?.[0]?.text || null,
      categories: (result.categories || []).map(c => c.name)
    };
  } catch (err) {
    console.error('Vision API error:', err.message);
    return { autoTags: [], autoCaption: null, categories: [] };
  }
}

module.exports = { analyzeImage };