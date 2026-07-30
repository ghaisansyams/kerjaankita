const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
function idLongDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${ID_MONTHS[Number(m) - 1]} ${y}`;
}
function ddmmyyyy(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export type ReportSection = {
  status: string;
  pct: number;
  tasks: { number: number; title: string; images: string[] }[];
};

const CSS = `
  @page { size: A4; margin: 16mm; }
  .rp-doc { background:#fff; color:#000; font-family: Arial, Helvetica, "Segoe UI", sans-serif; max-width: 780px; margin: 0 auto; padding: 18px; font-size: 12px; line-height: 1.45; }
  .rp-doc * { box-sizing: border-box; }
  .rp-doc table.frame { width: 100%; border-collapse: collapse; }
  .rp-doc table.frame > tbody > tr > td { border: 1px solid #000; padding: 8px 10px; vertical-align: top; }
  .rp-doc .logo-cell { text-align: center; padding: 12px; }
  .rp-doc .logo-cell img { max-height: 58px; max-width: 260px; object-fit: contain; display: block; margin: 0 auto; }
  .rp-doc .logo-cell .txt { font-size: 20px; font-weight: 700; letter-spacing: .04em; }
  .rp-doc .title-cell { text-align: center; font-weight: 700; font-size: 15px; letter-spacing: .06em; width: 50%; vertical-align: middle; }
  .rp-doc .meta { border-collapse: collapse; }
  .rp-doc .meta td { border: none !important; padding: 1px 0; white-space: nowrap; }
  .rp-doc .sec-h { font-weight: 700; margin-bottom: 4px; }
  .rp-doc ol.know { margin: 0 0 6px; padding-left: 20px; list-style: decimal outside; }
  .rp-doc ol.know li { margin-bottom: 2px; }
  .rp-doc .agenda { font-weight: 700; margin-top: 4px; }
  .rp-doc .dist p { margin: 0; }
  .rp-doc .progress-h { text-align: center; font-weight: 700; font-size: 14px; letter-spacing: .06em; }
  .rp-doc .status-block { margin-bottom: 10px; }
  .rp-doc .status-block:last-child { margin-bottom: 0; }
  .rp-doc .status-h { font-weight: 700; margin-bottom: 3px; }
  .rp-doc ol.tasks { margin: 0; padding-left: 22px; list-style: decimal outside; }
  .rp-doc ol.tasks li { margin-bottom: 10px; page-break-inside: avoid; }
  .rp-doc .shots { margin: 5px 0 2px; }
  .rp-doc .shots img { display: block; max-width: 100%; max-height: 430px; margin: 5px 0; border: 1px solid #cbd5e1; border-radius: 3px; }
  .rp-doc .sign td { border: 1px solid #000; }
  .rp-doc .sign .right { text-align: left; }
  .rp-doc .sign .place { margin-bottom: 2px; font-weight: 700; }
  .rp-doc .sign .lbl { margin-bottom: 4px; }
  .rp-doc .sign img { height: 60px; display: block; margin: 2px 0; }
  .rp-doc .sign .who { font-weight: 700; }
  .no-print { text-align: center; padding: 12px; }
  .no-print button { font-family: inherit; font-size: 13px; padding: 8px 16px; border: 1px solid #111; background: #111; color: #fff; border-radius: 6px; cursor: pointer; }
  @media print { .no-print { display: none !important; } body { background: #fff; } .rp-doc { padding: 0; } }
`;

/**
 * Board → "REPORT PROGRESS" document in the Spero format. Sections are ordered
 * by completion (Done 100% at top → To Do at the bottom); tasks are numbered
 * continuously. Spero logo + Galih Aldio Putra's signature, printed via the
 * browser (Save as PDF).
 */
export function ReportProgressDocument({
  projectName,
  clientName,
  orgName,
  logoUrl,
  sections,
  dateStr,
}: {
  projectName: string;
  clientName: string | null;
  orgName: string;
  logoUrl: string | null;
  sections: ReportSection[];
  dateStr: string; // yyyy-mm-dd
}) {
  const logo = logoUrl || "/mom/logo.png";
  const mengetahui = [clientName, "PT. Spero Mahakarya Nusantara"].filter(Boolean) as string[];

  return (
    <div className="rp-doc">
      <style>{CSS}</style>

      <table className="frame">
        <tbody>
          <tr>
            <td className="logo-cell" colSpan={2}>
              {logo ? <img src={logo} alt={orgName} /> : <span className="txt">{orgName}</span>}
            </td>
          </tr>

          <tr>
            <td className="title-cell">REPORT PROGRESS</td>
            <td>
              <table className="meta">
                <tbody>
                  <tr><td>Tanggal</td><td>&nbsp;:&nbsp;{ddmmyyyy(dateStr)}</td></tr>
                  <tr><td>Tempat</td><td>&nbsp;:&nbsp;Spero</td></tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td>
              <div className="sec-h">Mengetahui:</div>
              <ol className="know">
                {mengetahui.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ol>
              <div className="agenda">Agenda : Report Progress {projectName}</div>
            </td>
            <td className="dist">
              <div className="sec-h">DISTRIBUSI PROGRESS:</div>
              <p>PT. Spero Mahakarya Nusantara</p>
            </td>
          </tr>

          <tr>
            <td className="progress-h" colSpan={2}>PROGRESS</td>
          </tr>

          <tr>
            <td colSpan={2}>
              {sections.length === 0 ? (
                <p>Belum ada task di board ini.</p>
              ) : (
                sections.map((sec) => (
                  <div className="status-block" key={sec.status}>
                    <div className="status-h">
                      {sec.status} ({sec.pct}%):
                    </div>
                    <ol className="tasks" start={sec.tasks[0]?.number ?? 1}>
                      {sec.tasks.map((t) => (
                        <li key={t.number}>
                          {t.title}
                          {t.images.length > 0 && (
                            <div className="shots">
                              {t.images.map((src, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={src} alt="" />
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))
              )}
            </td>
          </tr>

          <tr className="sign">
            <td>&nbsp;</td>
            <td className="right">
              <div className="place">Depok, {idLongDate(dateStr)}</div>
              <div className="lbl">Disiapkan dan Disetujui oleh:</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mom/signature.png" alt="Signature" />
              <div className="who">Galih Aldio Putra</div>
              <div className="role">Director</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
