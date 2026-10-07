'use client';

import { SATURN_LIFETIME_HOURS, type SaturnPostView, type SaturnProfileView } from '@obolo/shared';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { residentProfile, SATURN_RESIDENTS } from '@/lib/saturnResidents';
import { PuniAvatar } from '@/components/puni/PuniAvatar';
import { PuniPicMaker } from '@/components/puni/PuniPicMaker';
import { hueOf } from './BallAvatar';

/**
 * Someone's Saturn page (P-SAT-6). The header art is drawn in code in the same touch as the
 * ころりん world (pastel night sky, striped planet, rings): the person's ball sits on their own
 * little planet. Below: name, bio, counts, follow, and their voices (tap to listen).
 */
export function SaturnProfile({
  userId,
  playingUrl,
  onClose,
  onOpenPost,
}: {
  userId: string;
  playingUrl: string | null;
  onClose: () => void;
  /** open one of their posts in the world's speech card (replies, quote …) */
  onOpenPost: (p: SaturnPostView) => void;
}) {
  const { me, setMe } = useAuth();
  const resident = userId.startsWith('resident-');
  const [profile, setProfile] = useState<SaturnProfileView | null>(resident ? residentProfile(userId) : null);
  const [posts, setPosts] = useState<SaturnPostView[]>(resident ? SATURN_RESIDENTS.filter((p) => p.author.id === userId) : []);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [maker, setMaker] = useState(false);
  const [bounce, setBounce] = useState<number>();

  useEffect(() => {
    if (resident) return;
    let on = true;
    Promise.all([getApi().saturnProfile(userId), getApi().saturnUserPosts(userId)])
      .then(([p, list]) => {
        if (!on) return;
        setProfile(p);
        setPosts(list.items);
      })
      .catch(() => on && setErr(true));
    return () => {
      on = false;
    };
  }, [userId, resident]);

  const follow = async () => {
    if (!profile || resident) return;
    setBusy(true);
    try {
      setProfile(await getApi().followSaturnUser(userId, !profile.followedByMe));
    } catch {
      /* keep the old state */
    } finally {
      setBusy(false);
    }
  };

  const saveBio = async () => {
    setBusy(true);
    try {
      const u = await getApi().updateMe({ bio: bio.trim() });
      setMe(u);
      setProfile((p) => (p ? { ...p, user: { ...p.user, bio: u.bio } } : p));
      setEditing(false);
    } catch {
      /* stay in edit mode */
    } finally {
      setBusy(false);
    }
  };

  const u = profile?.user;
  const hue = hueOf(userId);

  return (
    <div className="absolute inset-0 z-[96] flex flex-col overflow-y-auto bg-[#fff7fb] text-slate-800 animate-[fadeUp_0.25s_ease-out]">
      {/* header art: their own little planet */}
      <div className="relative h-[250px] shrink-0 overflow-hidden">
        <ProfileArt hue={hue} />
        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-4">
          <button onClick={onClose} className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-lg font-black text-violet-600 shadow" aria-label="back">
            ←
          </button>
          {resident && <span className="mt-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-violet-500">サンプルの住人</span>}
        </div>
        <button onClick={() => setBounce(Date.now())} className="absolute bottom-[44px] left-1/2 -translate-x-1/2 animate-[bob_3s_ease-in-out_infinite]" aria-label="squish">
          {u && <PuniAvatar seed={u.id} neo={u.neoForm} look={u.look} pic={u.pic} size={110} bounce={bounce} speaking={!!playingUrl && posts.some((p) => p.voiceUrl === playingUrl)} />}
        </button>
      </div>

      {/* sheet */}
      <div className="relative -mt-6 flex-1 rounded-t-[28px] bg-white px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 shadow-[0_-8px_30px_rgba(160,90,200,.15)]">
        {!profile && !err && <p className="py-10 text-center text-sm text-violet-400">よみこみ中…</p>}
        {err && <p className="py-10 text-center text-sm text-rose-400">ページを開けなかった…</p>}
        {u && profile && (
          <>
            <div className="text-center">
              <p className="text-xl font-black">{u.displayName}</p>
              <p className="text-xs text-slate-400">@{u.handle}</p>
            </div>

            {editing ? (
              <div className="mt-3">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  className="h-20 w-full resize-none rounded-2xl bg-violet-50 p-3 text-[16px] outline-none"
                  placeholder="ひとこと自己紹介（160文字まで）"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 rounded-full bg-violet-50 py-2 text-xs font-bold text-violet-500">
                    やめる
                  </button>
                  <button onClick={() => void saveBio()} disabled={busy} className="flex-1 rounded-full bg-violet-500 py-2 text-xs font-bold text-white disabled:opacity-50">
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-center text-sm leading-relaxed text-slate-600">{u.bio || (profile.isMe ? 'まだ自己紹介がないよ' : '')}</p>
            )}

            <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-violet-50/70 py-2.5 text-center">
              {(
                [
                  ['声', profile.postCount],
                  ['フォロワー', profile.followers],
                  ['フォロー', profile.following],
                  ['もらった星', profile.stars],
                ] as const
              ).map(([label, n]) => (
                <div key={label}>
                  <p className="text-base font-black text-violet-700">{n}</p>
                  <p className="text-[10px] font-bold text-violet-400">{label}</p>
                </div>
              ))}
            </div>

            {profile.isMe && !editing && (
              <button onClick={() => setMaker(true)} className="mt-3 w-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400 py-2.5 text-sm font-black text-white shadow">
                🎨 キャラを描いてもらう
              </button>
            )}
            {profile.isMe ? (
              !editing && (
                <button
                  onClick={() => {
                    setBio(u.bio ?? me?.bio ?? '');
                    setEditing(true);
                  }}
                  className="mt-3 w-full rounded-full border-2 border-violet-200 py-2.5 text-sm font-bold text-violet-600"
                >
                  ✏️ 自己紹介を書く
                </button>
              )
            ) : (
              <button
                onClick={() => void follow()}
                disabled={busy || resident}
                className={`mt-3 w-full rounded-full py-2.5 text-sm font-black disabled:opacity-60 ${
                  profile.followedByMe ? 'border-2 border-violet-200 bg-white text-violet-600' : 'bg-gradient-to-r from-pink-400 to-violet-400 text-white shadow'
                }`}
              >
                {resident ? 'サンプルの住人はフォローできません' : profile.followedByMe ? '✓ フォロー中' : '＋ フォローする'}
              </button>
            )}

            <p className="mb-2 mt-5 text-xs font-black text-violet-500">🎙 {u.displayName}の声</p>
            {!posts.length && <p className="py-6 text-center text-xs text-slate-400">まだ声がないよ</p>}
            <div className="space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="flex items-start gap-2 rounded-2xl bg-violet-50/60 p-3">
                  <button
                    onClick={() => void toggleAudio(p.voiceUrl).catch(() => undefined)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow ${playingUrl === p.voiceUrl ? 'bg-pink-400' : 'bg-violet-400'}`}
                    aria-label="play"
                  >
                    {playingUrl === p.voiceUrl ? '❚❚' : '▶'}
                  </button>
                  <button onClick={() => onOpenPost(p)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-bold leading-snug">{p.text}</p>
                    <p className="text-[10px] text-pink-400">のこり{Math.max(0, Math.floor(SATURN_LIFETIME_HOURS - (Date.now() - new Date(p.createdAt).getTime()) / 3600_000))}時間で消える</p>
                    {p.repostOf && (
                      <p className="mt-1 truncate rounded-xl bg-white/80 px-2 py-1 text-[11px] text-slate-500">
                        🔁 {p.repostOf.author.displayName}「{p.repostOf.text}」
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">
                      ★ {p.starCount} ・ 💬 {p.replyCount ?? 0} ・ 🔁 {p.repostCount ?? 0} ・ {new Date(p.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {maker && profile && (
        <PuniPicMaker
          onClose={() => setMaker(false)}
          onSaved={(pic) => {
            setProfile((p) => (p ? { ...p, user: { ...p.user, pic } } : p));
            setMaker(false);
            setBounce(Date.now());
          }}
        />
      )}
    </div>
  );
}

/** The profile header picture, in the ころりん touch: sky, stars, their own small ringed planet. */
function ProfileArt({ hue }: { hue: number }) {
  // the same peach / pink stripes as the ころりん planet, tinted a little per person
  const stripe = (l: number) => `hsl(${(330 + (hue % 50)) % 360} 85% ${l}%)`;
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="pf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1b5c" />
          <stop offset=".55" stopColor="#6b3fa3" />
          <stop offset="1" stopColor="#f4a3c4" />
        </linearGradient>
        <pattern id="pf-stripes" width="400" height="24" patternUnits="userSpaceOnUse">
          <rect width="400" height="6" fill={stripe(88)} />
          <rect y="6" width="400" height="6" fill={stripe(82)} />
          <rect y="12" width="400" height="6" fill={stripe(78)} />
          <rect y="18" width="400" height="6" fill={stripe(86)} />
        </pattern>
        <radialGradient id="pf-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#pf-sky)" />
      {/* stars */}
      {Array.from({ length: 28 }, (_, i) => {
        const x = (i * 137 + hue * 3) % 400;
        const y = (i * 61) % 150;
        const r = i % 5 === 0 ? 1.8 : 1;
        return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.4 + ((i * 7) % 6) / 10} className="animate-[twinkle_3s_ease-in-out_infinite]" style={{ animationDelay: `${(i % 7) * 0.4}s` }} />;
      })}
      {/* a far moon */}
      <circle cx="330" cy="58" r="16" fill="#ffe6a8" opacity=".85" />
      <circle cx="336" cy="54" r="16" fill="#6b3fa3" opacity=".35" />
      {/* their little planet: rings behind, striped body, rings in front */}
      <ellipse cx="200" cy="250" rx="230" ry="40" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />
      <ellipse cx="200" cy="300" rx="170" ry="120" fill="url(#pf-stripes)" />
      <ellipse cx="200" cy="300" rx="170" ry="120" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
      <ellipse cx="200" cy="196" rx="90" ry="14" fill="url(#pf-glow)" />
      <path d="M -30 236 Q 200 300 430 236" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" />
      {/* tiny flowers / pebbles on the surface */}
      <circle cx="120" cy="206" r="4" fill="#fff" opacity=".8" />
      <circle cx="282" cy="210" r="3" fill="#ffd1e6" />
      <circle cx="300" cy="214" r="2" fill="#fff" opacity=".7" />
    </svg>
  );
}
