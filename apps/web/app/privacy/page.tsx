import { PRIVACY_TITLE } from '@obolo/shared';
import { LegalPage } from '@/components/LegalPage';

export const metadata = { title: PRIVACY_TITLE };

/** 〔プライバシーについて〕 (M-R252, draft — P-LEGAL-1) */
export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
