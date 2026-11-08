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
</div>
`;

export function getSampleHTML(): string {
  return SAMPLE_HTML;
}
