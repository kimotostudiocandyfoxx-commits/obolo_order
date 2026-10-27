import re,subprocess,glob,json,difflib,sys,collections
B="origin/claude/solar-system-home-planets-ew766y"
REPO="/home/user/obolo_order"
STORY=sys.argv[1]
def git(p): return subprocess.run(["git","-C",REPO,"show",f"{B}:{p}"],capture_output=True,text=True).stdout
STR=r"'((?:[^'\\]|\\.)*)'"
def unesc(s): return s.replace("\\'","'").replace("\\n","\n")
app=collections.OrderedDict()   # scene -> list of (kind, who, text, day)
for d in range(1,10):
    src=git(f"apps/web/lib/onboarding/day{d}.ts"); scene=f"day{d}-head"
    for ln in src.split("\n"):
        m=re.search(r"//\s*(D0\dV?-S\d+[a-z]?)",ln)
        if m and "t:" not in ln.split("//")[0]: scene=m.group(1)
        code=ln.split("//")[0] if "t:" in ln else ""
        if not code: continue
        m=re.search(r"t:\s*'say'.*?who:\s*"+STR+r".*?text:\s*"+STR,code)
        if m: app.setdefault(scene,[]).append(("say",unesc(m.group(1)),unesc(m.group(2)),d)); continue
        m=re.search(r"t:\s*'(caption|notice)'.*?text:\s*"+STR,code)
        if m: app.setdefault(scene,[]).append((m.group(1),"",unesc(m.group(2)),d)); continue
        m=re.search(r"t:\s*'action'.*?label:\s*"+STR,code)
        if m: app.setdefault(scene,[]).append(("action","",unesc(m.group(1)),d)); continue
        for m in re.finditer(r"label:\s*"+STR,code):
            if "'choice'" in code or "options" in code: app.setdefault(scene,[]).append(("option","",unesc(m.group(1)),d))
# all Japanese string literals in components/lib (lessons live in components)
files=subprocess.run(["git","-C",REPO,"ls-tree","-r","--name-only",B,"apps/web/components","apps/web/lib/onboarding"],capture_output=True,text=True).stdout.split()
extra_texts=[]
for p in files:
    if not p.endswith((".ts",".tsx")) or p.endswith(".test.ts"): continue
    src=git(p)
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`([^`]*)`|>([^<>{}\n]*[\u3040-\u30ff\u4e00-\u9fff][^<>{}\n]*)<",src):
        t=next(g for g in m.groups() if g is not None)
        if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]",t): extra_texts.append((p,unesc(t)))
# script
scr=collections.OrderedDict()
for f in sorted(glob.glob(STORY+"/parts/P0[1-4]/*.md")):
    s=open(f).read()
    for m in re.finditer(r"^### (D0\dV?-S\d+[a-z]?)｜.*?(?=^### |\Z)",s,re.S|re.M):
        b=m.group(0); i=b.find("**本文**"); j=b.find("**選択ごとの行き先"); body=b[i+6:j]
        L=[]
        for ln in body.split("\n"):
            for q in re.finditer(r"([^\s「」〔〕（）［］／]+?)(?:（[^）]*）|〔[^〕]*〕)*「([^」]*)」",ln):
                who=q.group(1)
                if who in ("画面","選択肢","テロップ","手紙","招待状","札"): continue
                L.append(("say",who,q.group(2)))
            for q in re.finditer(r"〔テロップ：([^〕]*)〕",ln): L.append(("caption","",q.group(1)))
        scr[m.group(1)]=L
def norm(t): return re.sub(r"[\s　／/、。…・,.!！?？「」『』〜~ー—]","",t.replace("{neo}","N").replace("{bati}","B"))
report=[]; stats=collections.Counter()
allapp={(norm(x[2])) for v in app.values() for x in v}|{norm(t) for _,t in extra_texts}
comp=[norm(t) for _,t in extra_texts]
for sc,lines in scr.items():
    al=app.get(sc,[]); an=[norm(x[2]) for x in al]
    miss=[];chg=[]
    for k,w,t in lines:
        n=norm(t)
        if not n: continue
        if n in an or n in allapp or any(n in c for c in comp if len(n)>=6): stats["match"]+=1; continue
        best=max(((difflib.SequenceMatcher(None,n,x[2] and norm(x[2])).ratio(),x) for v in app.values() for x in v), default=(0,None))
        if best[0]>=0.6: chg.append((w,t,best[1])); stats["changed"]+=1
        else: miss.append((w,t)); stats["missing"]+=1
    if miss or chg: report.append((sc,miss,chg,sc in app))
# extra in app
scrall={norm(t) for v in scr.values() for _,_,t in v}
extra=collections.OrderedDict()
for sc,v in app.items():
    for k,w,t,d in v:
        if k!="say": continue
        n=norm(t)
        if n in scrall: continue
        best=max((difflib.SequenceMatcher(None,n,x).ratio() for x in scrall),default=0)
        if best<0.6: extra.setdefault(sc,[]).append((w,t,d)); stats["extra"]+=1
# rule checks on app text
rules=[("「ORDER」だけ／OBOLO ORDER",r"(?<!Obolo )(?<!RECORD)ORDER"),("カイザーのDA",r"DA"),("AI",r"(?<![A-Za-z])AI(?![A-Za-z])"),("ピンポン2.5",r"ピンポン2\.5|PINPON")]
viol=[]
for sc,v in app.items():
    for k,w,t,d in v:
        for name,p in rules:
            if re.search(p,t):
                if name=="ピンポン2.5" and d<=2: continue
                viol.append((name,d,sc,w,t))
        if w=="たこ焼きシスター" and re.search(r"(?<!終)わ(?=[。！？、ねよ♪…]|$)",t): viol.append(("シスターの語尾わ",d,sc,w,t))
json.dump({"stats":stats,"report":report,"extra":extra,"viol":viol,"appscenes":list(app.keys()),"scrscenes":list(scr.keys())},open(sys.argv[2],"w"),ensure_ascii=False,default=list,indent=0)
print(dict(stats), "viol",len(viol))
