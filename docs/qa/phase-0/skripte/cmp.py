import re, csv, sys
spec=open('/home/user/GAME_SPEC.md/GAME_SPEC.md',encoding='utf8').read().splitlines()[1090:1220]
rows={}
for l in spec:
    if re.match(r'\| \d{3} ',l):
        c=[x.strip() for x in l.split('|')[1:-1]]
        rows[int(c[0])]=c
csvr=list(csv.DictReader(open('/home/user/GAME_SPEC.md/Data/fish.csv',encoding='utf8'),delimiter=';'))
RAR={'Gewöhnlich':'Gewoehnlich','Ungewöhnlich':'Ungewoehnlich','Selten':'Selten','Episch':'Episch','Legendär · Boss':'Legendaer'}
def num(s): return float(s.replace('.','').replace(',','.'))
issues=[]
for r in csvr:
    n=int(r['nr']); s=rows[n]
    name=s[1].strip('*')
    def bad(f,a,b): issues.append(f"F{n:03d} {f}: CSV={a!r} SPEC={b!r}")
    if r['name_de']!=name: bad('name',r['name_de'],name)
    if r['seltenheit']!=RAR[s[3]]: bad('seltenheit',r['seltenheit'],s[3])
    if (r['boss']=='1')!=('Boss' in s[3]): bad('boss',r['boss'],s[3])
    m=re.match(r'(S|M|L|XL|Boss) (\d+)×(\d+)',s[4])
    if r['groesse']!=m.group(1) or r['canvas']!=f"{m.group(2)}x{m.group(3)}": bad('groesse/canvas',r['groesse']+' '+r['canvas'],s[4])
    lm=re.search(r'([\d.]+)–([\d.]+) cm',s[4])
    if num(r['laenge_min_cm'])!=num(lm.group(1)) or num(r['laenge_max_cm'])!=num(lm.group(2)): bad('laenge',r['laenge_min_cm']+'-'+r['laenge_max_cm'],lm.group(0))
    tm=re.match(r'([\d.]+)–([\d.]+) m',s[5])
    if num(r['tiefe_min_m'])!=num(tm.group(1)) or num(r['tiefe_max_m'])!=num(tm.group(2)): bad('tiefe',r['tiefe_min_m']+'-'+r['tiefe_max_m'],s[5])
    km=re.search(r'K(\d+)',s[7])
    if r['kraft']!=km.group(1): bad('kraft',r['kraft'],s[7])
    if r['punkte']!=s[8]: bad('punkte',r['punkte'],s[8])
    # behaviour
    beh=s[7].split('·')[0].strip()
    first=re.split(r'[ →,+(]',beh.replace('Boss: ',''))[0]
    if r['verhalten']!=first: bad('verhalten',r['verhalten'],beh)
    if '→' in beh and not beh.startswith('Boss'):
        sec=beh.split('→')[1].strip().split(' ')[0]
        if r['verhalten2']!=sec: bad('verhalten2',r['verhalten2'],beh)
    # zeit
    zt=s[6].split('·')[0].strip()
    zeiten=[z for z in ['Morgen','Tag','Abend','Nacht'] if z in zt]
    cz=r['zeit'].split('|') if r['zeit'] else ['Immer']
    if 'Immer' in zt: zeiten=['Immer']
    if sorted(cz)!=sorted(zeiten): bad('zeit',r['zeit'],s[6])
    pfl='Pflicht' in s[6]
    has_pfl = (r['wetter_pflicht'] not in ('','Alle')) or (r['ereignis_pflicht'] not in ('','Keins')) or r['pflicht_oder']!=''
    if pfl!=has_pfl: bad('pflicht',f"wp={r['wetter_pflicht']} ep={r['ereignis_pflicht']} oder={r['pflicht_oder']}",s[6])
    fant = s[2].startswith('Fantasie')
    if (r['fantasie']=='1')!=fant: bad('fantasie',r['fantasie'],s[2])
print('\n'.join(issues) if issues else 'keine Abweichungen'); print(len(csvr),'Zeilen verglichen')
