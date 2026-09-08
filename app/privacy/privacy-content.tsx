"use client";

import { useLanguage } from "@/lib/language-context";

const EMAIL = "kaist.mesc@gmail.com";

export function PrivacyContent() {
  const { lang } = useLanguage();

  return (
    <article className="container mx-auto px-4 py-12 max-w-3xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:text-muted-foreground">
      {lang === "en" ? (
        <>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm">Effective date: September 8, 2026</p>

          <h2>1. Operator</h2>
          <p>
            This website is operated by the KAIST Mechanical Engineering Student Council (the
            &quot;Council&quot;). Contact: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
          </p>

          <h2>2. What we collect and why</h2>
          <ol>
            <li>
              <strong>Fee payment check (/check-fee)</strong>: the student ID you enter is compared
              against the payment list in Google Sheets. It is not stored or logged on the server;
              only the result (payment count) is shown.
            </li>
            <li>
              <strong>Anonymous board, comments, course reviews, suggestions, reports
              (/community, /courses)</strong>: the content you post, an anonymous author tag, and a
              one-way salted hash of your IP address (the original IP is never stored) — used to
              prevent abuse and duplicate reports. Course reviews also store a nickname and a hashed
              password for editing/deleting.
            </li>
            <li>
              <strong>Suggestion box</strong>: contact details (email, phone, etc.) you optionally
              provide — used only to reply, viewable only by Council administrators, and deleted
              without delay once answered.
            </li>
            <li>
              <strong>Event feedback and snack requests</strong>: the content only.
            </li>
            <li>
              <strong>Notification subscriptions</strong>: if you turn on notice alerts, we store the
              subscription address issued by your browser&apos;s push service, its encryption keys, and
              the browser/device string — used only to deliver notice alerts. Turning alerts off
              deletes it immediately.
            </li>
            <li>
              <strong>View counts and likes</strong>: to count each reader once and allow one like per
              person, we store a visitor identifier (see section 3) as a one-way hash. We do not
              store who read what in an identifiable form.
            </li>
            <li>
              <strong>Administrator accounts and activity logs</strong>: Council staff usernames and
              hashed passwords, plus a record of administrator actions (who changed or deleted what,
              and when). Activity logs never contain personal data itself.
            </li>
            <li>
              <strong>Council event sign-ups and purchases (/apply, /shop)</strong>: affiliation, name,
              email, phone, selected items and payment/pickup/reply status — used to run the event,
              hand over goods, refund, or exchange.
              Student IDs are stored only as a salted one-way hash for identity matching; the
              original ID is never stored. Contact details are visible only to Council administrators.
            </li>
          </ol>

          <h2>3. Third-party services</h2>
          <ul>
            <li>Vercel — hosting and image storage</li>
            <li>Turso — database</li>
            <li>Google — Sheets (fee payment list), Drive (photos), Calendar</li>
          </ul>
          <p>Cookies we use:</p>
          <ul>
            <li>
              <strong>Visitor identifier (mesc_vid)</strong> — issued to every visitor, kept for up to
              one year. It is a random value that is not tied to your name, student ID or account,
              and it exists only so that a view is counted once and a like counts once per person.
              It is stored in our database only as a one-way hash.
            </li>
            <li>
              <strong>Administrator session cookie</strong> — only for Council staff who log in.
            </li>
          </ul>
          <p>
            We use no advertising or tracking cookies, no third-party analytics, and we do not build
            profiles of visitors or share any of this with advertisers.
          </p>

          <h2>4. Retention</h2>
          <ul>
            <li>IP hashes are automatically deleted 90 days after posting, and together with the post if it is removed. Report records are deleted after 180 days.</li>
            <li>Suggestion box contact details are automatically deleted within 30 days after a reply is sent.</li>
            <li>Student IDs entered for the fee check are never stored.</li>
            <li>Event sign-up and purchase records: personal fields (name, student-ID hash, email, phone, depositor name, messages) are anonymized 180 days after the event closes; only item, amount and status data are kept for statistics.</li>
            <li>Read records used for view-count de-duplication are deleted after 90 days; only the cumulative number remains. Like records are removed when the post is removed.</li>
            <li>Notification subscriptions are deleted as soon as you turn alerts off, and automatically after five consecutive delivery failures or 180 days without a successful delivery.</li>
            <li>Administrator activity logs are deleted after 180 days.</li>
            <li>The visitor identifier cookie expires one year after it is issued.</li>
          </ul>

          <h2>5. Your rights</h2>
          <p>
            To request deletion of your own post, email us at the address above; requests are
            handled without delay. This site is intended for university students and does not
            collect data from children under 14.
          </p>

          <h2>6. Privacy officer</h2>
          <p>
            Privacy officer: President, Mechanical Engineering Student Council. Inquiries:{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
          <p className="text-sm">시행일: 2026년 9월 8일</p>

          <h2>제1조 (운영주체)</h2>
          <p>
            본 웹사이트는 KAIST 기계공학과 학생회(이하 &quot;학생회&quot;)가 운영합니다. 문의:{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
          </p>

          <h2>제2조 (수집 항목 및 목적)</h2>
          <ol>
            <li>
              <strong>과비 납부 확인(/check-fee)</strong>: 입력한 학번을 Google Sheets의 납부
              명단과 대조합니다. 학번은 서버에 저장·기록되지 않으며 결과(납부 횟수)만 표시됩니다.
            </li>
            <li>
              <strong>익명 게시판·댓글·과목 후기·건의함·신고(/community, /courses)</strong>: 게시
              내용, 익명 작성자 태그, IP 주소의 일방향 해시(salt 포함, 원본 IP 미저장)를
              어뷰징·중복 신고 방지 목적으로 수집합니다. 과목 후기는 닉네임과 수정·삭제용
              비밀번호(해시 저장)를 추가로 수집합니다.
            </li>
            <li>
              <strong>건의함</strong>: 이용자가 선택적으로 입력한 연락처(이메일·전화 등)는 답변
              목적으로만 사용하며, 학생회 관리자만 열람하고 답변 완료 후 30일 이내 자동 파기합니다.
            </li>
            <li>
              <strong>행사 피드백·간식 희망</strong>: 작성 내용만 수집합니다.
            </li>
            <li>
              <strong>공지 알림 구독</strong>: 알림 받기를 켜면 브라우저 푸시 서비스가 발급한 구독
              주소와 암호화 키, 브라우저·기기 종류를 저장하며 공지 알림 발송에만 사용합니다. 알림을
              끄면 즉시 삭제합니다.
            </li>
            <li>
              <strong>조회수·좋아요</strong>: 같은 사람의 조회를 한 번만 세고 좋아요를 1인 1표로
              처리하기 위해 제3조의 방문자 식별값을 일방향 해시로 저장합니다. 누가 무엇을 읽었는지를
              식별 가능한 형태로 저장하지 않습니다.
            </li>
            <li>
              <strong>관리자 계정 및 작업 기록</strong>: 학생회 운영진의 아이디와 비밀번호 해시,
              그리고 관리자가 무엇을 언제 변경·삭제했는지에 대한 기록을 저장합니다. 작업 기록에는
              개인정보 원문을 남기지 않습니다.
            </li>
            <li>
              <strong>학생회 이벤트 신청·구매(/apply, /shop)</strong>: 구분, 이름, 이메일, 전화번호,
              선택 항목, 입금·수령·회신 상태를 행사 운영·물품 전달·환불·교환 목적으로 수집합니다. 학번은 본인 대조용 일방향
              해시(salt 포함)로만 저장하며 원문은 저장하지 않습니다. 연락처는 학생회 관리자만 열람합니다.
            </li>
          </ol>

          <h2>제3조 (제3자 서비스 및 쿠키)</h2>
          <ul>
            <li>Vercel — 호스팅·이미지 저장</li>
            <li>Turso — 데이터베이스</li>
            <li>Google — Sheets(과비 명단), Drive(사진), Calendar</li>
          </ul>
          <p>사용하는 쿠키는 다음과 같습니다.</p>
          <ul>
            <li>
              <strong>방문자 식별 쿠키(mesc_vid)</strong> — 모든 방문자에게 발급되며 최대 1년간
              보관합니다. 이름·학번·계정과 연결되지 않는 임의의 값으로, 조회수를 한 번만 세고
              좋아요를 1인 1표로 처리하기 위해서만 사용합니다. 데이터베이스에는 원문이 아닌
              일방향 해시로만 저장합니다.
            </li>
            <li>
              <strong>관리자 로그인 세션 쿠키</strong> — 학생회 운영진이 로그인할 때만 사용합니다.
            </li>
          </ul>
          <p>
            광고·추적 쿠키와 외부 분석 도구는 사용하지 않으며, 방문자의 이용 기록을 프로파일로
            만들거나 광고 목적으로 제3자에게 제공하지 않습니다.
          </p>

          <h2>제4조 (보유 및 이용 기간)</h2>
          <ul>
            <li>IP 해시는 작성일로부터 90일 후 자동 삭제되며, 게시물 삭제 시 함께 삭제됩니다. 신고 기록은 180일 후 삭제됩니다.</li>
            <li>건의함 연락처는 답변 완료 후 30일 이내 자동 파기합니다.</li>
            <li>과비 확인용 학번은 저장하지 않습니다.</li>
            <li>이벤트 신청·구매 기록은 캠페인 마감 후 180일(정산 완료) 지나면 개인정보 항목(이름·학번 해시·이메일·전화·입금자명·메모)을 익명화하며, 항목·금액·상태 등 통계 정보만 남깁니다.</li>
            <li>조회수 중복 판정을 위한 열람 기록은 90일 후 삭제하며 누적 조회수만 남습니다. 좋아요 기록은 해당 게시물이 삭제될 때 함께 삭제됩니다.</li>
            <li>공지 알림 구독 정보는 이용자가 알림을 끄면 즉시 삭제하고, 발송이 연속 5회 실패하거나 180일간 한 번도 성공하지 못하면 자동 삭제합니다.</li>
            <li>관리자 작업 기록은 180일 후 자동 삭제합니다.</li>
            <li>방문자 식별 쿠키는 발급일로부터 1년 후 만료됩니다.</li>
          </ul>

          <h2>제5조 (이용자의 권리)</h2>
          <p>
            본인 게시물의 삭제는 위 이메일로 요청하실 수 있으며 지체 없이 처리합니다. 본 사이트는
            대학생을 대상으로 하며 만 14세 미만 아동의 개인정보를 수집하지 않습니다.
          </p>

          <h2>제6조 (개인정보 보호책임자)</h2>
          <p>
            개인정보 보호책임자: 기계공학과 학생회장. 문의:{" "}
            <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>
          </p>
        </>
      )}
    </article>
  );
}
