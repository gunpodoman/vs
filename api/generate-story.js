export default async function handler(req, res) {
  // 클라이언트로부터 char1과 char2 받기 (쿼리 파라미터 사용)
  const { char1, char2 } = req.query;

  if (!char1 || !char2) {
    res.status(400).json({ error: '두 캐릭터 이름을 모두 제공하세요.' });
    return;
  }

  // 환경 변수 로드 (Vercel에서 설정한 키)
  const serperApiKey = process.env.SERPER_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!serperApiKey || !groqApiKey) {
    res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    return;
  }

  try {
    // Serper API로 캐릭터 1 정보 검색
    const searchResponse1 = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: `${char1} 캐릭터 강점 약점 배경 능력` })
    });
    if (!searchResponse1.ok) throw new Error('Serper API 호출 실패 (캐릭터 1)');
    const searchData1 = await searchResponse1.json();
    const info1 = searchData1.organic ? searchData1.organic.slice(0, 5).map(item => `${item.title}: ${item.snippet}`).join('\n') : '정보 없음';

    // Serper API로 캐릭터 2 정보 검색
    const searchResponse2 = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: `${char2} 캐릭터 강점 약점 배경 능력` })
    });
    if (!searchResponse2.ok) throw new Error('Serper API 호출 실패 (캐릭터 2)');
    const searchData2 = await searchResponse2.json();
    const info2 = searchData2.organic ? searchData2.organic.slice(0, 5).map(item => `${item.title}: ${item.snippet}`).join('\n') : '정보 없음';

    // Groq API 프롬프트 생성
    const prompt = `${char1}와 ${char2}에 대한 작중 정보, 혹은 사람들의 평가를 검색하여 심층적으로 분석할 것. 마크다운을 사용하지 않고 답변할 것. 웬만해서는 1000자 정도의 분량으로 작성해야 하나, 필요에 따라 범위를 너무 벗어나지 않는 선에서 적절히 작성할 것. 모든 내용은 한글로 작성할 것. 각 캐릭터의 강점, 약점, 배경을 분석하고, 이 둘이 싸운다면 누가 이길지 논리적으로 추론할 것. 승패 이유를 구체적으로 설명하되, 단순한 설명문이 아니라 전체를 재미있는 짧은 스토리 형식으로 서사를 입혀서 작성할 것. 추가 정보 활용: ${char1}에 대한 정보: ${info1}. ${char2}에 대한 정보: ${info2}. 이 추가 정보를 바탕으로 더 정확하고 품질 높은 분석을 할 것.`;

    // Groq API 호출 (스트리밍)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',  // 모델이 올바른지 확인 (Groq 문서 확인: 실제 Groq 모델은 llama3-70b-8192 등일 수 있음)
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.7,
        stream: true
      })
    });

    if (!groqResponse.ok) throw new Error('Groq API 호출 실패');

    // 스트리밍 응답 반환 (Vercel Functions에서 ReadableStream 사용)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = groqResponse.body;
    stream.pipe(res);  // Groq 스트림을 직접 파이프라인으로 연결
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
