import { DEFAULT_STRUCTURE, structureSize } from '../domain/planner';
import { Chip } from './components';
import type { DayStructure, StructureBlock } from '../domain/types';

const PRESETS: { label: string; structure: DayStructure }[] = [
  {
    label: '6 · 4 singles + 1 superset',
    structure: { blocks: [s(), s(), s(), s(), ss(2)] },
  },
  {
    label: '7 · 3 singles + 2 supersets',
    structure: DEFAULT_STRUCTURE,
  },
  {
    label: '7 · 2 singles + superset + triset',
    structure: { blocks: [s(), s(), ss(2), ss(3)] },
  },
  {
    label: '8 · 4 singles + 2 supersets',
    structure: { blocks: [s(), s(), s(), s(), ss(2), ss(2)] },
  },
  {
    label: '5 · short session',
    structure: { blocks: [s(), s(), s(), ss(2)] },
  },
];

function s(): StructureBlock {
  return { kind: 'single', size: 1 };
}
function ss(size: number): StructureBlock {
  return { kind: 'superset', size };
}

export function StructureEditor({
  structure, onChange, title,
}: {
  structure: DayStructure;
  onChange: (structure: DayStructure) => void;
  title: string;
}) {
  const total = structureSize(structure);

  const setBlock = (index: number, block: StructureBlock) =>
    onChange({ blocks: structure.blocks.map((b, i) => (i === index ? block : b)) });

  const removeBlock = (index: number) =>
    onChange({ blocks: structure.blocks.filter((_, i) => i !== index) });

  const addBlock = (block: StructureBlock) =>
    onChange({ blocks: [...structure.blocks, block] });

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong className="small">{title}</strong>
        <Chip tone="accent">{total} exercises</Chip>
      </div>

      {structure.blocks.map((block, index) => (
        <div key={index} className="list-item">
          <span className="slot">{String.fromCharCode(65 + index)}</span>
          <div className="grow small">
            {block.size === 1 ? 'Single exercise' : `${block.size === 2 ? 'Superset' : block.size === 3 ? 'Triset' : 'Giant set'} — ${block.size} exercises`}
          </div>
          <div className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="tiny-btn"
              disabled={block.size <= 1}
              aria-label="Fewer exercises in this block"
              onClick={() => setBlock(index, { kind: block.size - 1 > 1 ? 'superset' : 'single', size: block.size - 1 })}
            >
              −
            </button>
            <button
              type="button"
              className="tiny-btn"
              disabled={block.size >= 4}
              aria-label="More exercises in this block"
              onClick={() => setBlock(index, { kind: 'superset', size: block.size + 1 })}
            >
              +
            </button>
            <button type="button" className="tiny-btn danger" onClick={() => removeBlock(index)} aria-label="Remove block">×</button>
          </div>
        </div>
      ))}

      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        <button type="button" className="tiny-btn" onClick={() => addBlock(s())}>+ single</button>
        <button type="button" className="tiny-btn" onClick={() => addBlock(ss(2))}>+ superset</button>
        <button type="button" className="tiny-btn" onClick={() => addBlock(ss(3))}>+ triset</button>
      </div>

      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="toggle"
            style={{ fontSize: 12 }}
            onClick={() => onChange(preset.structure)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
