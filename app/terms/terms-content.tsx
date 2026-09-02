"use client";

import { useLanguage } from "@/lib/language-context";

const EMAIL = "kaist.mesc@gmail.com";

export function TermsContent() {
  const { lang } = useLanguage();

  return (
    <article className="container mx-auto px-4 py-12 max-w-3xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-muted-foreground">
      {lang === "en" ? (
        <>
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm">Effective date: September 2, 2026</p>

          <h2>1. Purpose</h2>
          <p>
            This website is operated by the KAIST Mechanical Engineering Student Council (the
            &quot;Council&quot;) to share Council information and provide a community space for
            students of the department.
          </p>

          <h2>2. Community rules</h2>
          <p>When using the board, comments, course reviews, and suggestion box, you must not:</p>
          <ul>
            <li>defame, harass, or insult others;</li>
            <li>expose personal information of yourself or others;</li>
            <li>post commercial advertisements or spam.</li>
          </ul>
          <p>
            Administrators may delete violating content, and posts that accumulate reports are
            hidden automatically.
          </p>

          <h2>3. Copyright</h2>
          <p>
            Rights to user posts belong to their authors. Other site content (notices, resources,
            design) belongs to the Council.
          </p>

          <h2>4. Disclaimer</h2>
          <p>
            Fee payment check results and course reviews are provided for reference only and may
            contain errors. If you find an error, contact the Council at{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>.
          </p>

          <h2>5. Governing law</h2>
          <p>These terms are governed by the laws of the Republic of Korea.</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-2">이용약관</h1>
          <p className="text-sm">시행일: 2026년 9월 2일</p>

          <h2>제1조 (목적)</h2>
          <p>
            본 웹사이트는 KAIST 기계공학과 학생회(이하 &quot;학생회&quot;)가 학생회 정보 제공과
            학과 구성원 커뮤니티를 위해 운영합니다.
          </p>

          <h2>제2조 (게시판 이용 규칙)</h2>
          <p>게시판·댓글·과목 후기·건의함 이용 시 다음 행위를 금지합니다.</p>
          <ul>
            <li>타인 비방·괴롭힘·모욕</li>
            <li>본인 또는 타인의 개인정보 노출</li>
            <li>상업 광고·스팸 게시</li>
          </ul>
          <p>위반 게시물은 관리자가 삭제할 수 있으며, 신고가 누적된 게시물은 자동으로 숨겨집니다.</p>

          <h2>제3조 (저작권)</h2>
          <p>
            이용자 게시물의 권리는 작성자에게 있습니다. 그 외 사이트 콘텐츠(공지·자료·디자인)의
            권리는 학생회에 있습니다.
          </p>

          <h2>제4조 (면책)</h2>
          <p>
            과비 조회 결과와 과목 후기는 참고용이며 오류가 있을 수 있습니다. 오류 발견 시
            학생회(
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
            )로 문의해 주세요.
          </p>

          <h2>제5조 (준거법)</h2>
          <p>본 약관은 대한민국 법률을 준거법으로 합니다.</p>
        </>
      )}
    </article>
  );
}
