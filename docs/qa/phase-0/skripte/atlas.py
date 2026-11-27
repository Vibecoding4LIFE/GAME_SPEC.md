import json,os
from PIL import Image
R='/home/user/GAME_SPEC.md'
db=json.load(open(R+'/public/data/fish_db.json'))
fish=db['fish']
tot_err=0
for k in ['see','riff','fjord','tiefe','grotte']:
    a=json.load(open(f'{R}/public/assets/fish/{k}/atlas_fish_{k}.json'))
    im=Image.open(f'{R}/public/assets/fish/{k}/atlas_fish_{k}.png'); 
    fr=a['frames']; meta=a.get('meta',{})
    wf=[f for f in fish if f['weltKuerzel']==k]
    errs=[]
    rects=[]
    for f in wf:
        ak=f['assetKey']; W,H=f['groesse']['canvas']; S=f['groesse']['klasse']=='S'
        need=[f'swim_{i}' for i in range(4 if S else 6)]+[f'idle_{i}' for i in range(4)]+[f'struggle_{i}' for i in range(4)]+[f'caught_{i}' for i in range(3)]+['silhouette_0']
        if f['art']['leuchtet']: need.append('emission_0')
        for n in need:
            e=fr.get(f'{ak}_{n}')
            if not e: errs.append(f"{f['id']} fehlt {n}"); continue
            ss=e['sourceSize']
            if (ss['w'],ss['h'])!=(W,H): errs.append(f"{f['id']} {n} sourceSize {ss}")
            rects.append(e['frame'])
        extra=[x for x in fr if x.startswith(ak+'_') and x[len(ak)+1:] not in need]
        if extra: errs.append(f"{f['id']} extra {extra[:3]}")
    # padding: min gap between frame rects
    mingap=99
    rs=sorted(rects,key=lambda r:(r['y'],r['x']))
    for i,r in enumerate(rs):
        for s in rs[i+1:i+40]:
            # horizontal gap if vertically overlapping
            if not (s['y']>=r['y']+r['h'] or r['y']>=s['y']+s['h']):
                g = s['x']-(r['x']+r['w']) if s['x']>=r['x'] else r['x']-(s['x']+s['w'])
                if g>=0: mingap=min(mingap,g)
    # alpha binary
    al=set(im.convert('RGBA').getchannel('A').getdata())
    print(k, im.size, im.mode, 'frames',len(fr),'fische',len(wf),'leuchtend',sum(f['art']['leuchtet'] for f in wf),'min H-Abstand',mingap,'alpha',sorted(al)[:3],'..', 'meta.clips',meta.get('clips'), 'fehler',len(errs), errs[:5])
    tot_err+=len(errs)
print('gesamt fehler',tot_err)
