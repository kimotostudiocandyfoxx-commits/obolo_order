import { InviteStory } from './InviteStory';

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InviteStory code={code} />;
}
