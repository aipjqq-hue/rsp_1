/**
 * Vercel Serverless Function for Roboflow ViT Workflow Inference
 * Route: POST /api/predict
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    try {
        const { image } = req.body || {};

        if (!image) {
            return res.status(400).json({ message: '이미지 데이터(base64)가 제공되지 않았습니다.' });
        }

        // Retrieve secrets from Vercel Environment Variables
        const apiKey = process.env.ROBOFLOW_API_KEY;
        const endpoint = process.env.ROBOFLOW_ENDPOINT;

        if (!apiKey || !endpoint) {
            console.error("Missing configuration: ROBOFLOW_API_KEY or ROBOFLOW_ENDPOINT is undefined.");
            return res.status(500).json({ 
                message: '서버 설정 오류: Vercel 환경 변수(ROBOFLOW_API_KEY 또는 ROBOFLOW_ENDPOINT)가 설정되지 않았습니다.' 
            });
        }

        // Clean base64 string if data URL prefix exists
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // Construct Roboflow API URL properly
        const separator = endpoint.includes('?') ? '&' : '?';
        const roboflowUrl = `${endpoint}${separator}api_key=${apiKey}`;

        const roboflowResponse = await fetch(roboflowUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: {
                    type: 'base64',
                    value: base64Data
                }
            })
        });

        if (!roboflowResponse.ok) {
            const errorText = await roboflowResponse.text();
            console.error("Roboflow API error:", roboflowResponse.status, errorText);
            
            return res.status(roboflowResponse.status).json({ 
                message: `Roboflow API 호출 실패 (${roboflowResponse.status}): URL 주소 및 API Key를 확인해 주세요. 상세: ${errorText.substring(0, 100)}` 
            });
        }

        const data = await roboflowResponse.json();

        // Extract predictions (handles Workflow format & classification format)
        let topClass = null;
        let topConfidence = 0;

        if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
            const outputObj = data.outputs[0];
            const predictions = outputObj.predictions || outputObj;

            if (predictions && predictions.top) {
                topClass = predictions.top;
                topConfidence = predictions.confidence || predictions.top_confidence || 0;
            } else if (predictions && Array.isArray(predictions.predictions) && predictions.predictions.length > 0) {
                const first = predictions.predictions[0];
                topClass = first.class || first.label;
                topConfidence = first.confidence || 0;
            } else if (predictions && typeof predictions === 'object') {
                let maxConf = -1;
                for (const [key, val] of Object.entries(predictions)) {
                    const confVal = typeof val === 'number' ? val : (val?.confidence || 0);
                    if (confVal > maxConf) {
                        maxConf = confVal;
                        topClass = key;
                    }
                }
                topConfidence = maxConf > -1 ? maxConf : 0;
            }
        } else if (data.predictions) {
            if (data.top) {
                topClass = data.top;
                topConfidence = data.confidence || 0;
            } else if (Array.isArray(data.predictions) && data.predictions.length > 0) {
                topClass = data.predictions[0].class || data.predictions[0].label;
                topConfidence = data.predictions[0].confidence || 0;
            } else if (typeof data.predictions === 'object') {
                let maxConf = -1;
                for (const [key, val] of Object.entries(data.predictions)) {
                    const confVal = typeof val === 'number' ? val : (val?.confidence || 0);
                    if (confVal > maxConf) {
                        maxConf = confVal;
                        topClass = key;
                    }
                }
                topConfidence = maxConf > -1 ? maxConf : 0;
            }
        } else if (data.top) {
            topClass = data.top;
            topConfidence = data.confidence || 0;
        }

        return res.status(200).json({
            class: topClass,
            confidence: topConfidence,
            raw: data
        });

    } catch (err) {
        console.error("Serverless Function Exception:", err);
        return res.status(500).json({ message: `서버 내부 오류가 발생했습니다: ${err.message}` });
    }
}