export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  constructor(values: string[]) {
    values.forEach((value) => {
      this.parent.set(value, value);
      this.rank.set(value, 0);
    });
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (!parent) {
      throw new Error(`Unknown value: ${value}`);
    }
    if (parent !== value) {
      const root = this.find(parent);
      this.parent.set(value, root);
      return root;
    }
    return parent;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) {
      return false;
    }

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }

    return true;
  }

  countComponents(): number {
    const roots = new Set<string>();
    for (const value of this.parent.keys()) {
      roots.add(this.find(value));
    }
    return roots.size;
  }
}
