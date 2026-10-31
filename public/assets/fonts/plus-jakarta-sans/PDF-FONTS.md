# Font statis PDF Finance

`PlusJakartaSans-PdfRegular.ttf` (bobot 500) dan `PlusJakartaSans-PdfBold.ttf` (800) diturunkan dari `PlusJakartaSans-Variable.ttf` resmi di folder ini; lisensi mengikuti `OFL.txt`.

Dibuat dengan FontTools 4.66.1: `fontTools.varLib.instancer.instantiateVariableFont(TTFont(source), axes, optimize=True, updateFontNames=True)`. `axes` mematok `wght` ke bobot terkait dan seluruh sumbu lain ke nilai default. Hasil harus tidak memiliki tabel `fvar`/`gvar`.

Renderer menanam font statis utuh, bukan melakukan subsetting font variable melalui fontkit. Regresi memeriksa kesamaan byte font tertanam, outline/metrik glyph, Unicode, dan lebar baris. Font variable dan generator PDF Surat tetap tidak diubah.
