'use client';

import { isFlying, type SaturnPostView } from '@obolo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import { stopAudio, subscribeAudio, toggleAudio } from '@/lib/audio';
import { useAuth } from '@/lib/auth';
import { WorkSafety } from '@/components/planets/WorkSafety';
import { KororinRecord } from './KororinRecord';

const HALL = '/onboarding/s/saturn-hall-kororin.jpg';
const PLAZA = '/onboarding/s/saturn-plaza-kororin.jpg';

/**
 * /saturn (M-R208, client decision): a flown kororin spins on the giant DJ record that everyone on Saturn sees, for
 * 88 hours; 〔サイファー〕 passes the mic round the record, one after another. After 88 hours it goes back to its
 * maker's own record (自分のレコード, in the temple hall). Saturn is for listening only: kororins are made in the
 * Moon atelier, so there is no 〔つぶやく〕 here any more.
 */
export function SaturnHome() {
  const { me } = useAuth();
  const [where, setWhere] = useState<'record' | 'mine'>('record');
  const [everyone, setEveryone] = useState<SaturnPostView[] | null>(null);
  const [mine, setMine] = useState<SaturnPostView[]>([]);
  const [singing, setSinging] = useState<string | null>(null);
  const [cipher, setCipher] = useState(false);
  // the kororin tapped last on everyone's record (a stranger's gets 〔通報〕〔見えなくする〕, M-R213)
  const [picked, setPicked] = useState<SaturnPostView | null>(null);
  const queue = useRef<SaturnPostView[]>([]);
  const current = useRef<SaturnPostView | null>(null);

  useEffect(() => {
    if (!me) return;
    getApi()
      .saturnFeed(undefined, true, 'all', 50)
      .then((p) => setEveryone(p.items))
      .catch(() => setEveryone([]));
    getApi()
      .saturnUserPosts(me.id)
      .then((p) => setMine(p.items.filter((x) => !x.replyToId)))
      .catch(() => setMine([]));
  }, [me]);

  const sing = useCallback((p: SaturnPostView) => {
    if (!p.voiceUrl) return;
    current.current = p;
    setSinging(p.id);
    void toggleAudio(p.voiceUrl).catch(() => setSinging(null));
  }, []);

  // one voice ends → the cipher hands the mic to the next kororin on the record
  useEffect(
    () =>
      subscribeAudio((st) => {
        if (st.playing) return;
        const ended = st.progress >= 0.97;
        const next = ended ? queue.current.shift() : undefined;
        if (next) return sing(next);
        if (ended || !current.current || st.url === current.current.voiceUrl) {
          setSinging(null);
          setCipher(false);
          queue.current = [];
        }
      }),
    [sing],
  );
  useEffect(() => () => stopAudio(), []);

  const home = mine.filter((p) => p.room || !isFlying(p.createdAt));
  const myFlying = mine.some((p) => !p.room && isFlying(p.createdAt));
  const onRecord = where === 'record' ? (everyone ?? []) : home;

  const startCipher = () => {
    if (cipher) {
      queue.current = [];
      stopAudio();
      return;
    }
    // oldest first, so the newest one closes the round
    const round = [...onRecord].filter((p) => p.voiceUrl).reverse();
    if (!round.length) return;
    setCipher(true);
    queue.current = round.slice(1);
    sing(round[0]);
  };

  return (
    <div className="relative h-full overflow-hidden bg-[#2a1d4a] text-white">
      {/* the existing Saturn art behind the record: the plaza for everyone's, the temple hall for yours */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={where === 'record' ? PLAZA : HALL} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1b1236]/70 via-transparent to-[#1b1236]/80" aria-hidden />

      <div className="relative z-10 flex h-full flex-col items-center px-4 pb-28 pt-4">
        <h1 className="rounded-full bg-black/35 px-4 py-1 text-sm font-black tracking-widest backdrop-blur">{where === 'record' ? 'みんなのレコード' : '自分のレコード'}</h1>
        <p className="mt-1.5 max-w-xs text-center text-[11px] leading-relaxed text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
          {where === 'record' ? '飛ばしたコロリンは、88時間ここで回る。タップで聴く。' : '88時間回ったコロリンは、ここに帰ってくる。'}
        </p>

        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <KororinRecord
            posts={onRecord}
            myId={me?.id}
            singingId={singing}
            own={where === 'mine'}
            onTap={(p) => {
              setPicked(p);
              sing(p);
            }}
          />
        </div>

        {where === 'record' && picked && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-1">
            <WorkSafety
              key={picked.id}
              kind="saturn_post"
              id={picked.id}
              authorId={picked.author.id}
              onHidden={(id) => {
                setEveryone((l) => l?.filter((x) => x.id !== id) ?? l);
                setTimeout(() => setPicked(null), 1600);
              }}
            />
          </div>
        )}
        {where === 'record' && everyone !== null && everyone.length === 0 && (
          <p className="absolute inset-x-8 top-[46%] rounded-2xl bg-black/45 px-4 py-3 text-center text-sm font-bold text-white/90 backdrop-blur">いま、レコードで回っているコロリンはいない。</p>
        )}
        {where === 'mine' && !home.length && (
          <p className="absolute inset-x-8 top-[46%] rounded-2xl bg-black/45 px-4 py-3 text-center text-sm font-bold text-white/90 backdrop-blur">
            {myFlying ? 'あなたのコロリンは、いま、みんなのレコードで回っている。' : 'まだ、帰ってきたコロリンはいない。'}
          </p>
        )}
        {where === 'mine' && !!home.length && myFlying && <p className="text-center text-[11px] text-amber-100/90">あなたのコロリンが、みんなのレコードでも回っている</p>}
      </div>

      <div className="pb-safe absolute inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4">
        <div className="flex items-center gap-1 rounded-[30px] bg-white/95 px-2 py-2 shadow-[0_8px_30px_rgba(80,30,130,.25)]">
          <button onClick={() => setWhere('record')} className={`flex h-12 w-24 flex-col items-center justify-center rounded-2xl text-[12px] font-black ${where === 'record' ? 'bg-violet-100 text-violet-700' : 'text-[#6b5a8a]'}`}>
            みんなの
            <br />
            レコード
          </button>
          <button
            onClick={startCipher}
            className="flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#f39bd0] to-[#c3a2ff] px-6 text-base font-black text-white shadow-[0_4px_0_rgba(160,90,200,.35)]"
          >
            {cipher ? 'とめる' : 'サイファー'}
          </button>
          <button onClick={() => setWhere('mine')} className={`flex h-12 w-24 flex-col items-center justify-center rounded-2xl text-[12px] font-black ${where === 'mine' ? 'bg-violet-100 text-violet-700' : 'text-[#6b5a8a]'}`}>
            自分の
            <br />
            レコード
          </button>
        </div>
      </div>
    </div>
  );
}
