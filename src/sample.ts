export const SAMPLE_HTML = `<div class="sample" id="sample-app">
  <h1>Mini React Test</h1>
  <p>Virtual DOM Diff 테스트</p>

  <section class="profile">
    <h2>사용자 정보</h2>
    <p>이름: 홍길동</p>
    <p>나이: 25</p>
  </section>

  <ul>
    <li>JavaScript</li>
    <li>React</li>
    <li>HTML</li>
  </ul>

  <section class="settings">
    <h2>환경 설정</h2>

    <p>
      <label for="nickname">닉네임</label>
      <input id="nickname" name="nickname" type="text" value="게스트">
    </p>

    <p>
      <label><input type="checkbox" name="alerts" checked> 알림 받기</label>
    </p>

    <p>
      <label for="bio">자기소개</label>
      <textarea id="bio" name="bio" rows="2">안녕하세요</textarea>
    </p>

    <p>
      <label for="theme">테마</label>
      <select id="theme" name="theme">
        <option value="light">라이트</option>
        <option value="dark" selected>다크</option>
      </select>
    </p>

    <p>
      <label for="stack">관심 기술</label>
      <select id="stack" name="stack" multiple size="3">
        <option value="ts" selected>TypeScript</option>
        <option value="svelte" selected>Svelte</option>
        <option value="rust">Rust</option>
      </select>
    </p>
  </section>
</div>
`;

export function getSampleHTML(): string {
  return SAMPLE_HTML;
}
