import { TERMS_TITLE } from '@obolo/shared';
import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: TERMS_TITLE };

/** 〔利用規約〕 (M-R252, draft — P-LEGAL-1) */
export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
