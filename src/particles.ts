import p5 from "p5";

export type Cell = {
  particle: Particle;
  changed: boolean;
};

abstract class Particle {
  position: p5.Vector;
  gridSize: number;
  grid: Cell[];
  abstract color: p5.Color;

  constructor(
    public p5: p5,
    x: number,
    y: number,
    gridSize: number,
    grid: Cell[]
  ) {
    this.position = p5.createVector(x, y);
    this.gridSize = gridSize;
    this.grid = grid;
  }

  abstract update(): void;

  protected canMoveTo(index: number): boolean {
    return this.grid[index].particle instanceof Air;
  }

  protected delete() {
    this.grid[this.position.y * this.gridSize + this.position.x] = {
      particle: new Air(
        this.p5,
        this.position.x,
        this.position.y,
        this.gridSize,
        this.grid
      ),
      changed: true,
    };
  }

  protected moveParticle(newX: number, newY: number, newIndex: number) {
    // Update grid references
    this.grid[this.position.y * this.gridSize + this.position.x] = {
      particle: new Air(
        this.p5,
        this.position.x,
        this.position.y,
        this.gridSize,
        this.grid
      ),
      changed: true,
    };
    this.position.x = newX;
    this.position.y = newY;
    this.grid[newIndex] = {
      particle: this,
      changed: true,
    };
  }
}

class Sand extends Particle {
  color = this.p5.color(
    this.p5.random(220, 240),
    this.p5.random(170, 180),
    this.p5.random(50, 70)
  );
  update() {
    const x = this.position.x;
    const y = this.position.y;
    const below = (y + 1) * this.gridSize + x;
    const belowRight = (y + 1) * this.gridSize + (x + 1);
    const belowLeft = (y + 1) * this.gridSize + (x - 1);

    // Check and move to the new position if possible
    if (y + 1 < this.gridSize && this.canMoveTo(below)) {
      this.moveParticle(x, y + 1, below);
    } else if (
      y + 1 < this.gridSize &&
      x + 1 < this.gridSize &&
      this.canMoveTo(belowRight)
    ) {
      this.moveParticle(x + 1, y + 1, belowRight);
    } else if (
      y + 1 < this.gridSize &&
      x - 1 >= 0 &&
      this.canMoveTo(belowLeft)
    ) {
      this.moveParticle(x - 1, y + 1, belowLeft);
    }
  }
}
class Water extends Particle {
  color = this.p5.color(0, 0, this.p5.random(100, 255));

  update() {
    const x = this.position.x;
    const y = this.position.y;
    const below = (y + 1) * this.gridSize + x;
    const right = y * this.gridSize + (x + 1);
    const left = y * this.gridSize + (x - 1);

    // Check and move to the new position if possible
    if (y + 1 < this.gridSize && this.canMoveTo(below)) {
      this.moveParticle(x, y + 1, below);
      return;
    }
    const canMoveRight = x + 1 < this.gridSize && this.canMoveTo(right);
    const canMoveLeft = x - 1 >= 0 && this.canMoveTo(left);

    if (canMoveRight && canMoveLeft) {
      const random = this.p5.random(0, 1);
      if (random < 0.5) {
        this.moveParticle(x + 1, y, right);
      } else {
        this.moveParticle(x - 1, y, left);
      }
    } else if (canMoveRight) {
      this.moveParticle(x + 1, y, right);
    } else if (canMoveLeft) {
      this.moveParticle(x - 1, y, left);
    }
  }
}

class Stone extends Particle {
  color = this.p5.color("grey");
  update() {
    // Intentionally left empty
  }
}
class Geo extends Particle {
  color = this.p5.color("#e8e8e8");
  update() {
    // Intentionally left empty
  }
}
class Air extends Particle {
  color = this.p5.color("white");
  update() {
    // this.delete();
  }
}

export const particles = {
  sand: Sand,
  stone: Stone,
  water: Water,
  geo: Geo,
  air: Air,
};

export { Particle, Sand, Stone, Water, Geo, Air };
