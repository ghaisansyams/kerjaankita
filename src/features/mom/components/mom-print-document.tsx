import type { MomDetail } from "@/repositories/mom.repository";

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

const CSS = `
  @page { size: A4; margin: 30mm 32mm; }
  /* 552px = the 146mm content width left by the @page margins, so the
     on-screen preview is the same width as the exported PDF. */
  .mom-doc { background:#fff; color:#000; font-family: Arial, Helvetica, "Segoe UI", sans-serif; max-width: 552px; margin: 0 auto; padding: 18px; font-size: 12px; line-height: 1.45; }
  .mom-doc * { box-sizing: border-box; }
  .mom-doc table.frame { width: 100%; border-collapse: collapse; }
  .mom-doc table.frame > tbody > tr > td { border: 1px solid #000; padding: 8px 10px; vertical-align: top; }
  .mom-doc .logo-cell { text-align: center; padding: 12px; }
  /* Sized by eye against the reference, between the two rejected extremes:
     58px (203px wide) read as too big, 40px (140px) as too small. 50px lands
     at 175px. Height binds; the 260px cap never comes into play. */
  .mom-doc .logo-cell img { max-height: 50px; max-width: 260px; object-fit: contain; display: block; margin: 0 auto; }
  .mom-doc .logo-cell .txt { font-size: 20px; font-weight: 700; letter-spacing: .04em; }
  /* 57/43, matching the reference MOM. One table means one column split for
     every row, so this also sets Mengetahui | Distribusi and the signature
     row — a 50/50 split forced each participant onto two lines. */
  /* Selector has to out-specify the blanket td vertical-align:top rule above,
     otherwise MOM sits at the top of the cell instead of centred against the
     Tanggal/Tempat/Waktu block beside it. */
  .mom-doc table.frame > tbody > tr > td.mom-title { text-align: center; font-weight: 700; font-size: 15px; letter-spacing: .06em; width: 57%; vertical-align: middle; }
  .mom-doc .meta td.k { padding: 0; white-space: nowrap; }
  .mom-doc .meta { border-collapse: collapse; }
  .mom-doc .meta td { border: none !important; padding: 1px 0; }
  .mom-doc .sec-h { font-weight: 700; margin-bottom: 4px; }
  .mom-doc ol.know { margin: 0; padding-left: 20px; list-style: decimal outside; }
  .mom-doc ol.know li { margin-bottom: 4px; }
  .mom-doc .dist p { margin: 0 0 2px; }
  .mom-doc ol.notes { margin: 4px 0 0; padding-left: 24px; list-style: decimal outside; }
  .mom-doc ol.notes li { margin-bottom: 7px; text-align: justify; padding-left: 4px; }
  .mom-doc .content { white-space: pre-wrap; }
  .mom-doc .sign td { border: 1px solid #000; }
  .mom-doc .sign .right { text-align: left; }
  .mom-doc .sign .place { margin-bottom: 2px; font-weight: 700; }
  .mom-doc .sign .lbl { margin-bottom: 4px; }
  .mom-doc .sign img { height: 60px; display: block; margin: 2px 0; }
  .mom-doc .sign .who { font-weight: 700; }
  .mom-doc .sign .role { }
  .mom-doc .sig-gap { height: 64px; }
  .no-print { text-align: center; padding: 12px; }
  .no-print button { font-family: inherit; font-size: 13px; padding: 8px 16px; border: 1px solid #111; background: #111; color: #fff; border-radius: 6px; cursor: pointer; }
  @media print { .no-print { display: none !important; } body { background: #fff; } .mom-doc { padding: 0; } }
`;

export function MomPrintDocument({
  mom,
  orgName,
  logoUrl,
}: {
  mom: MomDetail;
  orgName: string;
  logoUrl: string | null;
}) {
  const logo = logoUrl || "/mom/logo.png";
  const showSignature = /galih/i.test(mom.approvedByName);
  // Company signs at its HQ city; date follows the meeting (never "today").
  const placeDate = `Depok, ${idLongDate(mom.meetingDate)}`;

  return (
    <div className="mom-doc">
      <style>{CSS}</style>

      <table className="frame">
        <tbody>
          {/* Logo */}
          <tr>
            <td className="logo-cell" colSpan={2}>
              {logo ? <img src={logo} alt={orgName} /> : <span className="txt">{orgName}</span>}
            </td>
          </tr>

          {/* MOM | meeting info */}
          <tr>
            <td className="mom-title">MOM</td>
            <td>
              <table className="meta">
                <tbody>
                  <tr><td className="k">Tanggal</td><td>&nbsp;:&nbsp;{ddmmyyyy(mom.meetingDate)}</td></tr>
                  <tr><td className="k">Tempat</td><td>&nbsp;:&nbsp;{mom.location || "-"}</td></tr>
                  <tr><td className="k">Waktu</td><td>&nbsp;:&nbsp;{mom.meetingTime || "-"}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Mengetahui | Distribusi */}
          <tr>
            <td>
              <div className="sec-h">Mengetahui:</div>
              {mom.participants.length === 0 ? (
                <p>-</p>
              ) : (
                <ol className="know">
                  {mom.participants.map((p) => (
                    <li key={p.id}>
                      {p.name}
                      {p.role ? ` sebagai ${p.role}` : ""}
                      {p.company ? ` (${p.company})` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </td>
            <td className="dist">
              <div className="sec-h">DISTRIBUSI MOM:</div>
              {mom.distribution.length === 0 ? <p>-</p> : mom.distribution.map((d) => <p key={d.id}>{d.recipient}</p>)}
            </td>
          </tr>

          {/* MOM notes */}
          <tr>
            <td colSpan={2}>
              <div className="sec-h">MOM:</div>
              {mom.notes.length === 0 ? (
                <p>-</p>
              ) : (
                <ol className="notes">
                  {mom.notes.map((n) => (
                    <li key={n.id}><span className="content">{n.content}</span></li>
                  ))}
                </ol>
              )}
            </td>
          </tr>

          {/* Signature */}
          <tr className="sign">
            <td>&nbsp;</td>
            <td className="right">
              <div className="place">{placeDate}</div>
              <div className="lbl">Disiapkan dan Disetujui oleh:</div>
              {showSignature ? <img src="/mom/signature.png" alt="Signature" /> : <div className="sig-gap" />}
              <div className="who">{mom.approvedByName}</div>
              {mom.approvedByRole ? <div className="role">{mom.approvedByRole}</div> : null}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
