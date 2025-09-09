// 페이지의 모든 HTML 요소가 로드된 후에 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateBtn');
    generateButton.addEventListener('click', generateStory);
});

// 텍스트를 안전한 HTML로 변환하는 함수 (XSS 방지)
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML.replace(/\n/g, '<br>');
}

async function generateStory() {
    const char1Input = document.getElementById('char1');
    const char2Input = document.getElementById('char2');
    const generateButton = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');

    const char1 = char1Input.value.trim();
    const char2 = char2Input.value.trim();

    if (!char1 || !char2) {
        alert('두 캐릭터 이름을 모두 입력하세요!');
        return;
    }

    // 로딩 시작: 버튼 비활성화 및 UI 초기화
    generateButton.disabled = true;
    loading.style.display = 'block';
    result.innerHTML = '';
    result.style.color = '#e0e0e0'; // 이전 오류 색상 초기화
    result.style.display = 'block';

    try {
        const response = await fetch(`/api/generate-story?char1=${encodeURIComponent(char1)}&char2=${encodeURIComponent(char2)}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '서버에서 응답을 받지 못했습니다.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ''; // 데이터 조각을 임시로 저장할 버퍼

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            // 들어온 데이터를 버퍼에 추가
            buffer += decoder.decode(value, { stream: true });
            
            // 버퍼에서 줄바꿈(\n\n)을 기준으로 데이터 처리
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const chunk = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2); // 처리한 부분은 버퍼에서 제거

                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content;
                            if (content) {
                                // XSS를 방지하기 위해 escapeHTML 함수 사용
                                result.innerHTML += escapeHTML(content);
                                result.scrollTop = result.scrollHeight; // 자동 스크롤
                            }
                        } catch (e) {
                            console.error('JSON 파싱 오류:', e);
                            // JSON 파싱 오류는 무시하고 스트림을 계속 처리
                        }
                    }
                }
            }
        }

        if (result.innerHTML.trim() === '') {
            result.innerHTML = '캐릭터 분석을 완료하지 못했습니다. 입력을 다시 확인하거나 나중에 시도해주세요.';
        }

    } catch (error) {
        result.innerHTML = '오류 발생: ' + error.message;
        result.style.color = '#ff4d4d';
    } finally {
        // 로딩 종료: 버튼 다시 활성화
        loading.style.display = 'none';
        generateButton.disabled = false;
    }
}
