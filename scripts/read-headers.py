import zipfile
import xml.etree.ElementTree as ET
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

z = zipfile.ZipFile('دليل الحسابات (1).xlsx')
strings = []
if 'xl/sharedStrings.xml' in z.namelist():
    tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for elem in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        t = elem.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        strings.append(t.text if t is not None else '')

sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

for r in range(1, 6):
    row = sheet_tree.find(f'.//main:row[@r="{r}"]', ns)
    if row is not None:
        vals = []
        for cell in row.findall('main:c', ns):
            t = cell.attrib.get('t')
            v = cell.find('main:v', ns)
            val = v.text if v is not None else ''
            if t == 's' and val.isdigit():
                val = strings[int(val)]
            vals.append(val)
        print(f'Row {r}: {vals}')
