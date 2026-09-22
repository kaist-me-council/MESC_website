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
          <p className="text-sm">Effective date: September 22, 2026</p>

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

          <h2 id="cancellation-refunds">4. Event cancellations and refunds</h2>
          <ul>
            <li>You may cancel directly under “Check my application” while the application status is “Awaiting payment.”</li>
            <li>After the Council confirms payment, automatic cancellation is unavailable. Contact <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a> before collection or the event begins. Refund eligibility may depend on whether goods have been produced or supplied and whether a service or event has begun.</li>
            <li>Where the Korean Electronic Commerce Consumer Protection Act applies, the statutory withdrawal period is generally seven days from receipt of the contract information or goods. Separate statutory periods apply where goods or services differ from their description or the contract.</li>
            <li>Withdrawal may be restricted where goods are damaged by the consumer, materially lose value through use or time, a service has begun, or made-to-order goods meet the legal requirements for advance notice and separate consent. Mandatory consumer rights prevail over these Terms.</li>
            <li>Where a statutory withdrawal is valid, refunds are made within three business days from the applicable date under the Act. Return costs for a change of mind are generally borne by the applicant; the Council bears them where the goods or services differ from their description or the contract.</li>
          </ul>

          <h2>5. Disclaimer</h2>
          <p>
            Fee payment check results and course reviews are provided for reference only and may
            contain errors. If you find an error, contact the Council at{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>.
          </p>

          <h2>6. Governing law</h2>
          <p>These terms are governed by the laws of the Republic of Korea.</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-2">이용약관</h1>
          <p className="text-sm">시행일: 2026년 9월 22일</p>

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

          <h2 id="cancellation-refunds">제4조 (이벤트 신청 취소 및 환불)</h2>
          <ul>
            <li>신청 상태가 &quot;입금 대기&quot;인 동안에는 &quot;내 신청 확인&quot;에서 신청자가 직접 취소할 수 있습니다.</li>
            <li>학생회가 입금을 확인한 뒤에는 사이트에서 자동 취소할 수 없습니다. 물품 수령 또는 행사 시작 전에 <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>로 문의해 주세요. 제작·공급 진행 여부와 행사·용역 시작 여부 등에 따라 환불 가능 여부와 절차를 안내합니다.</li>
            <li>「전자상거래 등에서의 소비자보호에 관한 법률」이 적용되는 거래는 원칙적으로 계약내용에 관한 서면을 받은 날(재화 공급이 더 늦으면 공급받은 날)부터 7일 이내 청약철회할 수 있습니다. 표시·광고 또는 계약내용과 다르게 이행된 경우에는 법에서 정한 별도 기간이 적용됩니다.</li>
            <li>소비자 책임으로 재화가 훼손되거나 사용·시간 경과로 가치가 현저히 감소한 경우, 용역 제공이 시작된 경우 등에는 청약철회가 제한될 수 있습니다. 주문에 따라 개별 제작되는 재화는 법령상 요건에 맞는 사전 고지와 별도 동의가 있는 경우에만 그 제한이 적용됩니다. 관계 법령의 강행규정이 본 약관보다 우선합니다.</li>
            <li>적법한 청약철회의 환급은 법에서 정한 기산일부터 3영업일 이내 처리합니다. 단순 변심에 따른 반환 비용은 신청자가 부담하고, 표시·광고 또는 계약내용과 다른 이행으로 인한 반환 비용은 학생회가 부담합니다.</li>
          </ul>

          <h2>제5조 (면책)</h2>
          <p>
            과비 조회 결과와 과목 후기는 참고용이며 오류가 있을 수 있습니다. 오류 발견 시
            학생회(
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
            )로 문의해 주세요.
          </p>

          <h2>제6조 (준거법)</h2>
          <p>본 약관은 대한민국 법률을 준거법으로 합니다.</p>
        </>
      )}
    </article>
  );
}
