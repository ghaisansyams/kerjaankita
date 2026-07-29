import { formatDate } from "@/utils/format";
import type { MomDetail } from "@/repositories/mom.repository";

const CATEGORY_LABEL: Record<string, string> = {
  discussion: "Discussion",
  decision: "Decision",
  action_item: "Action Item",
  next_step: "Next Step",
};

const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  .mom-doc { background: #fff; color: #111; font-family: Arial, Helvetica, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 28px; line-height: 1.5; }
  .mom-doc * { box-sizing: border-box; }
  .mom-doc .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 12px; gap: 16px; }
  .mom-doc .brand { display: flex; align-items: center; gap: 10px; }
  .mom-doc .brand img { max-height: 40px; max-width: 160px; }
  .mom-doc .brand .name { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
  .mom-doc .doctitle { text-align: right; }
  .mom-doc .doctitle h1 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .mom-doc .doctitle p { margin: 2px 0 0; font-size: 11px; color: #555; }
  .mom-doc h2 { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #333; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .mom-doc .meta { width: 100%; border-collapse: collapse; margin-top: 14px; }
  .mom-doc .meta td { padding: 4px 8px; font-size: 12.5px; vertical-align: top; }
  .mom-doc .meta td.k { width: 90px; color: #555; }
  .mom-doc table.grid { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .mom-doc table.grid th, .mom-doc table.grid td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
  .mom-doc table.grid th { background: #f2f2f2; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  .mom-doc .dist { font-size: 12.5px; }
  .mom-doc ol.notes { margin: 0; padding-left: 22px; }
  .mom-doc ol.notes li { margin-bottom: 10px; font-size: 12.5px; }
  .mom-doc ol.notes .cat { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; color: #444; margin-right: 6px; }
  .mom-doc .content { white-space: pre-wrap; }
  .mom-doc .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; }
  .mom-doc .sign .col { flex: 1; font-size: 12.5px; }
  .mom-doc .sign .place { color: #555; margin-bottom: 48px; }
  .mom-doc .sign .line { border-top: 1px solid #111; padding-top: 4px; }
  .mom-doc .sign .role { color: #555; font-size: 11.5px; }
  .no-print { text-align: center; padding: 10px; }
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
  const placeLine = [mom.location, formatDate(mom.meetingDate)].filter(Boolean).join(", ");
  return (
    <div className="mom-doc">
      <style>{CSS}</style>

      <div className="head">
        <div className="brand">
          {logoUrl ? <img src={logoUrl} alt={orgName} /> : <span className="name">{orgName}</span>}
        </div>
        <div className="doctitle">
          <h1>MOM (Minutes of Meeting)</h1>
          <p>{mom.projectName}</p>
        </div>
      </div>

      <table className="meta">
        <tbody>
          <tr><td className="k">Title</td><td><strong>{mom.title}</strong></td></tr>
          <tr><td className="k">Date</td><td>{formatDate(mom.meetingDate)}</td></tr>
          <tr><td className="k">Time</td><td>{mom.meetingTime || "—"}</td></tr>
          <tr><td className="k">Location</td><td>{mom.location || "—"}</td></tr>
          <tr><td className="k">PIC</td><td>{mom.picName || "—"}</td></tr>
        </tbody>
      </table>

      <h2>Participants</h2>
      {mom.participants.length === 0 ? (
        <p className="dist">—</p>
      ) : (
        <table className="grid">
          <thead><tr><th style={{ width: "40%" }}>Name</th><th style={{ width: "30%" }}>Role</th><th>Company</th></tr></thead>
          <tbody>
            {mom.participants.map((p) => (
              <tr key={p.id}><td>{p.name}</td><td>{p.role || "—"}</td><td>{p.company || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Distribution List</h2>
      <p className="dist">{mom.distribution.length ? mom.distribution.map((d) => d.recipient).join(" · ") : "—"}</p>

      <h2>Meeting Notes</h2>
      {mom.notes.length === 0 ? (
        <p className="dist">—</p>
      ) : (
        <ol className="notes">
          {mom.notes.map((n) => (
            <li key={n.id}>
              <span className="cat">{CATEGORY_LABEL[n.category] ?? n.category}</span>
              <span className="content">{n.content}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="sign">
        <div className="col">
          <div className="place">Prepared by</div>
          <div className="line"><strong>{mom.preparedByName ?? "—"}</strong></div>
        </div>
        <div className="col">
          <div className="place">{placeLine}</div>
          <div className="line"><strong>{mom.approvedByName}</strong><div className="role">{mom.approvedByRole}</div></div>
        </div>
      </div>
    </div>
  );
}
