// Serper API를 호출하여 캐릭터 정보를 검색하는 헬퍼 함수
async function searchCharacterInfo(characterName, apiKey, state = '') {
    let query = `${characterName} 캐릭터 강점 약점 배경 능력`;
    if (state) {
        query += ` 상태: ${state}`;
    }
    const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
    });
    if (!response.ok) {
        throw new Error(`Serper API 호출 실패 (${characterName}): ${response.statusText}`);
    }
    const data = await response.json();
    return data.organic 
        ? data.organic.slice(0, 5).map(item => `${item.title}: ${item.snippet}`).join('\n')
        : '정보 없음';
}

// Serper API를 호출하여 장소 정보를 검색하는 헬퍼 함수
async function searchLocationInfo(location, apiKey) {
    if (!location) return '정보 없음';
    const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: `${location} 환경 특징 지형 영향` })
    });
    if (!response.ok) {
        throw new Error(`Serper API 호출 실패 (${location}): ${response.statusText}`);
    }
    const data = await response.json();
    return data.organic 
        ? data.organic.slice(0, 3).map(item => `${item.title}: ${item.snippet}`).join('\n')
        : '정보 없음';
}

// Vercel의 메인 핸들러 함수
export default async function handler(req, res) {
    const { char1, char2, state1 = '', state2 = '', location = '' } = req.query;

    if (!char1 || !char2) {
        return res.status(400).json({ error: '두 캐릭터 이름을 모두 제공하세요.' });
    }

    const serperApiKey = process.env.SERPER_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!serperApiKey || !groqApiKey) {
        return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
    }

    try {
        // Promise.all을 사용해 캐릭터와 장소 정보를 동시에 검색하여 시간 단축
        const [info1, info2, locationInfo] = await Promise.all([
            searchCharacterInfo(char1, serperApiKey, state1),
            searchCharacterInfo(char2, serperApiKey, state2),
            searchLocationInfo(location, serperApiKey)
        ]);
        
        const prompt = `${char1}와 ${char2}에 대한 작중 정보, 혹은 사람들의 평가를 검색하여 심층적으로 분석할 것. 마크다운을 사용하지 않고 답변할 것. 웬만해서는 1000자 정도의 분량으로 작성해야 하나, 필요에 따라 범위를 너무 벗어나지 않는 선에서 적절히 작성할 것. 모든 내용은 한글로 작성할 것. 각 캐릭터의 강점, 약점, 배경을 분석하고, 이 둘이 싸운다면 누가 이길지 논리적으로 추론할 것. 승패 이유를 구체적으로 설명하되, 단순한 설명문이 아니라 전체를 재미있는 짧은 스토리 형식으로 서사를 입혀서 작성할 것. 추가 정보 활용: ${char1}에 대한 정보: ${info1}. ${char2}에 대한 정보: ${info2}. 이 추가 정보를 바탕으로 더 정확하고 품질 높은 분석을 할 것. 추가로, 싸움 장소: ${location} (정보: ${locationInfo}), ${char1} 상태: ${state1}, ${char2} 상태: ${state2}. 이 장소와 상태를 반영하여 캐릭터들의 능력이 어떻게 영향을 받는지 분석하고, 스토리에 자연스럽게 녹여서 승패를 추론할 것. 스토리의 맨 끝에 별도의 문장으로 "승자: ${char1}" 또는 "승자: ${char2}"를 추가할 것.`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b', // 모델 수정하지 말라고;;
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4096,
                temperature: 0.7,
                stream: true
            })
        });

        if (!groqResponse.ok) {
            const errorBody = await groqResponse.text();
            throw new Error(`Groq API 호출 실패: ${groqResponse.statusText} - ${errorBody}`);
        }

        // 헤더 설정
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // ReadableStream을 res로 수동 파이핑
        const reader = groqResponse.body.getReader();

        function pump() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    res.end();
                    return;
                }
                res.write(value);
                pump();
            }).catch(error => {
                console.error('스트림 오류:', error);
                res.end();
            });
        }

        pump();

    } catch (error) {
        console.error(error); // 서버 로그에 에러 기록
        res.status(500).json({ error: error.message });
    }
}
