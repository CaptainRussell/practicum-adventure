// Local, self-contained physics renderer. Build with: npm run build:dice
import DiceBox from '@3d-dice/dice-box-threejs';

// Upstream has no destroy API and installs a permanent resize listener.
// Keep each overlay's renderer, observer and animation lifetime together.
class GameDiceBox extends DiceBox {
  makeWorldBox() {
    // Upstream rebuilds the tray on resize; retire its previous contact rules.
    for (const contact of this.world.contactmaterials.slice()) this.world.removeContactMaterial(contact);
    super.makeWorldBox();
    for (const contact of this.world.contactmaterials) {
      if (contact.materials.includes(this.box_body.desk.material)) contact.restitution = 0.74;
    }
  }
  getNotationVectors(...args) {
    const notation = super.getNotationVectors(...args);
    for (const vector of notation.vectors || []) {
      // Guarantee a substantial tumble even when upstream picks a weak spin.
      // Store it in the throw vector so simulation and visible playback agree.
      const heading = Math.random() * Math.PI * 2;
      const tilt = 0.65 + Math.random() * 0.6;
      const speed = 36 + Math.random() * 16; // radians/second, about 6–8 turns/sec
      vector.angle = {
        x: Math.cos(heading) * Math.sin(tilt) * speed,
        y: Math.sin(heading) * Math.sin(tilt) * speed,
        z: Math.cos(tilt) * speed * (Math.random() < 0.5 ? -1 : 1)
      };
      vector.pos.z = 450 + Math.random() * 200;
    }
    return notation;
  }
  spawnDice(vector, existing = false) {
    super.spawnDice(vector, existing);
    const die = existing || this.diceList[this.diceList.length - 1];
    // The upstream threshold of 75 can put visibly moving dice to sleep.
    if (die?.body) die.body.sleepSpeedLimit = 12;
  }
  swapDiceFace_D4(die, value) {
    super.swapDiceFace_D4(die, value);
    // Upstream clears the dry-run result for other shapes but misses the D4.
    // Re-read its already assigned face when the visible throw settles.
    die.result = [];
  }
  resizeWorld() {
    this.observer = new ResizeObserver(() => {
      if (this.stopped || !this.initialized || !this.container.isConnected) return;
      this.setDimensions({ x: this.container.clientWidth, y: this.container.clientHeight });
    });
    this.observer.observe(this.container);
  }
  animateThrow(...args) { if (!this.stopped) super.animateThrow(...args); }
  animateAfterThrow() {
    this.running = false;
    if (!this.stopped) this.renderer.render(this.scene, this.camera);
  }
  clearDice() {
    this.running = false;
    for (const die of this.diceList.splice(0)) {
      this.scene.remove(die);
      this.world.removeBody(die.body);
    }
    if (!this.stopped && this.renderer) this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    this.running = false;
    this.observer?.disconnect();
    const geometries = new Set(Object.values(this.DiceFactory.geometries));
    const materials = new Set(), textures = new Set();
    this.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      object.shadow?.dispose();
    });
    materials.forEach(m => {
      Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); });
      m.dispose();
    });
    textures.forEach(t => t.dispose());
    geometries.forEach(g => g.dispose());
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }
}

let nextId = 0;
export function roll(container, sides, value) {
  container.id = `physics-die-${++nextId}`;
  const color = sides === 4 ? '#cd7739' : sides === 6 ? '#f4ead0' : '#4080b8';
  const box = new GameDiceBox(`#${container.id}`, {
    sounds: false, // Game audio remains controlled by the existing sound switch.
    theme_material: 'plastic',
    theme_customColorset: {
      name: `practicum-d${sides}`, background: color,
      foreground: sides === 6 ? '#20232a' : '#fff6de',
      outline: 'none', edge: color, texture: 'none', material: 'plastic'
    },
    baseScale: Math.min(container.clientWidth, container.clientHeight) * 0.38,
    strength: 3.2,
    light_intensity: 1.1,
    iterationLimit: 900
  });
  let cancelled = false;
  const promise = (async () => {
    await box.initialize();
    if (cancelled || !container.isConnected) { box.dispose(); return null; }
    // The library simulates the throw and assigns face labels BEFORE playback.
    // There is no rotation or face replacement at the end of the visible roll.
    const result = await box.roll(`1d${sides}@${value}`);
    if (cancelled || !container.isConnected) return null;
    const actual = result?.sets?.[0]?.rolls?.[0]?.value;
    if (+actual !== +value) throw new Error('Dice animation did not match the game result');
    return result;
  })();
  return { promise, cancel() { cancelled = true; box.dispose(); } };
}
