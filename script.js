// 페이지의 모든 HTML 요소가 로드된 후에 스크립트를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateBtn');
    const char1Input = document.getElementById('char1');
    const char2Input = document.getElementById('char2');
    const state1Input = document.getElementById('state1');
    const state2Input = document.getElementById('state2');
    const locationInput = document.getElementById('location');
    const closePopup = document.getElementById('closePopup');
    const winnerPopup = document.getElementById('winnerPopup');

    generateButton.addEventListener('click', generateStory);

    // Enter 키를 눌렀을 때 실행될 함수
    const handleEnterKey = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // 기본 동작 방지
            generateStory(); // 스토리 생성 함수 호출
        }
    };

    // 각 입력창에 Enter 키 이벤트 리스너 추가
    char1Input.addEventListener('keydown', handleEnterKey);
    char2Input.addEventListener('keydown', handleEnterKey);
    state1Input.addEventListener('keydown', handleEnterKey);
    state2Input.addEventListener('keydown', handleEnterKey);
    locationInput.addEventListener('keydown', handleEnterKey);

    // 팝업 닫기 버튼 이벤트
    closePopup.addEventListener('click', () => {
        winnerPopup.style.display = 'none';
    });
});

/**
 * 텍스트를 안전한 HTML로 변환하는 함수 (XSS 공격 방지)
 * @param {string} str - 변환할 텍스트
 * @returns {string} - HTML 태그가 이스케이프 처리된 문자열
 */
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    // textContent로 할당하면 <, > 같은 문자가 &lt;, &gt;로 자동 변환됩니다.
    // 이후 줄바꿈 문자(\n)만 <br> 태그로 변경합니다.
    return p.innerHTML.replace(/\n/g, '<br>');
}

/**
 * 서버에 요청을 보내 스토리를 생성하고 화면에 표시하는 메인 함수
 */
async function generateStory() {
    const char1Input = document.getElementById('char1');
    const char2Input = document.getElementById('char2');
    const state1Input = document.getElementById('state1');
    const state2Input = document.getElementById('state2');
    const locationInput = document.getElementById('location');
    const generateButton = document.getElementById('generateBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const winnerText = document.getElementById('winnerText');
    const winnerPopup = document.getElementById('winnerPopup');

    const char1 = char1Input.value.trim();
    const char2 = char2Input.value.trim();
    const state1 = state1Input.value.trim();
    const state2 = state2Input.value.trim();
    const location = locationInput.value.trim();

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
    winnerPopup.style.display = 'none'; // 이전 팝업 숨기기

    try {
        const url = `/api/generate-story?char1=${encodeURIComponent(char1)}&char2=${encodeURIComponent(char2)}&state1=${encodeURIComponent(state1)}&state2=${encodeURIComponent(state2)}&location=${encodeURIComponent(location)}`;
        const response = await fetch(url);

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
            
            // 버퍼에서 줄바꿈(\n\n)을 기준으로 완전한 데이터 덩어리를 찾아 처리
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
                        }
                    }
                }
            }
        }

        // 루프 종료 후 남은 버퍼 처리 (마지막 chunk가 \n\n으로 끝나지 않을 경우)
        if (buffer.length > 0) {
            const chunk = buffer; // 남은 버퍼 전체를 chunk로 취급
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            result.innerHTML += escapeHTML(content);
                            result.scrollTop = result.scrollHeight;
                        }
                    } catch (e) {
                        console.error('JSON 파싱 오류:', e);
                    }
                }
            }
        }

        if (result.innerHTML.trim() === '') {
            result.innerHTML = '캐릭터 분석을 완료하지 못했습니다. 입력을 다시 확인하거나 나중에 시도해주세요.';
        }

        // 스토리 생성 후 승자 파싱 및 팝업 표시
        const fullText = result.textContent;
        const winnerMatch = fullText.match(/승자: (.+)$/);
        if (winnerMatch) {
            const winner = winnerMatch[1].trim();
            winnerText.textContent = `[${winner}] 승리!`;
            winnerPopup.style.display = 'flex';
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
