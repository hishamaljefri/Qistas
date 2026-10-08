"""Open the .docx in LibreOffice, update the table of contents / lists, export PDF."""
import os, subprocess, sys, tempfile, time
import uno
from com.sun.star.beans import PropertyValue

src, out_pdf = map(os.path.abspath, sys.argv[1:3])
profile = tempfile.mkdtemp(prefix="lo_profile_")
proc = subprocess.Popen(["soffice", f"-env:UserInstallation=file://{profile}", "--headless", "--invisible", "--norestore",
                         "--accept=pipe,name=qistasreport;urp;"], env={**os.environ, "SAL_USE_VCLPLUGIN": "svp", "FONTCONFIG_FILE": os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts.conf")})
try:
    ctx = None
    resolver = uno.getComponentContext().ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", uno.getComponentContext())
    for _ in range(60):
        try:
            ctx = resolver.resolve("uno:pipe,name=qistasreport;urp;StarOffice.ComponentContext"); break
        except Exception:
            time.sleep(1)
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    prop = lambda n, v: PropertyValue(Name=n, Value=v)
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), "_blank", 0, (prop("Hidden", True),))
    for _ in range(2):  # twice: page numbers shift once the lists are filled
        idx = doc.getDocumentIndexes()
        for i in range(idx.getCount()):
            idx.getByIndex(i).update()
        doc.getTextFields().refresh()
    doc.storeToURL(uno.systemPathToFileUrl(out_pdf), (prop("FilterName", "writer_pdf_Export"),))
    print("indexes updated:", doc.getDocumentIndexes().getCount(), "->", out_pdf)
    doc.close(True)
finally:
    proc.terminate()
    try: proc.wait(10)
    except Exception: proc.kill()
