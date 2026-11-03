export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  const endpoint = process.env.ROBOFLOW_ENDPOINT;

  if (!apiKey || !endpoint) {
    return res.status(500).json({ error: '서버 환경 변수(ROBOFLOW_API_KEY 또는 ROBOFLOW_ENDPOINT)가 누락되었습니다.' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: '이미지 데이터가 전송되지 않았습니다.' });
    }

    // 엔드포인트 URL 정제 (공백 제거)
    let targetUrl = endpoint.trim();
    if (!targetUrl.includes('api_key=')) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}api_key=${apiKey.trim()}`;
    }

    // Roboflow Workflow API 호출
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        inputs: {
          image: {
            type: "base64",
            value: image
          }
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Roboflow API Error:', data);
      const detailMsg = data.message || data.error || JSON.stringify(data);
      return res.status(response.status).json({ 
        error: `Roboflow API 인증/호출 실패 (${response.status}): ${detailMsg}` 
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: `서버 내부 오류: ${err.message}` });
  }
}