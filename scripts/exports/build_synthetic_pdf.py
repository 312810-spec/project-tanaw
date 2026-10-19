"""Fixed reading copy of the aggregate-only synthetic prototype (ReportLab)."""
import json
from pathlib import Path
import sys
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def build(directory):
    root = Path(directory)
    model = json.loads((root / 'tanaw-synthetic-model.json').read_text())
    if model['status'] != 'readyPrototypeOnly' or model['canPublish'] or model['canAcceptDistrict']:
        raise ValueError('Only the synthetic prototype can be rendered')
    pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    styles = getSampleStyleSheet()
    for name in ['BodyText', 'Title', 'Heading2']:
        styles[name].fontName = 'DejaVuBold' if name != 'BodyText' else 'DejaVu'
    styles.add(ParagraphStyle(name='Warning', fontName='DejaVuBold', fontSize=10, leading=15, textColor=colors.HexColor('#9A3412')))
    doc = SimpleDocTemplate(str(root / 'tanaw-synthetic-results.pdf'), pagesize=A4, leftMargin=38, rightMargin=38, topMargin=42, bottomMargin=38, title=model['title'], author='Project TANAW synthetic prototype')
    flow = [Paragraph(model['title'], styles['Title']), Spacer(1, 12), Paragraph(model['warning'], styles['Warning']), Spacer(1, 20)]
    values = [['Measure', 'Numerator', 'Denominator', 'Result']]
    for row in model['rows']:
        result = f"{row['value']:.2f}%" if row['unit'] == 'percent' else str(row['value'])
        values.append([row['label'], str(row['numerator']), 'n.a.' if row['denominator'] is None else str(row['denominator']), result])
    table = Table(values, colWidths=[225, 85, 105, 104], rowHeights=32)
    table.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),'DejaVu'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#163F50')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'DejaVuBold'),('FONTSIZE',(0,0),(-1,-1),9),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F0F5F7'),colors.white]),('ALIGN',(1,1),(-1,-1),'RIGHT')]))
    flow += [table, Spacer(1,18), Paragraph('The percentage pools 1/2 and 0/18 to 1/20 = 5.00%. The recorded count is a separate measure.',styles['BodyText']), Spacer(1,24), Paragraph('Frozen references',styles['Heading2'])]
    p = model['rows'][0]['provenance']
    refs = [['Packet ID',p['packetId']],['Packet version',str(p['packetVersion'])],['Participation contract',p['contractId']],['Recorded-count contract',model['rows'][1]['provenance']['contractId']],['Contract revisions','1 / 1'],['Partition ID',p['partitionId']],['Partition revision',str(p['partitionRevision'])],['Template',model['template']]]
    rt = Table(refs,colWidths=[175,344],rowHeights=26)
    rt.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),'DejaVu'),('FONTSIZE',(0,0),(-1,-1),9),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.HexColor('#F0F5F7'),colors.white])]))
    flow += [rt, Spacer(1,24),Paragraph('Source: invented fixture. No actual school or learner records. Excel and PowerPoint contain editable snapshots. This PDF is the fixed reading copy. Later edits do not update or approve the frozen packet.',styles['BodyText'])]
    doc.build(flow)


if __name__ == '__main__':
    build(sys.argv[1])
