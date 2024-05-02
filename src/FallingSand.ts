import { Editor } from "tldraw";
import p5 from "p5";
import { Air, Cell, Geo, Particle, Sand, particles } from "./particles";

type ParticleConstructor = new (
  p5: p5,
  x: number,
  y: number,
  worldSize: number,
  world: Cell[]
) => Particle;

export class FallingSand {
  editor: Editor;
  p5: p5;
  width: number;
  height: number;
  buffer: p5.Graphics | null = null;
  cellSize = 10;
  worldSize = 200;
  world: Cell[];
  particleTypes = particles;

  constructor(editor: Editor) {
    this.editor = editor;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.world = new Array(this.worldSize * this.worldSize);

    /** We mirror tldraw geometry to the particle world */
    editor.store.onAfterChange = (_, next, __) => {
      if (next.typeName !== "shape") return;
      this.updateSolidShapes();
    };
    editor.store.onAfterDelete = (prev, _) => {
      if (prev.typeName !== "shape") return;
      this.updateSolidShapes();
    };

    this.p5 = new p5((sketch: p5) => {
      for (let i = 0; i < this.world.length; i++) {
        const x = i % this.worldSize;
        const y = Math.floor(i / this.worldSize);
        this.world[i] = {
          particle: new Air(sketch, x, y, this.worldSize, this.world),
          changed: false,
        };
      }
      sketch.setup = () => {
        sketch.createCanvas(this.width, this.height);
        this.buffer = sketch.createGraphics(this.width, this.height);

        this.createRandomSand(sketch);
      };
      sketch.draw = () => {
        if (!this.buffer) return;

        this.buffer.push();
        // this.buffer.clear();
        // this.buffer.background("white");

        // Align buffer with tldraw camera/scene
        const cam = this.editor.getCamera();
        // const roundedCam = {
        //   x: Math.round(cam.x),
        //   y: Math.round(cam.y),
        //   z: cam.z,
        // };
        // console.log(roundedCam, cam);
        // this.buffer.scale(roundedCam.z);
        // this.buffer.translate(roundedCam.x, roundedCam.y);
        // this.buffer.scale(cam.z);

        // draw debug outline
        // this.buffer.rect(
        //   0,
        //   0,
        //   this.worldSize * this.cellSize,
        //   this.worldSize * this.cellSize
        // );

        this.handleInputs();
        this.updateParticles();
        this.drawParticles(this.buffer);
        this.buffer.pop();
        sketch.scale(cam.z);
        sketch.translate(cam.x, cam.y);
        sketch.image(this.buffer, 0, 0);
      };
    });
  }

  previousPointer: { x: number; y: number } | null = { x: 0, y: 0 };

  handleInputs() {
    // Check if mouse is down and add particles
    if (
      this.editor.getCurrentToolId() === "sand" &&
      this.editor.inputs.isPointing &&
      // only left click though!
      this.editor.inputs.buttons.has(0)
    ) {
      const path = this.editor.getPath() as keyof typeof this.particleTypes;
      const parts = path.split(".");
      const leaf = parts[parts.length - 1];
      const type = this.particleTypes[leaf as keyof typeof this.particleTypes];

      const currentPointer = this.editor.inputs.currentPagePoint;
      if (this.previousPointer) {
        // if pointer has moved, add particles along the path
        // console.log("moved");
        if (
          currentPointer.x !== this.previousPointer.x ||
          currentPointer.y !== this.previousPointer.y
        ) {
          const dx = currentPointer.x - this.previousPointer.x;
          const dy = currentPointer.y - this.previousPointer.y;
          const distance = Math.sqrt(dx ** 2 + dy ** 2);
          const steps = Math.max(1, Math.floor(distance / this.cellSize));
          for (let i = 0; i < steps; i++) {
            const x = this.previousPointer.x + (dx * i) / steps;
            const y = this.previousPointer.y + (dy * i) / steps;
            this.addParticleAtPoint(type, { x, y });
          }
        }
      }
      if (type) {
        this.addParticleAtPoint(type, currentPointer);
      }
      this.previousPointer = { x: currentPointer.x, y: currentPointer.y };
    } else {
      this.previousPointer = null;
    }
  }

  updateParticles() {
    // Update particles
    for (let y = this.worldSize - 1; y >= 0; y--) {
      if (y % 2 === 0) {
        for (let x = 0; x < this.worldSize; x++) {
          const particle = this.world[y * this.worldSize + x].particle;
          if (particle) particle.update();
        }
      } else {
        for (let x = this.worldSize - 1; x >= 0; x--) {
          const particle = this.world[y * this.worldSize + x].particle;
          if (particle) particle.update();
        }
      }
    }
  }

  drawParticles(buffer: p5.Graphics) {
    // buffer.noStroke();
    for (const cell of this.world) {
      if (!cell.changed) continue;
      cell.changed = false;
      const particle = cell.particle;
      if (particle) {
        buffer.fill(particle.color);
        buffer.stroke(particle.color);
        buffer.strokeWeight(2);
        buffer.rect(
          particle.position.x * this.cellSize,
          particle.position.y * this.cellSize,
          this.cellSize,
          this.cellSize
        );
      }
    }
  }

  createRandomSand(sketch: p5) {
    for (let i = 0; i < 500; i++) {
      const x = Math.floor(sketch.random(this.worldSize));
      const y = Math.floor(sketch.random(this.worldSize));
      const sand = new Sand(sketch, x, y, this.worldSize, this.world);
      const cell = this.world[this.worldIndex(x, y)];
      cell.particle = sand;
      cell.changed = true;
    }
  }

