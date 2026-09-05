export type IndexLevel = { rows: number; cols: number; cells: number; dominoes: number };

export type IndexEntry = {
  date: string;
  levels: { easy: IndexLevel; medium: IndexLevel; hard: IndexLevel };
};

export type ArchiveIndex = {
  first: string;
  last: string;
  count: number;
  puzzles: IndexEntry[];
};
