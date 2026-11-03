export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY;
  const endpoint = process.env.ROBOFLOW_ENDPOINT;

  if (!apiKey || !endpoint) {
    return res.status(500).json({ error: '서버에 Vercel 환경변수(ROBOFLOW_API_KEY 또는 ROBOFLOW_ENDPOINT)가 설정되지 않았습니다.' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: '이미지 데이터가 전송되지 않았습니다.' });
    }

    // URL에 API 키가 포함되어 있지 않다면 쿼리스트링으로 추가
    let targetUrl = endpoint;
    if (!targetUrl.includes('api_key=')) {
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}api_key=${apiKey}`;
    }

    // Roboflow Workflow API 규격에 맞게 'inputs' 객체로 감싸서 전송
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        error: `Roboflow API 호출 실패 (${response.status}): ${detailMsg.substring(0, 100)}` 
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: `서버 내부 오류: ${err.message}` });
  }
}
