"""Export an example team-report model as a one-page Letter PDF."""
import base64, io, json, re
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader

root = Path(__file__).resolve().parent.parent
folder = root / 'output/pdf'
r = json.loads((folder / 'team-results-example.json').read_text(encoding='utf-8'))
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
navy, muted, line = '#172033', '#465469', '#b9c0c9'
c = canvas.Canvas(str(folder / 'team-results-example.pdf'), pagesize=letter)
c.setTitle(r['patchName'] + ' - Team Results')
def clean(text):
    text = str(text).replace('🎤', 'Roleplay').replace('⭐', 'Trust').replace('🎯', 'Mission').replace('❤️', 'Morale').replace('📦', 'Resources')
    return re.sub('[\U00010000-\U0010ffff\ufe0f\u2705]', '', text).strip()
def text(s, x, y, size=9, bold=False, color=navy):
    c.setFillColor(colors.HexColor(color)); c.setFont('ArialBold' if bold else 'Arial',size); c.drawString(x,y,clean(s))
def para(s, x, top, width, size=9, bold=False):
    p = Paragraph(escape(clean(s)), ParagraphStyle('p', fontName='ArialBold' if bold else 'Arial', fontSize=size, leading=size*1.35, textColor=colors.HexColor(navy)))
    _,h = p.wrap(width,700); p.drawOn(c,x,top-h); return top-h
def rule(y, x=36, w=540, thickness=.6):
    c.setStrokeColor(colors.HexColor(line)); c.setLineWidth(thickness); c.line(x,y,x+w,y)
def heading(s,x,y):
    text(s.upper(),x,y,10,True); return y-16

# Header and grade. A shield motif matches this example team's Shield Wall patch.
p=c.beginPath(); p.moveTo(43,720); p.lineTo(62,730); p.lineTo(81,720); p.curveTo(81,698,73,686,62,678); p.curveTo(51,686,43,698,43,720)
c.setFillColor(colors.HexColor('#edf0f4')); c.setStrokeColor(colors.HexColor(navy)); c.setLineWidth(2); c.drawPath(p,fill=1,stroke=1)
p=c.beginPath(); p.moveTo(62,724); p.lineTo(75,718); p.curveTo(75,700,69,690,62,684); p.close(); c.setFillColor(colors.HexColor('#c43b44')); c.drawPath(p,fill=1,stroke=0)
text('AFAS 3410 - LEADERSHIP PRACTICUM - AUTOMATED EXAMPLE',96,746,8,True,muted)
text(r['patchName'],96,716,27,True)
text(r['squadron'],96,696,10)
text('Callsign: '+r['callsign'],96,680,9)
c.setStrokeColor(colors.HexColor(navy)); c.rect(514,678,62,78,fill=0,stroke=1)
text('OVERALL',523,744,8,True); text('GRADE',529,732,8,True); text(r['grade'],528,687,40,True)
rule(666,thickness=2)
text('Overall: '+r['gradeTitle'],36,649,10,True)
text('IG inspection: '+r['inspection'],36,633,9)
text(r['bossOutcome'],36,618,9)
text(str(r['score'])+' pts',519,643,15,True); rule(605)
y=heading('Your Flight',36,588)
for i,p in enumerate(r['roster']):
    x=36+(i%2)*274; top=y-(i//2)*57
    c.setStrokeColor(colors.HexColor(line)); c.rect(x,top-50,266,50)
    image=Image.open(io.BytesIO(base64.b64decode(p['avatar'].split(',')[1]))).resize((160,160),Image.Resampling.NEAREST)
    c.drawImage(ImageReader(image),x+7,top-43,36,36,mask='auto')
    rank=folder/('rank-'+str(i)+'.png')
    rank_width=0
    if rank.exists():
        im=Image.open(rank); rank_width= min(17,17*im.width/im.height)
        c.drawImage(str(rank),x+49,top-23,rank_width,17,mask='auto')
    text(p['rank']+' '+p['name'],x+53+rank_width,top-20,10,True)
    para(p['position'],x+49,top-27,208,8)
y-=128
left=heading('Performance Review',36,y)
for title,body in r['observations']:
    left=para(title,36,left,280,9,True)-3
    left=para(body,36,left,280,9)-10
next_top=left-1
next_bottom=para(r['nextStep'],46,next_top-20,260,9)-9
c.setFillColor(colors.HexColor('#f3f5f7')); c.rect(36,next_bottom,280,next_top-next_bottom,fill=1,stroke=0)
text('Carry Forward',46,next_top-12,9,True)
para(r['nextStep'],46,next_top-20,260,9)
right=heading('Score Breakdown',334,y)
for name,pts in r['parts']:
    bottom=para(name,334,right,205,8.5)
    text(pts,557,right-9,8.5,True); right=bottom-4; rule(right,334,242,.35); right-=3
text('Total',334,right-8,10,True); text(r['score'],551,right-8,10,True)
right=heading('Final Readiness',334,right-35)
for i,m in enumerate(r['meters']):
    x=334+(i%2)*124; yy=right-(i//2)*22
    text(m['name'],x,yy,9); text(str(m['value'])+'/10',x+78,yy,9,True)
bottom=min(next_bottom,right-34)
y=heading('Tested Samples of Behavior',36,bottom-24)
objective_text='    '.join(o['name']+': '+str(o['count'])+' event'+('s' if o['count']!=1 else '') for o in r['objectives'])
y=para(objective_text,36,y,540,8.5)-14; rule(y)
y-=16; text('Team reflection: What decision would you repeat, and what would you change?',36,y,9)
rule(y-27)
if y-48 < 36: raise RuntimeError('Report exceeds one-page printable area')
text('October 18, 2026 - Captain Russell',36,y-44,8,False,muted)
text('Team game result - individual rubric scored separately',356,y-44,8,False,muted)
c.showPage(); c.save()
print(folder / 'team-results-example.pdf')
