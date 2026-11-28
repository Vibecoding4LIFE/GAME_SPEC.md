# Prüft: jedes Spielpixel = exakt z×z gleichfarbige Gerätepixel (Screenshot in Gerätepixeln)
import json, math, sys
from PIL import Image, ImageChops
R=json.load(open('/home/user/GAME_SPEC.md/docs/qa/phase-0/browser-results.json'))
out=[]
for r in R:
    z=r['kk']['layout']['deviceZoom']; gw,gh=r['canvas']['w'],r['canvas']['h']
    im=Image.open(r['shots'][2]).convert('RGB'); W,H=im.size
    px=im.load()
    x0=r['devicePx']['x']; y0=r['devicePx']['y']
    best=None
    for ox in range(-z, z+1):
        for oy in range(-z, z+1):
            bx=math.floor(x0)+ox; by=math.floor(y0)+oy
            bad=0; n=0
            # Stichprobe: jede 3. Spalte/Zeile der Spielpixel
            for gy in range(0,gh,3):
                for gx in range(0,gw,3):
                    X=bx+gx*z; Y=by+gy*z
                    if X<0 or Y<0 or X+z>W or Y+z>H: continue
                    c=px[X,Y]; n+=1
                    if any(px[X+i,Y+j]!=c for i in range(z) for j in range(z)): bad+=1
            if n and (best is None or bad/n<best[0]): best=(bad/n,ox,oy,n,bad)
    # Vollprüfung mit bestem Offset
    _,ox,oy,_,_=best; bx=math.floor(x0)+ox; by=math.floor(y0)+oy
    bad=0;n=0;badcols=set();badrows=set()
    for gy in range(gh):
        for gx in range(gw):
            X=bx+gx*z; Y=by+gy*z
            if X<0 or Y<0 or X+z>W or Y+z>H: continue
            c=px[X,Y]; n+=1
            if any(px[X+i,Y+j]!=c for i in range(z) for j in range(z)):
                bad+=1; badcols.add(gx); badrows.add(gy)
    # Bewegung: Differenz zwischen Screenshot a und b
    a=Image.open(r['shots'][0]).convert('RGB'); b=Image.open(r['shots'][1]).convert('RGB')
    diff=ImageChops.difference(a,b).convert('L').point(lambda v:255 if v else 0)
    moved=sum(1 for v in diff.getdata() if v)
    # Ausschnitt 2×2-Detail speichern (Fisch-Ausschnitt, 8× nearest für Sichtprüfung)
    # Lauflängen-Analyse: in jeder Zeile (Mitte jedes Spielpixels) müssen Farb-Läufe Vielfache von z sein
    runs_bad=0; runs=0; hist={}
    for gy in range(0,gh,4):
        Y=by+gy*z+z//2
        if Y>=H: continue
        xs=max(0,math.ceil(x0)); xe=min(W,int(x0+r['devicePx']['w']))
        prev=px[xs,Y]; L=1; first=True
        for X in range(xs+1,xe):
            c=px[X,Y]
            if c==prev: L+=1; continue
            if not first:
                runs+=1; hist[L%z]=hist.get(L%z,0)+1
                if L%z: runs_bad+=1
            first=False; prev=c; L=1
    line=f"{r['profile']}: zoom={z} canvasDev=({x0:.3f},{y0:.3f}) offset=({ox},{oy}) Bloecke={n} uneinheitlich={bad} ({100*bad/max(n,1):.3f}%) Spalten={len(badcols)} Zeilen={len(badrows)} bewegtePixel={moved} ({100*moved/(a.width*a.height):.2f}%) | Lauflaengen: {runs} innere Laeufe, {runs_bad} kein Vielfaches von {z} ({100*runs_bad/max(runs,1):.2f}%) Rest {dict(sorted(hist.items()))}"
    print(line); out.append(line)
open('/home/user/GAME_SPEC.md/docs/qa/phase-0/grid-check.txt','w').write('\n'.join(out)+'\n')