  updateSolidShapes() {
    // Clear existing Geo particles
    for (let i = 0; i < this.world.length; i++) {
      const cell = this.world[i];
      const { particle } = cell;
      if (particle && particle instanceof Geo) {
        cell.particle = new Air(
          this.p5,
          particle.position.x,
          particle.position.y,
          this.worldSize,
          this.world
        );
        cell.changed = true;
      }
    }

    const shapes = this.editor.getCurrentPageShapes();
    for (const shape of shapes) {
      const shapeGeo = this.editor.getShapeGeometry(shape);
      const vertices = shapeGeo.vertices;
      const isClosed = shapeGeo.isClosed && shape.type !== "arrow";

      // Apply rotation to the vertices
      const rotatedVertices = vertices.map((vertex) => {
        const cosAngle = Math.cos(shape.rotation);
        const sinAngle = Math.sin(shape.rotation);
        const rotatedX = vertex.x * cosAngle - vertex.y * sinAngle;
        const rotatedY = vertex.x * sinAngle + vertex.y * cosAngle;
        return { x: rotatedX + shape.x, y: rotatedY + shape.y };
      });

      if (isClosed) {
        // Find the bounding box of the rotated shape
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const vertex of rotatedVertices) {
          minX = Math.min(minX, vertex.x);
          maxX = Math.max(maxX, vertex.x);
          minY = Math.min(minY, vertex.y);
          maxY = Math.max(maxY, vertex.y);
        }

        // Iterate over the bounding box and fill the shape
        for (
          let y = Math.floor(minY / this.cellSize);
          y <= Math.floor(maxY / this.cellSize);
          y++
        ) {
          const intersections: number[] = [];
          for (let i = 0; i < rotatedVertices.length; i++) {
            const v1 = rotatedVertices[i];
            const v2 = rotatedVertices[(i + 1) % rotatedVertices.length];
            if (
              (v1.y < y * this.cellSize && v2.y >= y * this.cellSize) ||
              (v2.y < y * this.cellSize && v1.y >= y * this.cellSize)
            ) {
              const x =
                v1.x +
                ((y * this.cellSize - v1.y) / (v2.y - v1.y)) * (v2.x - v1.x);
              intersections.push(x);
            }
          }
          intersections.sort((a, b) => a - b);
          for (let i = 0; i < intersections.length; i += 2) {
            const startX = Math.floor(intersections[i] / this.cellSize);
            const endX = Math.floor(intersections[i + 1] / this.cellSize);
            for (let x = startX; x <= endX; x++) {
              this.setParticleInPageSpace(
                x * this.cellSize,
                y * this.cellSize,
                Geo
              );
            }
          }
        }
      } else {
        // Follow the outline of the open curve
        for (let i = 0; i < rotatedVertices.length - 1; i++) {
          const v1 = rotatedVertices[i];
          const v2 = rotatedVertices[i + 1];
          const dx = v2.x - v1.x;
          const dy = v2.y - v1.y;
          const steps = Math.max(Math.abs(dx), Math.abs(dy)) / this.cellSize;
          for (let t = 0; t <= steps; t++) {
            const x = v1.x + (dx * t) / steps;
            const y = v1.y + (dy * t) / steps;
            this.setParticleInPageSpace(x, y, Geo);
          }
        }
      }
    }
  }

  worldIndex(x: number, y: number) {
    return y * this.worldSize + x;
  }

  setParticleInPageSpace(x: number, y: number, particle: ParticleConstructor) {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    if (
      gridX >= 0 &&
      gridX < this.worldSize &&
      gridY >= 0 &&
      gridY < this.worldSize
    ) {
      const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world);
      const cell = this.world[this.worldIndex(gridX, gridY)];
      cell.particle = p;
      cell.changed = true;
    }
  }

  BRUSH_RADIUS = 6;
  addParticleAtPoint(
    particle: ParticleConstructor,
    point: { x: number; y: number }
  ) {
    const { x: pointerX, y: pointerY } = point;
    const radius = this.BRUSH_RADIUS;

    const pointerGridX = Math.floor(pointerX / this.cellSize);
    const pointerGridY = Math.floor(pointerY / this.cellSize);

    for (let y = pointerGridY - radius; y < pointerGridY + radius; y++) {
      for (let x = pointerGridX - radius; x < pointerGridX + radius; x++) {
        const distance = Math.sqrt(
          (x - pointerGridX) ** 2 + (y - pointerGridY) ** 2
        );
        if (distance < radius) {
          const p = new particle(this.p5, x, y, this.worldSize, this.world);
          const cell = this.world[this.worldIndex(x, y)];
          cell.particle = p;
          cell.changed = true;
        }
      }
    }

    // for (let i = 0; i < radius; i++) {
    //   const angle = (i / radius) * 2 * Math.PI;
    //   const particleX = pointerX + radius * Math.cos(angle);
    //   const particleY = pointerY + radius * Math.sin(angle);
    //   const gridX = Math.floor(particleX / this.cellSize);
    //   const gridY = Math.floor(particleY / this.cellSize);

    //   if (gridX >= 0 && gridX < this.worldSize && gridY >= 0 && gridY < this.worldSize) {
    //     const p = new particle(this.p5, gridX, gridY, this.worldSize, this.world)
    //     this.world[this.worldIndex(gridX, gridY)] = p;
    //   }
    // }
  }
}
