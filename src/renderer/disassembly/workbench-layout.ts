import type { Joint } from '../../core/disassembly';
import { labelSize, LAYOUT, type LevelLayout, type Point } from '../../core/layout';

/**
 * Fold a simple reading chain onto a technical sheet. This is only a presentation projection: ids, joint direction,
 * joint order and reading numbers remain those of the core layout. Branching graphs keep their proven layout.
 * A long return is folded only when both ends are in the last row, so its outer lane cannot cross another plate.
 */
export function workbenchLayout(layout: LevelLayout, joints: Pick<Joint, 'from' | 'to' | 'type' | 'label'>[]): LevelLayout {
  const ids = layout.order;
  if (layout.orientation !== 'flow' || ids.length < 4 || layout.width < 1000) return layout;
  const index = new Map(ids.map((id, i) => [id, i]));
  const columns = Math.min(3, Math.ceil(ids.length / 2));
  const row = (id: string) => Math.floor(index.get(id)! / columns);
  const lastRow = Math.floor((ids.length - 1) / columns);
  const chain = ids.slice(1).every((id, i) => joints.some(j =>
    (j.from === ids[i] && j.to === id) || (j.type === 'depends-on' && j.from === id && j.to === ids[i])));
  if (!chain || joints.some(j => {
    const a = index.get(j.from), b = index.get(j.to);
    if (a === undefined || b === undefined || a === b) return true;
    return Math.abs(a - b) !== 1 && !(a > b && row(j.from) === lastRow && row(j.to) === lastRow);
  })) return layout;

  const p = LAYOUT.plate, margin = LAYOUT.margin;
  const horizontal = joints.filter(j => row(j.from) === row(j.to) && Math.abs(index.get(j.from)! - index.get(j.to)!) === 1);
  const gap = Math.max(76, ...horizontal.map(j => labelSize(j.label).w + 2 * LAYOUT.label.clear));
  const rowGap = 82;
  const width = 2 * margin + columns * p.w + (columns - 1) * gap;
  const plates = ids.map((id, i) => {
    const r = Math.floor(i / columns), c = r % 2 ? columns - 1 - i % columns : i % columns;
    return { id, rect: { x: margin + c * (p.w + gap), y: margin + r * (p.h + rowGap), w: p.w, h: p.h } };
  });
  const byId = new Map(plates.map(p => [p.id, p.rect]));
  let bottom = margin + (lastRow + 1) * p.h + lastRow * rowGap;
  let returns = 0;
  const routed = joints.map(j => {
    const a = byId.get(j.from)!, b = byId.get(j.to)!, size = labelSize(j.label);
    const ac = a.x + a.w / 2, bc = b.x + b.w / 2;
    let points: Point[], cx: number, cy: number;
    const adjacent = Math.abs(index.get(j.from)! - index.get(j.to)!) === 1;
    if (!adjacent) {
      cy = bottom + 32 + returns++ * (size.h + 16); cx = (ac + bc) / 2;
      points = [[ac, a.y + a.h], [ac, cy], [bc, cy], [bc, b.y + b.h]];
    } else if (a.y === b.y) {
      const forward = b.x > a.x;
      const x1 = forward ? a.x + a.w : a.x, x2 = forward ? b.x : b.x + b.w;
      cy = a.y + a.h / 2; cx = (x1 + x2) / 2; points = [[x1, cy], [x2, cy]];
    } else {
      const down = b.y > a.y;
      const y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
      cy = (y1 + y2) / 2; cx = Math.max(margin + size.w / 2, Math.min(width - margin - size.w / 2, ac));
      points = [[ac, y1], [ac, y2]];
    }
    return { from: j.from, to: j.to, points, label: { x: cx - size.w / 2, y: cy - size.h / 2, ...size }, returns: index.get(j.to)! < index.get(j.from)! };
  });
  bottom = Math.max(bottom, ...routed.map(j => j.label.y + j.label.h));
  return { ...layout, plates, joints: routed, width, height: bottom + margin };
}
